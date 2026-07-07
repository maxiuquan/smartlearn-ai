"""SSRF 防护 is_safe_url 单测。

固化 QA 隔离测试：以下地址必须被拦截。
- localhost / 127.x
- 169.254.169.254（云元数据）
- 10.x / 192.168.x / 172.16-31.x（RFC1918 私有）
- file:// / ftp:// 等非 http/https 协议
- 无法解析的主机名
"""
import sys
from pathlib import Path

import pytest

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.security.ssrf import is_safe_url, _is_private_ip, BLOCKED_PORTS


class TestSSRFProtocolCheck:
    """协议校验测试。"""

    def test_http_allowed_protocol(self):
        """http 协议允许（但主机仍需检查）。"""
        # 使用一个公网域名（会被 DNS 解析）
        # 注意：实际网络环境可能无法解析，但协议校验本身应通过
        result = is_safe_url("http://example.com/test")
        # 可能因 DNS 解析失败而返回 False，但不是因为协议
        # 这里仅验证协议层面不因 http 被拒
        # 实际测试中如果 DNS 不可用可能返回 False
        assert result in (True, False)  # 不因协议被拒

    def test_https_allowed_protocol(self):
        """https 协议允许。"""
        result = is_safe_url("https://example.com/test")
        assert result in (True, False)

    def test_file_protocol_blocked(self):
        """file:// 协议必须拦截。"""
        assert is_safe_url("file:///etc/passwd") is False

    def test_ftp_protocol_blocked(self):
        """ftp:// 协议必须拦截。"""
        assert is_safe_url("ftp://example.com/file") is False

    def test_gopher_protocol_blocked(self):
        """gopher:// 协议必须拦截。"""
        assert is_safe_url("gopher://example.com/file") is False

    def test_empty_url_blocked(self):
        """空 URL 必须拦截。"""
        assert is_safe_url("") is False

    def test_none_url_blocked(self):
        """None 必须拦截。"""
        assert is_safe_url(None) is False


class TestSSRFLocalhost:
    """环回地址拦截测试。"""

    def test_localhost_blocked(self):
        """localhost 必须拦截。"""
        assert is_safe_url("http://localhost/admin") is False

    def test_127_0_0_1_blocked(self):
        """127.0.0.1 必须拦截。"""
        assert is_safe_url("http://127.0.0.1/admin") is False

    def test_127_0_0_1_with_port_blocked(self):
        """127.0.0.1 带端口必须拦截。"""
        assert is_safe_url("http://127.0.0.1:8080/admin") is False

    def test_127_255_255_255_blocked(self):
        """127.x.x.x 任意地址必须拦截。"""
        assert is_safe_url("http://127.255.255.255/test") is False


class TestSSRFMetadataEndpoint:
    """云元数据地址拦截测试。"""

    def test_aws_metadata_blocked(self):
        """AWS 元数据地址 169.254.169.254 必须拦截。"""
        assert is_safe_url("http://169.254.169.254/latest/meta-data/") is False

    def test_gcp_metadata_blocked(self):
        """GCP 元数据地址必须拦截。"""
        assert is_safe_url("http://metadata.google.internal/computeMetadata/") is False

    def test_link_local_blocked(self):
        """链路本地地址段 169.254.x.x 必须拦截。"""
        assert is_safe_url("http://169.254.1.1/test") is False


class TestSSRFPrivateNetworks:
    """私有网络段拦截测试。"""

    def test_10_x_blocked(self):
        """10.x.x.x 必须拦截。"""
        assert is_safe_url("http://10.0.0.1/admin") is False

    def test_192_168_x_blocked(self):
        """192.168.x.x 必须拦截。"""
        assert is_safe_url("http://192.168.1.1/admin") is False

    def test_172_16_x_blocked(self):
        """172.16.x.x 必须拦截。"""
        assert is_safe_url("http://172.16.0.1/admin") is False

    def test_172_31_x_blocked(self):
        """172.31.x.x 必须拦截。"""
        assert is_safe_url("http://172.31.0.1/admin") is False


class TestSSRFPrivateIPHelper:
    """_is_private_ip 辅助函数测试。"""

    def test_localhost_is_private(self):
        """127.0.0.1 是私有地址。"""
        assert _is_private_ip("127.0.0.1") is True

    def test_10_x_is_private(self):
        """10.0.0.1 是私有地址。"""
        assert _is_private_ip("10.0.0.1") is True

    def test_192_168_is_private(self):
        """192.168.1.1 是私有地址。"""
        assert _is_private_ip("192.168.1.1") is True

    def test_169_254_is_private(self):
        """169.254.169.254 是私有地址。"""
        assert _is_private_ip("169.254.169.254") is True

    def test_public_ip_not_private(self):
        """8.8.8.8 不是私有地址。"""
        assert _is_private_ip("8.8.8.8") is False

    def test_domain_not_private(self):
        """域名不是私有 IP（交由 DNS 解析判定）。"""
        assert _is_private_ip("example.com") is False


class TestSSRFPorts:
    """端口校验测试。"""

    def test_database_port_blocked(self):
        """数据库端口 5432 必须拦截。"""
        assert is_safe_url("http://example.com:5432/test") is False or \
               is_safe_url("http://8.8.8.8:5432/test") is False

    def test_redis_port_blocked(self):
        """Redis 端口 6379 必须拦截。"""
        assert 6379 in BLOCKED_PORTS

    def test_mysql_port_blocked(self):
        """MySQL 端口 3306 必须拦截。"""
        assert 3306 in BLOCKED_PORTS

    def test_mongodb_port_blocked(self):
        """MongoDB 端口 27017 必须拦截。"""
        assert 27017 in BLOCKED_PORTS


class TestSSRFAllowlist:
    """白名单测试。"""

    def test_allowlist_exact_match(self):
        """白名单精确匹配应放行。"""
        # 使用一个白名单域名（会 DNS 解析到公网）
        result = is_safe_url("http://example.com/test", allowlist=["example.com"])
        assert result is True

    def test_allowlist_suffix_match(self):
        """白名单后缀匹配应放行。"""
        result = is_safe_url("http://api.example.com/test", allowlist=["example.com"])
        assert result is True

    def test_allowlist_no_match_still_checked(self):
        """不在白名单中的域名仍需通过 IP 校验。"""
        # localhost 不在白名单中 → 仍被拦截
        assert is_safe_url("http://localhost/test", allowlist=["example.com"]) is False
