"""
SmartLearn AI - FastAPI 主服务
"""
import logging
import os
import sys
import time

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import settings
# P1-5 可观测性：结构化日志 / 指标 / 链路追踪
from app.core.logging import get_logger as _get_structlog_logger
from app.core.logging import setup_logging

# 在创建任何 logger / FastAPI 实例之前完成日志初始化，确保所有后续日志结构化
setup_logging(settings.ENVIRONMENT)

logger = _get_structlog_logger(__name__)

# 应用启动时间戳（用于 /health 计算 uptime）
_APP_START_EPOCH: float = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理 - 启动时安全检查和 Celery 初始化"""
    # 启动时安全校验
    _startup_security_check()

    # 初始化 Celery（确保任务模块已加载；HF 单容器部署时无 Celery Worker/Beat，
    # 此处仅加载模块定义，不实际消费任务）
    try:
        from app.celery_app import celery_app
        logger.info("Celery 应用已初始化（定义加载，未启动 worker）")
    except Exception as e:
        logger.warning(f"Celery 初始化失败（非关键）: {e}")

    # 初始化 APScheduler（HF 部署用 APScheduler 替代 Celery Beat 跑定时任务）
    try:
        from app.tasks.apscheduler_setup import start_scheduler, shutdown_scheduler
        start_scheduler()
        logger.info("APScheduler 已启动（定时任务运行中）")
    except Exception as e:
        logger.warning(f"APScheduler 启动失败（非关键，定时任务不可用）: {e}")

    yield

    # 关闭时清理
    try:
        from app.tasks.apscheduler_setup import shutdown_scheduler
        shutdown_scheduler()
    except Exception:
        pass
    logger.info("应用正在关闭...")


def _startup_security_check() -> None:
    """启动时安全检查（可选模块未配置只 warning，不阻塞启动）"""
    # 生产环境 fail-fast：全面安全校验
    if settings.is_production:
        try:
            settings.validate_production()
        except ValueError as exc:
            logger.error("❌ 生产环境启动失败（安全校验未通过）：%s", exc)
            sys.exit(1)
        logger.info("✅ 生产环境安全校验通过")
    else:
        # 非生产环境：JWT 校验仅 warning
        try:
            settings.validate_jwt_secret()
        except ValueError as exc:
            logger.warning(
                "⚠️  JWT 安全校验未通过（非生产环境仅告警，生产环境将拒绝启动）：%s",
                exc,
            )
        if not settings.DATABASE_URL and not settings.DB_PASSWORD:
            logger.warning("⚠️  数据库密码未设置，请配置 DATABASE_URL 或 DB_PASSWORD")
        if not settings.REDIS_URL and not settings.REDIS_PASSWORD:
            logger.warning("⚠️  Redis 密码未设置，生产环境请配置 REDIS_URL 或 REDIS_PASSWORD")

    # 可选第三方服务状态提示（不阻塞启动）
    if not settings.is_ai_enabled:
        logger.warning(
            "⚠️  未配置任何 AI 供应商 API Key（GLM/DeepSeek/SiliconFlow/CogView），"
            "AI 相关功能将不可用"
        )
    else:
        ai_providers = []
        if settings.is_glm_enabled:
            ai_providers.append("GLM")
        if settings.is_deepseek_enabled:
            ai_providers.append("DeepSeek")
        if settings.is_siliconflow_enabled:
            ai_providers.append("SiliconFlow")
        if settings.is_cogview_enabled:
            ai_providers.append("CogView")
        logger.info("✅ AI 供应商已配置：%s", "、".join(ai_providers))

    optional_status = [
        ("对象存储 OSS", settings.is_oss_enabled),
        ("微信支付", settings.is_wechat_pay_enabled),
        ("支付宝", settings.is_alipay_enabled),
        ("短信服务", settings.is_sms_enabled),
        ("邮件服务", settings.is_email_enabled),
    ]
    disabled = [name for name, enabled in optional_status if not enabled]
    if disabled:
        logger.info(
            "ℹ️  以下可选功能未配置（应用正常启动，对应功能将不可用）：%s",
            "、".join(disabled),
        )
    else:
        logger.info("✅ 所有可选第三方服务均已配置")


app = FastAPI(
    title=settings.APP_NAME,
    description="智能学习平台 API 服务",
    version=settings.APP_VERSION,
    # P0-4: 生产环境关闭 OpenAPI/Swagger/ReDoc，防止接口结构泄露
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    lifespan=lifespan,
)

# 限流中间件（slowapi）
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from fastapi import Request


    def _get_forwarded_ip(request: Request) -> str:
        """从 X-Forwarded-For 或 X-Real-IP 获取真实客户端 IP."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        return request.client.host if request.client else "unknown"


    limiter = Limiter(key_func=_get_forwarded_ip, enabled=True)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
except ImportError:
    logger.warning("slowapi 未安装，登录/注册限流不可用")

# CORS
# P0-01: allow_credentials=True 需要显式指定 allow_origins（不能用 *）
# P1-04: 显式列出允许的方法和头，不用通配符
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Api-Key"],
)

# 可观测性中间件（P1-5）
# FastAPI/Starlette 中 add_middleware 是反向 wrap：后注册的更外层。
# 期望请求顺序：RequestContext(最外) → Logging → Metrics → CSRF → CORS → 业务
# 因此注册顺序倒过来：CSRF → Metrics → Logging → RequestContext
from app.middleware import (  # noqa: E402
    CSRFMiddleware,
    LoggingMiddleware,
    MetricsMiddleware,
    RequestContextMiddleware,
)

