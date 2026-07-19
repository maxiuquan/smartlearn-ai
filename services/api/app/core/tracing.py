"""OpenTelemetry tracing 配置。

提供：
- setup_tracing(app, service_name, environment)：初始化 tracer，自动 instrument FastAPI/SQLAlchemy/Redis/httpx
- get_tracer()：获取全局 tracer

环境变量：
- OTEL_EXPORTER_OTLP_ENDPOINT：生产环境 OTLP endpoint（如 http://otel-collector:4317）
- OTEL_SERVICE_NAME：服务名（缺省 service_name 参数）
- OTEL_TRACES_EXPORTER：console / otlp（缺省 console）

设计要点：
- 未安装 opentelemetry 时降级为 no-op，不阻塞应用启动
- 开发环境默认 console exporter（直接打到 stdout，便于调试）
- 生产环境若未配 OTEL_EXPORTER_OTLP_ENDPOINT，自动回退到 console
- resource 包含 service.name / service.version / deployment.environment
"""
from __future__ import annotations

import os
from typing import Any, Optional

from app.core.logging import get_logger

_log = get_logger(__name__)

# ---------------------------------------------------------------------------
# 运行时检测 OpenTelemetry 是否可用
# ---------------------------------------------------------------------------
try:
    from opentelemetry import trace  # type: ignore
    from opentelemetry.sdk.resources import Resource  # type: ignore
    from opentelemetry.sdk.trace import TracerProvider  # type: ignore
    from opentelemetry.sdk.trace.export import (  # type: ignore
        BatchSpanProcessor,
        ConsoleSpanExporter,
        SimpleSpanProcessor,
    )
    _HAS_OTEL = True
except ImportError:  # pragma: no cover - 降级路径
    trace = None  # type: ignore
    _HAS_OTEL = False

# 全局 tracer 句柄
_tracer: Any = None
_provider: Any = None


def _build_resource(service_name: str, environment: str, version: str) -> Any:
    """构建 OTel Resource（服务标识 + 环境 + 版本）。"""
    return Resource.create(
        {
            "service.name": service_name,
            "service.version": version,
            "deployment.environment": environment,
            "host.name": os.environ.get("HOSTNAME", "unknown"),
            # SDK 语言 + 运行时
            "telemetry.sdk.language": "python",
            "telemetry.sdk.name": "opentelemetry",
        }
    )


def _build_exporter(environment: str) -> Any:
    """构建 span exporter：生产用 OTLP（缺省回退 console），开发用 console。"""
    env_lower = (environment or "development").strip().lower()
    is_prod = env_lower in ("production", "prod")

    otlp_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    exporter_kind = os.environ.get("OTEL_TRACES_EXPORTER", "").strip().lower()

    if is_prod or exporter_kind == "otlp":
        if not otlp_endpoint:
            _log.warning(
                "tracing.otlp_endpoint_missing",
                msg="生产环境但未配置 OTEL_EXPORTER_OTLP_ENDPOINT，回退到 console exporter",
            )
            return ConsoleSpanExporter()
        try:
            # 优先用 gRPC（4317），失败回退 HTTP（4318）
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (  # type: ignore
                OTLPSpanExporter as _OtlpGrpc,
            )
            return _OtlpGrpc(endpoint=otlp_endpoint, insecure=True)
        except ImportError:
            try:
                from opentelemetry.exporter.otlp.proto.http.trace_exporter import (  # type: ignore
                    OTLPSpanExporter as _OtlpHttp,
                )
                return _OtlpHttp(endpoint=otlp_endpoint)
            except ImportError:
                _log.warning(
                    "tracing.otlp_exporter_unavailable",
                    msg="OTLP exporter 未安装，回退到 console",
                )
                return ConsoleSpanExporter()

    # 开发环境 / 未指定 exporter：console
    return ConsoleSpanExporter()


def _instrument_fastapi(app: Any) -> None:
    """自动 instrument FastAPI 应用。"""
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor  # type: ignore
        FastAPIInstrumentor.instrument_app(app)
        _log.info("tracing.instrumented", framework="fastapi")
    except ImportError:
        _log.warning("tracing.instrument_skipped", framework="fastapi", reason="package missing")
    except Exception as exc:  # pragma: no cover - 防御性
        _log.warning("tracing.instrument_failed", framework="fastapi", error=str(exc))


