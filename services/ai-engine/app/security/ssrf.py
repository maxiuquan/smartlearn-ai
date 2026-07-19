"""
SSRF 防护模块

提供出网 URL 安全校验，防止 ai-engine 在服务端代抓请求中访问：
- 非 http/https 协议（file://、gopher://、ftp:// 等）
- 内网 / 私有 / 环回 / 链路本地 / 云元数据地址段
- 非常规高危端口（数据库、管理端口等）

所有服务端出网抓取（如 /media/stt 下载外部音频）必须先经 `is_safe_url` 校验。
"""
import ipaddress
import logging
import socket
from typing import List, Optional, Union

import httpx
from urllib.parse import urlparse, urljoin

logger = logging.getLogger("ai_engine.security.ssrf")

# ─── 高危 / 管理 / 数据库端口黑名单 ────────────────────────────
# 这些端口的对外请求一旦被 SSRF 命中，极易造成数据泄露或服务破坏。
BLOCKED_PORTS = {
    17,      # echo (DoS 放大)
    19,      # chargen (DoS 放大)
    445,     # SMB
    1433,    # MSSQL
    3306,    # MySQL
    5432,    # PostgreSQL
    6379,    # Redis
    11211,   # Memcached
    27017,   # MongoDB
    9200,    # Elasticsearch
    2049,    # NFS
    3128,    # 常见开放代理
}

# ─── 强制拒绝的 IPv4 / IPv6 网络段 ─────────────────────────────
# 覆盖：未指定、环回、RFC1918 私有、链路本地、云元数据(169.254.169.254)、
# CGNAT、以及各类保留/文档网络段；IPv6 环回/唯一本地/链路本地/IPv4 映射。
PRIVATE_NETWORKS: List[ipaddress._BaseNetwork] = [
    ipaddress.ip_network("0.0.0.0/8"),          # 未指定地址
    ipaddress.ip_network("127.0.0.0/8"),         # 环回
    ipaddress.ip_network("10.0.0.0/8"),          # RFC1918
    ipaddress.ip_network("172.16.0.0/12"),       # RFC1918
    ipaddress.ip_network("192.168.0.0/16"),      # RFC1918
    ipaddress.ip_network("169.254.0.0/16"),      # 链路本地 + 云元数据(169.254.169.254)
    ipaddress.ip_network("100.64.0.0/10"),       # CGNAT
    ipaddress.ip_network("192.0.0.0/24"),        # IETF 协议分配
    ipaddress.ip_network("192.0.2.0/24"),        # TEST-NET-1
    ipaddress.ip_network("198.18.0.0/15"),       # 基准测试
    ipaddress.ip_network("198.51.100.0/24"),     # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),      # TEST-NET-3
    ipaddress.ip_network("::1/128"),             # IPv6 环回
    ipaddress.ip_network("::/128"),              # IPv6 未指定
    ipaddress.ip_network("fc00::/7"),            # IPv6 唯一本地
    ipaddress.ip_network("fe80::/10"),           # IPv6 链路本地
    ipaddress.ip_network("64:ff9b::/96"),        # IPv4 映射 IPv6
]


def _is_private_ip(ip: str) -> bool:
    """判断给定 IP 是否属于私有/内网/保留段。

    注意：仅接受「IP 字面量」。若传入的是域名（非合法 IP 字符串），
    返回 False，交由 DNS 解析分支进一步判定（避免把正常域名误判为内网）。
    """
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in net for net in PRIVATE_NETWORKS)


def _resolve_hostname(hostname: str) -> set:
    """解析主机名为全部 A/AAAA 记录 IP。解析失败返回空集。"""
    try:
        infos = socket.getaddrinfo(hostname, None)
        return {info[4][0] for info in infos}
    except (socket.gaierror, UnicodeError, OSError):
        return set()


