"""Prometheus 指标定义与采集。

提供：
- HTTP / DB / Redis / AI / 支付 5 类业务指标（Counter / Histogram / Gauge）
- record_http_request 便捷函数（供 MetricsMiddleware 调用）
- /metrics ASGI 子应用（由 main.py 挂载）

设计要点：
- prometheus_client 在单进程模式下足够；多进程（gunicorn -w N）需启用
  PROMETHEUS_MULTIPROC_DIR，启动时由 make_asgi_app 自动聚合
- 所有指标定义在模块导入时一次性创建，避免重复注册抛错
- Counter 的 `.inc()` / Histogram 的 `.observe()` 自带异常吞没，不会拖垮请求
"""
from __future__ import annotations

import os
import time
from typing import Optional

try:
    from prometheus_client import (
        Counter,
        Gauge,
        Histogram,
        CollectorRegistry,
        REGISTRY as _DEFAULT_REGISTRY,
        make_asgi_app,
        generate_latest,
        CONTENT_TYPE_LATEST,
    )
    _HAS_PROMETHEUS = True
except ImportError:  # pragma: no cover - 降级路径
    _HAS_PROMETHEUS = False

from app.core.logging import get_logger

_log = get_logger(__name__)

# ---------------------------------------------------------------------------
# Registry：多进程模式下使用独立 Registry，避免冲突
# ---------------------------------------------------------------------------
if _HAS_PROMETHEUS:
    # 单进程：用默认全局 REGISTRY；多进程：每个 worker 写文件由 make_asgi_app 聚合
    _MULTIPROC_DIR = os.environ.get("PROMETHEUS_MULTIPROC_DIR")
    _registry: "CollectorRegistry" = _DEFAULT_REGISTRY if not _MULTIPROC_DIR else CollectorRegistry()
else:
    _registry = None  # type: ignore[assignment]


def _counter(name: str, documentation: str, labelnames: tuple = ()) -> Optional["Counter"]:
    if not _HAS_PROMETHEUS:
        return None
    try:
        return Counter(name, documentation, labelnames=labelnames, registry=_registry)
    except ValueError:
        # 已注册（热重载场景）—— 退回查表
        try:
            return _registry._names_to_collectors[name]  # type: ignore[union-attr]
        except Exception:  # pragma: no cover
            return None


def _histogram(
    name: str,
    documentation: str,
    labelnames: tuple = (),
    buckets: Optional[tuple] = None,
) -> Optional["Histogram"]:
    if not _HAS_PROMETHEUS:
        return None
    try:
        kwargs: dict = {"registry": _registry}
        if buckets is not None:
            kwargs["buckets"] = buckets
        return Histogram(name, documentation, labelnames=labelnames, **kwargs)
    except ValueError:
        try:
            return _registry._names_to_collectors[name]  # type: ignore[union-attr]
        except Exception:  # pragma: no cover
            return None


def _gauge(name: str, documentation: str, labelnames: tuple = ()) -> Optional["Gauge"]:
    if not _HAS_PROMETHEUS:
        return None
    try:
        return Gauge(name, documentation, labelnames=labelnames, registry=_registry)
    except ValueError:
        try:
            return _registry._names_to_collectors[name]  # type: ignore[union-attr]
        except Exception:  # pragma: no cover
            return None


# ---------------------------------------------------------------------------
# HTTP 指标
# ---------------------------------------------------------------------------
http_requests_total: Optional[Counter] = _counter(
    "http_requests_total",
    "Total HTTP requests by method/path/status",
    labelnames=("method", "path", "status"),
)

http_request_duration_seconds: Optional[Histogram] = _histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds by method/path",
    labelnames=("method", "path"),
    buckets=(
        0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
    ),
)

# ---------------------------------------------------------------------------
# 数据库指标
# ---------------------------------------------------------------------------
db_connections_active: Optional[Gauge] = _gauge(
    "db_connections_active",
    "Active DB connections (checked-in to sessions)",
)

