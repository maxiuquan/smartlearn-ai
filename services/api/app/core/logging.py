"""Structured logging configuration based on structlog.

设计目标：
- 生产环境输出 JSON（便于 ELK/Loki 等采集），开发环境输出彩色 console
- 通过 contextvars 注入 request_id / trace_id / user_id，自动出现在每条日志
- redact 中间件屏蔽密码 / token / 密钥等敏感字段
- 提供 bind_request_context 上下文管理器，便于请求级绑定

未安装 structlog 时降级为标准 logging，不会阻塞应用启动。
"""
from __future__ import annotations

import logging
import os
import sys
from contextvars import ContextVar
from contextlib import contextmanager
from typing import Any, Iterator

# ---------------------------------------------------------------------------
# 上下文变量（contextvars）—— 跨 async 边界传递 request_id / trace_id / user_id
# ---------------------------------------------------------------------------
_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")
_trace_id_ctx: ContextVar[str] = ContextVar("trace_id", default="-")
_user_id_ctx: ContextVar[str] = ContextVar("user_id", default="-")

# 服务标识（启动时由 setup_logging 写入）
_SERVICE_NAME = "smartlearn-api"
_SERVICE_VERSION = "1.0.0"
_ENVIRONMENT = "development"

# 敏感字段黑名单（key 命中以下任一即被 redact）
_SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "passwd",
    "secret",
    "secret_key",
    "api_key",
    "apikey",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "auth",
    "cookie",
    "private_key",
    "credentials",
    "jwt_secret",
    "jwt",
}

# 部分字段名只 redact value 但保留 key 出现（便于排查），值替换为该常量
_REDACTED = "***REDACTED***"

# ---------------------------------------------------------------------------
# 是否启用 structlog（运行时检测）
# ---------------------------------------------------------------------------
try:
    import structlog  # type: ignore
    _HAS_STRUCTLOG = True
except ImportError:  # pragma: no cover - 降级路径
    structlog = None  # type: ignore
    _HAS_STRUCTLOG = False


def _redact_value(value: Any) -> Any:
    """对敏感 value 进行 redact（保留类型骨架）。"""
    if value is None:
        return None
    if isinstance(value, str):
        return _REDACTED
    # 列表/元组逐项 redact
    if isinstance(value, (list, tuple)):
        return [_redact_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _redact_value(v) for k, v in value.items()}
    return _REDACTED


def _redact_processor(_logger, _method_name, event_dict: dict) -> dict:
    """structlog processor：递归 redact 敏感字段。"""
    def _walk(obj: Any) -> Any:
        if isinstance(obj, dict):
            out: dict = {}
            for k, v in obj.items():
                if isinstance(k, str) and k.lower() in _SENSITIVE_KEYS:
                    out[k] = _redact_value(v)
                else:
                    out[k] = _walk(v)
            return out
        if isinstance(obj, list):
            return [_walk(v) for v in obj]
        return obj
    return _walk(event_dict)  # type: ignore[return-value]


def _inject_context_processor(_logger, _method_name, event_dict: dict) -> dict:
    """structlog processor：注入 request_id / trace_id / user_id / 服务标识。"""
    event_dict.setdefault("request_id", _request_id_ctx.get())
    event_dict.setdefault("trace_id", _trace_id_ctx.get())
    event_dict.setdefault("user_id", _user_id_ctx.get())
    event_dict.setdefault("service", _SERVICE_NAME)
    event_dict.setdefault("version", _SERVICE_VERSION)
    event_dict.setdefault("environment", _ENVIRONMENT)
    return event_dict