def is_safe_url(url: Union[str, None], allowlist: Optional[Union[str, List[str]]] = None) -> bool:
    """
    判断出网 URL 是否可以安全抓取。

    Args:
        url: 待校验的 URL（必须是 str）。
        allowlist: 允许的主机名/域名白名单，支持逗号分隔字符串或列表。
                   匹配方式：精确主机名，或以 `.域名` 结尾的后缀匹配。

    Returns:
        bool: 安全（可抓取）返回 True；存在 SSRF 风险返回 False。

    校验顺序：
        1. 必须为 http/https；
        2. 端口在合法范围且不在高危端口黑名单；
        3. 白名单命中直接放行；
        4. 字面 IP 或域名解析后的任一 IP 不得位于私有/内网段。
    """
    if not url or not isinstance(url, str):
        return False

    try:
        parsed = urlparse(url)
    except ValueError:
        return False

    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        logger.warning("SSRF 拦截：非 http/https 协议 -> %s", url)
        return False

    hostname = (parsed.hostname or "").strip().lower()
    if not hostname:
        return False

    port = parsed.port
    if port is not None:
        if port < 1 or port > 65535 or port in BLOCKED_PORTS:
            logger.warning("SSRF 拦截：高危/非法端口 %s -> %s", port, url)
            return False

    # 白名单优先（精确或后缀匹配）
    allow: List[str] = []
    if allowlist:
        if isinstance(allowlist, str):
            allow = [a.strip() for a in allowlist.split(",") if a.strip()]
        else:
            allow = [str(a).strip() for a in allowlist if str(a).strip()]
    for allowed in allow:
        allowed = allowed.lower()
        if hostname == allowed or hostname.endswith("." + allowed):
            return True

    # 1) 字面 IP 直接判定
    if _is_private_ip(hostname):
        logger.warning("SSRF 拦截：内网/私有/环回地址 -> %s", url)
        return False

    # 2) 域名：解析全部记录逐个校验（防 DNS 重绑定落到内网）
    resolved = _resolve_hostname(hostname)
    if not resolved:
        # 无法解析：按不安全处理，避免不可解析主机被放行
        logger.warning("SSRF 拦截：无法解析主机（DNS 失败或重绑定风险）-> %s", url)
        return False

    for ip in resolved:
        if _is_private_ip(ip):
            logger.warning("SSRF 拦截：域名 %s 解析到内网地址 %s", hostname, ip)
            return False

    return True


def safe_http_get_bytes(
    url: str,
    allowlist: Optional[Union[str, List[str]]] = None,
    *,
    max_bytes: int = 25 * 1024 * 1024,
    timeout: float = 30.0,
    max_redirects: int = 3,
) -> bytes:
    """
    安全下载：先经 `is_safe_url` 校验，禁止跨网段重定向，限制响应体大小。

    Args:
        url: 待下载的 URL。
        allowlist: 域名白名单（透传给 is_safe_url）。
        max_bytes: 响应体大小上限（默认 25MB）。
        timeout: 请求超时（秒）。
        max_redirects: 允许的最大重定向跳数。

    Returns:
        bytes: 下载的二进制内容。

    Raises:
        ValueError: URL 未通过 SSRF 校验、重定向目标不安全、响应超上限等。
        httpx.HTTPError: 网络层错误（由调用方决定如何映射为 HTTP 状态码）。
    """
    if not is_safe_url(url, allowlist=allowlist):
        raise ValueError("URL 未通过 SSRF 安全校验")

    last_exc: Optional[Exception] = None
    for _ in range(max_redirects + 1):
        with httpx.Client(timeout=timeout, follow_redirects=False) as client:
            try:
                resp = client.get(url)
            except httpx.HTTPError as e:
                last_exc = e
                break

            # 处理重定向：逐步校验每个跳转目标
            if 300 <= resp.status_code < 400 and resp.headers.get("location"):
                location = resp.headers["location"]
                if location.startswith("/"):
                    location = urljoin(url, location)
                if not is_safe_url(location, allowlist=allowlist):
                    raise ValueError("重定向目标未通过 SSRF 安全校验")
                url = location
                continue

            resp.raise_for_status()

            data = b""
            for chunk in resp.iter_bytes(chunk_size=8192):
                data += chunk
                if len(data) > max_bytes:
                    raise ValueError("响应体超过大小上限")
            return data

    if last_exc is not None:
        raise last_exc
    raise ValueError("重定向次数过多或无法获取响应")