db_query_duration_seconds: Optional[Histogram] = _histogram(
    "db_query_duration_seconds",
    "Database query latency in seconds by operation",
    labelnames=("operation",),
    buckets=(
        0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0,
    ),
)

# ---------------------------------------------------------------------------
# Redis 指标
# ---------------------------------------------------------------------------
redis_operations_total: Optional[Counter] = _counter(
    "redis_operations_total",
    "Total Redis operations by type and status",
    labelnames=("operation", "status"),
)

# ---------------------------------------------------------------------------
# AI 指标
# ---------------------------------------------------------------------------
ai_requests_total: Optional[Counter] = _counter(
    "ai_requests_total",
    "Total AI service requests by provider/model/status",
    labelnames=("provider", "model", "status"),
)

ai_request_duration_seconds: Optional[Histogram] = _histogram(
    "ai_request_duration_seconds",
    "AI service request latency in seconds by provider",
    labelnames=("provider",),
    buckets=(
        0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0,
    ),
)

ai_tokens_used_total: Optional[Counter] = _counter(
    "ai_tokens_used_total",
    "Total AI tokens used by provider and type (prompt/completion)",
    labelnames=("provider", "type"),
)

ai_cost_usd_total: Optional[Counter] = _counter(
    "ai_cost_usd_total",
    "Total AI cost in USD by provider",
    labelnames=("provider",),
)

# ---------------------------------------------------------------------------
# 支付指标
# ---------------------------------------------------------------------------
payment_callbacks_total: Optional[Counter] = _counter(
    "payment_callbacks_total",
    "Total payment callback events by channel and status",
    labelnames=("channel", "status"),
)

payment_amount_total: Optional[Counter] = _counter(
    "payment_amount_total",
    "Total payment amount by channel and currency (in minor unit)",
    labelnames=("channel", "currency"),
)


# ---------------------------------------------------------------------------
# 便捷函数
# ---------------------------------------------------------------------------
def record_http_request(method: str, path: str, status: int, duration: float) -> None:
    """记录一次 HTTP 请求（供 MetricsMiddleware 调用）。

    Args:
        method: HTTP 方法（GET/POST/...）
        path: 归一化后的路径（路由模板，避免 cardinality 爆炸）
        status: HTTP 状态码
        duration: 耗时秒（float）
    """
    if not _HAS_PROMETHEUS:
        return
    try:
        if http_requests_total is not None:
            http_requests_total.labels(method=method, path=path, status=str(status)).inc()
        if http_request_duration_seconds is not None:
            http_request_duration_seconds.labels(method=method, path=path).observe(duration)
    except Exception as exc:  # pragma: no cover - 防御性
        _log.warning("metrics.record_http_request_failed", error=str(exc))


def record_db_query(operation: str, duration: float) -> None:
    """记录一次 DB 查询耗时。"""
    if not _HAS_PROMETHEUS:
        return
    try:
        if db_query_duration_seconds is not None:
            db_query_duration_seconds.labels(operation=operation).observe(duration)
    except Exception as exc:  # pragma: no cover
        _log.warning("metrics.record_db_query_failed", error=str(exc))


def set_db_connections_active(value: int) -> None:
    """更新当前活跃 DB 连接数。"""
    if not _HAS_PROMETHEUS or db_connections_active is None:
        return
    try:
        db_connections_active.set(value)
    except Exception as exc:  # pragma: no cover
        _log.warning("metrics.set_db_connections_failed", error=str(exc))


def record_redis_op(operation: str, status: str = "ok") -> None:
    """记录一次 Redis 操作。"""
    if not _HAS_PROMETHEUS or redis_operations_total is None:
        return
    try:
        redis_operations_total.labels(operation=operation, status=status).inc()
    except Exception as exc:  # pragma: no cover
        _log.warning("metrics.record_redis_op_failed", error=str(exc))