# P1-4.1: CSRF Origin 校验中间件
# 与 SameSite Cookie 配合，纵深防御跨站点请求
app.add_middleware(CSRFMiddleware, allowed_origins=settings.cors_origins_list)

app.add_middleware(MetricsMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RequestContextMiddleware)

# 注册 API 路由
app.include_router(api_router)

# ---------------------------------------------------------------------------
# P1-1 统一异常处理（标准化 JSON 错误响应 + 错误码）
# ---------------------------------------------------------------------------
try:
    from app.core.exception_handler import register_exception_handlers

    register_exception_handlers(app)
except Exception as exc:  # pragma: no cover
    logger.warning("exception_handlers_setup_failed", error=str(exc))

# ---------------------------------------------------------------------------
# P1-5 可观测性：/metrics 端点 + OpenTelemetry tracing
# ---------------------------------------------------------------------------
# 注意：FastAPIInstrumentor.instrument_app 必须在路由注册之后调用，
#       因此 setup_tracing 放在 include_router 之后
try:
    from app.core.metrics import get_metrics_asgi_app
    from app.core.tracing import setup_tracing as _setup_tracing

    _metrics_app = get_metrics_asgi_app()
    if _metrics_app is not None:
        app.mount("/metrics", _metrics_app)
        logger.info("observability.metrics_endpoint_mounted", path="/metrics")
    else:
        logger.warning("observability.metrics_endpoint_skipped", reason="prometheus_client unavailable")

    _setup_tracing(app, "smartlearn-api", settings.ENVIRONMENT)
except Exception as exc:  # pragma: no cover - 防御性：可观测性失败不阻塞启动
    logger.error("observability.setup_failed", error=str(exc), exc_info=True)


@app.get("/health")
async def health():
    """健康检查端点（增强版）- docker-compose healthcheck 依赖。

    P1-04: 生产环境仅返回最小状态，不暴露 environment/uptime/checks 细节。

    返回字段：
        status: ok / degraded / unhealthy
        service / version / environment / uptime_seconds
        checks:
            database: ok / error: <msg>
            redis:    ok / error: <msg> / disabled
            observability:
                metrics_enabled / tracing_enabled / logging_renderer
    """
    uptime = time.time() - _APP_START_EPOCH
    # P1-04: 生产环境最小化 health 响应
    is_prod = settings.is_production
    result: dict = {
        "status": "ok",
        "service": "smartlearn-api",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": round(uptime, 2),
        "checks": {},
    }

    # ── 数据库连接检查 ──
    try:
        from sqlalchemy import text
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        result["checks"]["database"] = "ok"
    except Exception as e:
        result["checks"]["database"] = f"error: {e}"
        result["status"] = "degraded"

    # ── Redis 连接检查（可选，不可用不影响 health）──
    try:
        import redis.asyncio as aioredis

        redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await redis_client.ping()
        if hasattr(redis_client, "aclose"):
            await redis_client.aclose()
        else:
            await redis_client.close()
        result["checks"]["redis"] = "ok"
    except Exception as e:
        # Redis 不可用不改变 status（有内存降级）
        result["checks"]["redis"] = f"error: {e}"

    # ── 可观测性组件状态 ──
    try:
        from app.core.metrics import _HAS_PROMETHEUS
        from app.core.tracing import _HAS_OTEL

        result["checks"]["observability"] = {
            "metrics_enabled": bool(_HAS_PROMETHEUS),
            "tracing_enabled": bool(_HAS_OTEL),
            "logging_renderer": "json" if settings.is_production else "console",
        }
    except Exception as e:
        result["checks"]["observability"] = f"error: {e}"

    # P1-04: 生产环境最小化响应（仅返回 status + service，不暴露 checks/uptime/environment）
    if is_prod:
        return {
            "status": result["status"],
            "service": result["service"],
        }

    return result


@app.get("/keepalive")
async def keepalive():
    """保活端点 - Upstash Cron 定期 ping,同时保活 HF Space + Aiven PG + Upstash Redis。

    - 不需要鉴权（Upstash Cron 不带 JWT）
    - 查询 PG 确保连接活跃（Aiven 免费档可能因闲置断开）
    - 查询 Redis 确保连接活跃（Upstash 免费档同样有闲置限制）
    - 响应快（<1s），不影响正常请求
    """
    import time

    result = {
        "status": "ok",
        "timestamp": int(time.time()),
        "checks": {},
    }

    # ── 检查 PostgreSQL ──
    try:
        from sqlalchemy import text
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        result["checks"]["postgres"] = "ok"
    except Exception as e:
        result["checks"]["postgres"] = f"error: {e}"
        result["status"] = "degraded"

    # ── 检查 Redis（可选,不可用不影响保活）──
    try:
        import redis.asyncio as aioredis

        redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await redis_client.ping()
        # 兼容 redis-py 不同版本: 新版 aclose(),旧版 close()
        if hasattr(redis_client, "aclose"):
            await redis_client.aclose()
        else:
            await redis_client.close()
        result["checks"]["redis"] = "ok"
    except Exception as e:
        result["checks"]["redis"] = f"error: {e}"
        # Redis 不可用不改变 status,因为有内存降级

    return result


@app.get("/")
async def root():
    # P1-04: 生产环境不暴露 docs 路径
    return {
        "message": "SmartLearn AI API",
        "docs": "/docs" if not settings.is_production else None,
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)