def _instrument_sqlalchemy() -> None:
    """自动 instrument SQLAlchemy 引擎。"""
    try:
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor  # type: ignore
        from app.db.session import engine as _async_engine, sync_engine as _sync_engine
        # 异步引擎通过 sync_engine 暴露底层 engine 给 instrumentor
        engines: list = []
        try:
            engines.append(_sync_engine)
        except Exception:  # pragma: no cover
            pass
        # 异步引擎 instrument 需要拿底层 engine（2.0 已支持 .sync_engine）
        try:
            engines.append(_async_engine.sync_engine)  # type: ignore[attr-defined]
        except Exception:
            # 若 sync_engine 不可访问，跳过（不影响主流程）
            pass
        for eng in engines:
            SQLAlchemyInstrumentor.instrument(engine=eng)
        _log.info("tracing.instrumented", framework="sqlalchemy", engine_count=len(engines))
    except ImportError:
        _log.warning("tracing.instrument_skipped", framework="sqlalchemy", reason="package missing")
    except Exception as exc:  # pragma: no cover - 防御性
        _log.warning("tracing.instrument_failed", framework="sqlalchemy", error=str(exc))


def _instrument_redis() -> None:
    """自动 instrument redis-py（同步 + 异步）。"""
    try:
        from opentelemetry.instrumentation.redis import RedisInstrumentor  # type: ignore
        RedisInstrumentor.instrument()
        _log.info("tracing.instrumented", framework="redis")
    except ImportError:
        _log.warning("tracing.instrument_skipped", framework="redis", reason="package missing")
    except Exception as exc:  # pragma: no cover - 防御性
        _log.warning("tracing.instrument_failed", framework="redis", error=str(exc))


def _instrument_httpx() -> None:
    """自动 instrument httpx（出站 HTTP 客户端）。"""
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor  # type: ignore
        HTTPXClientInstrumentor.instrument()
        _log.info("tracing.instrumented", framework="httpx")
    except ImportError:
        _log.warning("tracing.instrument_skipped", framework="httpx", reason="package missing")
    except Exception as exc:  # pragma: no cover - 防御性
        _log.warning("tracing.instrument_failed", framework="httpx", error=str(exc))


def setup_tracing(app: Any, service_name: str, environment: str) -> None:
    """初始化 OpenTelemetry tracing。

    Args:
        app: FastAPI 应用实例
        service_name: 服务名（如 "smartlearn-api"）
        environment: 环境标识（"production" / "development"）
    """
    global _tracer, _provider

    if not _HAS_OTEL:
        _log.warning("opentelemetry 未安装，tracing 不可用（应用可正常启动）")
        return

    # 已初始化过则不重复（HMR / reload 场景）
    if _provider is not None:
        _log.debug("tracing.already_initialized", service=service_name)
        return

    # 服务名优先取环境变量，回退到参数
    final_service_name = os.environ.get("OTEL_SERVICE_NAME", service_name)
    version = os.environ.get("APP_VERSION", "1.0.0")
    env_lower = (environment or "development").strip().lower()

    try:
        resource = _build_resource(final_service_name, env_lower, version)
        provider = TracerProvider(resource=resource)

        exporter = _build_exporter(env_lower)
        # 生产用 BatchSpanProcessor（异步聚合，不阻塞请求）；
        # 开发用 SimpleSpanProcessor（同步，便于即时看到 span）
        env_is_prod = env_lower in ("production", "prod")
        processor = (
            BatchSpanProcessor(exporter) if env_is_prod else SimpleSpanProcessor(exporter)
        )
        provider.add_span_processor(processor)

        trace.set_tracer_provider(provider)
        _provider = provider
        _tracer = trace.get_tracer(final_service_name)

        _log.info(
            "tracing.initialized",
            service=final_service_name,
            environment=env_lower,
            exporter=type(exporter).__name__,
            processor=type(processor).__name__,
        )

        # 自动 instrumentation —— FastAPI 必须先 instrument（注册 hooks）
        _instrument_fastapi(app)
        _instrument_sqlalchemy()
        _instrument_redis()
        _instrument_httpx()

    except Exception as exc:  # pragma: no cover - 防御性
        _log.error("tracing.setup_failed", error=str(exc), exc_info=True)


def get_tracer() -> Any:
    """获取全局 tracer。未初始化时返回 no-op tracer。"""
    if not _HAS_OTEL:
        # 返回标准 logging 的 no-op 替代（None 也行，调用方应处理 None）
        return None
    if _tracer is None:
        # 兜底：用全局 provider 的 tracer
        try:
            return trace.get_tracer("smartlearn-api")
        except Exception:  # pragma: no cover
            return None
    return _tracer


def shutdown_tracing() -> None:
    """应用关闭时调用，flush pending spans。"""
    global _provider
    if _provider is None:
        return
    try:
        _provider.shutdown()  # type: ignore[attr-defined]
        _log.info("tracing.shutdown_ok")
    except Exception as exc:  # pragma: no cover - 防御性
        _log.warning("tracing.shutdown_failed", error=str(exc))
    finally:
        _provider = None


__all__ = ["setup_tracing", "get_tracer", "shutdown_tracing"]