def record_ai_request(provider: str, model: str, status: str, duration: float) -> None:
    """记录一次 AI 服务请求。"""
    if not _HAS_PROMETHEUS:
        return
    try:
        if ai_requests_total is not None:
            ai_requests_total.labels(provider=provider, model=model, status=status).inc()
        if ai_request_duration_seconds is not None:
            ai_request_duration_seconds.labels(provider=provider).observe(duration)
    except Exception as exc:  # pragma: no cover
        _log.warning("metrics.record_ai_request_failed", error=str(exc))


def record_ai_tokens(provider: str, token_type: str, count: int) -> None:
    """记录 AI token 消耗。

    Args:
        provider: glm/deepseek/siliconflow/cogview/openai
        token_type: prompt / completion
        count: token 数量
    """
    if not _HAS_PROMETHEUS or ai_tokens_used_total is None:
        return
    try:
        ai_tokens_used_total.labels(provider=provider, type=token_type).inc(count)
    except Exception as exc:  # pragma: no cover
        _log.warning("metrics.record_ai_tokens_failed", error=str(exc))


def record_ai_cost(provider: str, cost_usd: float) -> None:
    """记录 AI 成本（USD）。"""
    if not _HAS_PROMETHEUS or ai_cost_usd_total is None:
        return
    try:
        ai_cost_usd_total.labels(provider=provider).inc(cost_usd)
    except Exception as exc:  # pragma: no cover
        _log.warning("metrics.record_ai_cost_failed", error=str(exc))


def record_payment_callback(channel: str, status: str) -> None:
    """记录一次支付回调。"""
    if not _HAS_PROMETHEUS or payment_callbacks_total is None:
        return
    try:
        payment_callbacks_total.labels(channel=channel, status=status).inc()
    except Exception as exc:  # pragma: no cover
        _log.warning("metrics.record_payment_callback_failed", error=str(exc))


def record_payment_amount(channel: str, currency: str, amount_minor: int) -> None:
    """记录支付金额（minor unit：分为 / cent）。

    用 minor unit 是为了避免浮点累计误差，且便于 Prometheus 处理整数。
    """
    if not _HAS_PROMETHEUS or payment_amount_total is None:
        return
    try:
        payment_amount_total.labels(channel=channel, currency=currency).inc(amount_minor)
    except Exception as exc:  # pragma: no cover
        _log.warning("metrics.record_payment_amount_failed", error=str(exc))


# ---------------------------------------------------------------------------
# /metrics ASGI app & 内容类型
# ---------------------------------------------------------------------------
def get_metrics_asgi_app():
    """返回 prometheus_client 的 ASGI 子应用，由 main.py 挂载到 /metrics。

    未安装 prometheus_client 时返回 None，调用方应判断后跳过挂载。
    """
    if not _HAS_PROMETHEUS:
        _log.warning("prometheus_client 未安装，/metrics 端点不可用")
        return None
    return make_asgi_app(registry=_registry)


def metrics_response_body() -> tuple[bytes, str]:
    """同步导出指标文本（用于非 ASGI 场景或调试）。

    Returns:
        (body_bytes, content_type)
    """
    if not _HAS_PROMETHEUS:
        return b"# prometheus_client not installed\n", "text/plain; charset=utf-8"
    return generate_latest(_registry), CONTENT_TYPE_LATEST


__all__ = [
    "http_requests_total",
    "http_request_duration_seconds",
    "db_connections_active",
    "db_query_duration_seconds",
    "redis_operations_total",
    "ai_requests_total",
    "ai_request_duration_seconds",
    "ai_tokens_used_total",
    "ai_cost_usd_total",
    "payment_callbacks_total",
    "payment_amount_total",
    "record_http_request",
    "record_db_query",
    "set_db_connections_active",
    "record_redis_op",
    "record_ai_request",
    "record_ai_tokens",
    "record_ai_cost",
    "record_payment_callback",
    "record_payment_amount",
    "get_metrics_asgi_app",
    "metrics_response_body",
]
