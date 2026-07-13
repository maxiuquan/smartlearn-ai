"""可观测性中间件集合。

包含三个中间件，注册顺序应为（外到内）：
    RequestContextMiddleware → LoggingMiddleware → MetricsMiddleware → 业务

- RequestContextMiddleware：生成/读取 request_id，写入 contextvars + response 头
- LoggingMiddleware：记录请求开始/结束日志（method, path, status, duration_ms, request_id）
- MetricsMiddleware：上报 Prometheus 指标

敏感路径（/auth/login 等）的 request body 不会被记录到日志。
"""
from __future__ import annotations

import time
import uuid
from typing import Awaitable, Callable, Iterable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import (
    bind_request_context,
    get_logger,
    get_request_id,
    set_request_id,
    set_trace_id,
)
from app.core.metrics import record_http_request

_log = get_logger("app.middleware.observability")

# 敏感路径白名单：这些路径的 request body / query 不进日志
SENSITIVE_PATHS: frozenset[str] = frozenset(
    {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/change-password",
        "/api/v1/auth/reset-password",
        "/api/v1/auth/refresh",
        "/api/v1/users/me/password",
        "/api/v1/payment/callback",
        "/api/v1/payment/notify",
    }
)


def _is_sensitive(path: str) -> bool:
    """判断路径是否敏感（精确或前缀匹配）。"""
    if path in SENSITIVE_PATHS:
        return True
    return any(path.startswith(p) for p in SENSITIVE_PATHS)


def _generate_request_id() -> str:
    """生成 request_id（UUID4 hex，无连字符）。"""
    return uuid.uuid4().hex


def _normalize_path(path: str) -> str:
    """归一化路径，避免 cardinality 爆炸。

    将 /users/123 /questions/abc-id 等替换为 /users/{id} /questions/{id}。
    保留 path 第 1-2 段的语义，第 3 段若为纯 hex/数字/UUID 则替换为 {id}。
    """
    if not path or path == "/":
        return "/"
    parts = path.strip("/").split("/")
    if len(parts) <= 2:
        return path
    # 第 3 段及之后若是数字/uuid 形态，归一化
    out = parts[:2]
    for seg in parts[2:]:
        if _looks_like_id(seg):
            out.append("{id}")
        else:
            out.append(seg)
    return "/" + "/".join(out)


def _looks_like_id(s: str) -> bool:
    """判断字符串是否像 ID（数字 / UUID / 长哈希）。"""
    if not s:
        return False
    if s.isdigit():
        return True
    # UUID hex（无连字符，32位）或标准 UUID（带连字符）
    if len(s) in (32, 36) and all(c in "0123456789abcdefABCDEF-" for c in s):
        return True
    # 长 hash（>= 8 位十六进制）
    if len(s) >= 8 and all(c in "0123456789abcdefABCDEF" for c in s):
        return True
    return False


class RequestContextMiddleware(BaseHTTPMiddleware):
    """请求上下文中间件（最外层）。

    - 读取或生成 request_id
    - 将 request_id 写入 contextvars（供日志/指标自动带上）
    - 回写到 response 头 X-Request-ID，便于客户端排查
    - 注入 trace_id（从 OpenTelemetry span context，若有）
    """

    REQUEST_ID_HEADER = "X-Request-ID"

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # 1. 读取或生成 request_id
        request_id = request.headers.get(self.REQUEST_ID_HEADER) or _generate_request_id()

        # 2. 尝试读取 OTel trace_id
        trace_id = ""
        try:
            from opentelemetry import trace as _otel_trace  # type: ignore
            span_ctx = _otel_trace.get_current_span().get_span_context()
            if span_ctx and span_ctx.is_valid:
                trace_id = f"{span_ctx.trace_id:032x}"
        except Exception:
            trace_id = ""

        # 3. 写入 contextvars（作用域内自动出现在日志中）
        with bind_request_context(
            request_id=request_id,
            trace_id=trace_id or "-",
            user_id=None,
        ):
            request.state.request_id = request_id
            if trace_id:
                request.state.trace_id = trace_id

            response = await call_next(request)

            # 4. 回写 response 头
            response.headers[self.REQUEST_ID_HEADER] = request_id
            # 透传 traceparent（W3C）若 OTel 已生成
            try:
                traceparent = request.headers.get("traceparent")
                if traceparent:
                    response.headers["traceparent"] = traceparent
            except Exception:
                pass

            return response


class LoggingMiddleware(BaseHTTPMiddleware):
    """日志中间件。

    记录请求开始 / 结束日志，字段：
        method / path / status / duration_ms / request_id / user_agent / client_ip

    敏感路径不记录 request body。
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        start_ts = time.perf_counter()
        path = request.url.path
        method = request.method
        client_ip = request.client.host if request.client else "-"
        user_agent = request.headers.get("user-agent", "-")
        request_id = get_request_id()
        sensitive = _is_sensitive(path)

        # 请求开始日志
        if sensitive:
            _log.info(
                "http.request.start",
                method=method,
                path=path,
                request_id=request_id,
                client_ip=client_ip,
                user_agent=user_agent,
                body="[redacted]",
            )
        else:
            _log.info(
                "http.request.start",
                method=method,
                path=path,
                request_id=request_id,
                client_ip=client_ip,
                user_agent=user_agent,
            )

        # 执行下游
        status_code = 500
        error_msg: str | None = None
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            _log.error(
                "http.request.error",
                method=method,
                path=path,
                request_id=request_id,
                error=error_msg,
                exc_info=True,
            )
            raise
        finally:
            duration_ms = (time.perf_counter() - start_ts) * 1000.0
            log_event = _log.info if status_code < 500 else _log.error
            extra: dict = {
                "method": method,
                "path": path,
                "status": status_code,
                "duration_ms": round(duration_ms, 2),
                "request_id": request_id,
                "client_ip": client_ip,
            }
            if error_msg:
                extra["error"] = error_msg
            log_event("http.request.end", **extra)


class MetricsMiddleware(BaseHTTPMiddleware):
    """指标中间件（最内层，紧贴业务）。

    上报 http_requests_total / http_request_duration_seconds。
    路径归一化避免 Prometheus label cardinality 爆炸。
    """

    EXEMPT_PATHS: frozenset[str] = frozenset(
        {
            "/metrics",
            "/health",
            "/keepalive",
            "/favicon.ico",
            "/",
        }
    )

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        path = request.url.path
        if path in self.EXEMPT_PATHS:
            return await call_next(request)

        start_ts = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration = time.perf_counter() - start_ts
            normalized = _normalize_path(path)
            try:
                record_http_request(
                    method=request.method,
                    path=normalized,
                    status=status_code,
                    duration=duration,
                )
            except Exception as exc:  # pragma: no cover - 防御性
                _log.warning("metrics.middleware_record_failed", error=str(exc))


def register_observability_middlewares(app) -> None:
    """统一注册可观测性中间件（顺序：RequestContext → Logging → Metrics）。

    FastAPI 中间件执行顺序：后注册的先 wrap（最内层）；要保证 RequestContext 最外层，
    必须最后注册它（这样它最先执行）。

    建议在 main.py 中显式 add_middleware 各自，以便精细控制；这里提供便捷入口。
    """
    # 注册顺序 = 内层到外层（FastAPI 反向 wrap）
    # 想让 RequestContext 最外层 → 最后 add
    app.add_middleware(MetricsMiddleware)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RequestContextMiddleware)


__all__ = [
    "RequestContextMiddleware",
    "LoggingMiddleware",
    "MetricsMiddleware",
    "register_observability_middlewares",
    "SENSITIVE_PATHS",
]