def setup_logging(environment: str = "development") -> None:
    """初始化全局结构化日志。

    Args:
        environment: "production" / "prod" 视为生产（JSON 输出），其余为开发（console）。
    """
    global _SERVICE_NAME, _SERVICE_VERSION, _ENVIRONMENT

    env_lower = (environment or "development").strip().lower()
    is_prod = env_lower in ("production", "prod")
    _ENVIRONMENT = env_lower

    # 服务版本来自环境变量（CI 注入 Git SHA），缺省 1.0.0
    _SERVICE_VERSION = os.environ.get("APP_VERSION", "1.0.0")
    _SERVICE_NAME = os.environ.get("SERVICE_NAME", "smartlearn-api")

    # 同步配置标准 logging（structlog 走 stdlib 渲染时依赖 root logger）
    log_level = logging.DEBUG if not is_prod else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(message)s",
        stream=sys.stdout,
        force=True,
    )
    # 降低第三方库噪声
    for noisy in ("uvicorn.access", "uvicorn.error", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING if is_prod else logging.INFO)

    if not _HAS_STRUCTLOG:
        # 降级路径：只调整 root logger 级别即可
        logging.getLogger().warning(
            "structlog 未安装，降级为标准 logging；建议安装 structlog 以启用结构化日志"
        )
        return

    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        # 兼容标准 logging 的 %-style 格式化：logger.warning("msg %s", val) → "msg val"
        # 必须放在 add_log_level 之前，确保 event 字段已格式化
        structlog.processors.PositionalArgumentsFormatter(),
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        _inject_context_processor,
        _redact_processor,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if is_prod:
        # 生产：JSON 输出
        renderer = structlog.processors.JSONRenderer(ensure_ascii=False)
    else:
        # 开发：彩色 console
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=shared_processors + [renderer],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    # 让 stdlib logging 也走 structlog 渲染（uvicorn / sqlalchemy 的日志也能结构化）
    try:
        structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=shared_processors,
            processor=renderer,
        )
    except Exception:
        # 降级：不接管 stdlib，仅 structlog 自身可用
        pass

    get_logger().info(
        "logging.initialized",
        environment=env_lower,
        renderer="json" if is_prod else "console",
        service=_SERVICE_NAME,
        version=_SERVICE_VERSION,
    )


def get_logger(name: str | None = None) -> Any:
    """获取一个 structlog logger。

    未安装 structlog 时退回标准 logging.Logger。
    """
    if _HAS_STRUCTLOG:
        return structlog.get_logger(name) if name else structlog.get_logger()
    return logging.getLogger(name or "smartlearn")


# ---------------------------------------------------------------------------
# 请求上下文绑定：bind_request_context
# ---------------------------------------------------------------------------
@contextmanager
def bind_request_context(
    request_id: str | None = None,
    trace_id: str | None = None,
    user_id: str | None = None,
) -> Iterator[None]:
    """在 contextvars 中绑定请求级字段，作用域结束时自动还原。

    用法::

        with bind_request_context(request_id=rid, user_id=uid):
            log.info("handling request")
    """
    tokens: list = []
    try:
        if request_id is not None:
            tokens.append(_request_id_ctx.set(request_id))
        if trace_id is not None:
            tokens.append(_trace_id_ctx.set(trace_id))
        if user_id is not None:
            tokens.append(_user_id_ctx.set(user_id))
        yield
    finally:
        for token in reversed(tokens):
            # ContextVar.reset 需要原始 Token；这里 tokens 顺序保证 LIFO
            try:
                # mypy: Token 有 reset 方法
                token.reset()  # type: ignore[attr-defined]
            except Exception:
                pass


def set_request_id(value: str) -> None:
    """设置当前上下文的 request_id。"""
    _request_id_ctx.set(value)


def set_trace_id(value: str) -> None:
    """设置当前上下文的 trace_id（来自 OpenTelemetry）。"""
    _trace_id_ctx.set(value)


def set_user_id(value: str | int | None) -> None:
    """设置当前上下文的 user_id。"""
    _user_id_ctx.set(str(value) if value is not None else "-")


def get_request_id() -> str:
    """获取当前上下文的 request_id。"""
    return _request_id_ctx.get()


def get_trace_id() -> str:
    """获取当前上下文的 trace_id。"""
    return _trace_id_ctx.get()


def get_user_id() -> str:
    """获取当前上下文的 user_id。"""
    return _user_id_ctx.get()
