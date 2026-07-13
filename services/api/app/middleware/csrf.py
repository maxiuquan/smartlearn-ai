"""
P1-4.1: CSRF Origin 校验中间件

对所有改变状态的请求（POST/PUT/PATCH/DELETE）校验 Origin/Referer 头，
拒绝跨站点请求。这是配合 SameSite Cookie 的纵深防御措施。

设计要点：
- 仅对改变状态的方法做校验（GET/HEAD/OPTIONS 放行）
- 优先用 Origin 头，缺失时退到 Referer
- 允许同源（host 匹配）和受信任的 CORS 域名
- 白名单路径：/health, /keepalive 等不需要 CSRF 保护
- 仅在请求带 Authorization 或 Cookie 时校验（公开端点不强制）
"""
import logging
from typing import Iterable
from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# 不需要 CSRF 校验的路径前缀
_CSRF_EXEMPT_PATHS: tuple[str, ...] = (
    "/health",
    "/keepalive",
    "/api/v1/auth/login",   # 登录前还没有 session
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",  # refresh 自带保护：旧 token 用后即弃
)

# 改变状态的 HTTP 方法
_STATE_CHANGING_METHODS: frozenset[str] = frozenset(
    {"POST", "PUT", "PATCH", "DELETE"}
)


class CSRFMiddleware(BaseHTTPMiddleware):
    """Origin/Referer 校验，防 CSRF。

    与 SameSite Cookie 配合：浏览器会自动拦截跨站点带 Cookie 的请求，
    本中间件作为应用层兜底，校验 Origin/Referer 头。
    """

    def __init__(self, app, allowed_origins: Iterable[str] = None) -> None:
        super().__init__(app)
        # 允许的 Origin 集合（小写、去尾斜杠）
        self._allowed_origins: set[str] = set()
        if allowed_origins:
            for o in allowed_origins:
                self._allowed_origins.add(o.rstrip("/").lower())

    async def dispatch(self, request: Request, call_next):
        method = request.method.upper()
        path = request.url.path

        # 1) 安全方法直接放行
        if method not in _STATE_CHANGING_METHODS:
            return await call_next(request)

        # 2) 白名单路径放行
        if any(path == p or path.startswith(p + "/") for p in _CSRF_EXEMPT_PATHS):
            return await call_next(request)

        # 3) 若无 Cookie 也无 Authorization，CSRF 无意义（公开端点）
        #    但仍校验 Origin，防止跨站滥用公开写入端点
        origin = request.headers.get("origin") or ""
        referer = request.headers.get("referer") or ""

        # 取首选来源
        source = origin or referer
        if not source:
            # 无 Origin/Referer 的状态变更请求 — 浏览器正常会带，缺失视为可疑
            # 但允许非浏览器客户端（curl/SDK），故放行（CORS+JWT 仍保护）
            return await call_next(request)

        # 解析 host
        try:
            parsed = urlparse(source)
            source_host = (parsed.netloc or "").lower()
        except Exception:
            source_host = ""

        # 取请求自身的 host
        request_host = (request.url.netloc or "").lower()

        # 4) 同源放行（host 匹配）
        if source_host and source_host == request_host:
            return await call_next(request)

        # 5) 在允许的 CORS 域名白名单中放行
        if source_host and any(
            source_host == allowed or source_host.endswith("." + allowed)
            for allowed in self._allowed_origins
        ):
            return await call_next(request)

        # 6) 也接受 allowed_origins 中包含完整 scheme://netloc 的形式
        if source.rstrip("/").lower() in self._allowed_origins:
            return await call_next(request)

        # 拒绝：跨站点且不在白名单
        logger.warning(
            "CSRF 中间件拒绝跨站点请求: method=%s path=%s origin=%s referer=%s host=%s",
            method, path, origin, referer, request_host,
        )
        return JSONResponse(
            status_code=403,
            content={
                "detail": "跨站点请求被拒绝（CSRF 保护）",
                "code": "CSRF_ORIGIN_MISMATCH",
            },
        )
