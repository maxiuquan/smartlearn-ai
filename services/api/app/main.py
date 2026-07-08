"""
SmartLearn AI - FastAPI 主服务
"""
import logging
import os
import sys

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)


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
    # JWT 密钥强度校验（生产环境 fail-fast）
    try:
        settings.validate_jwt_secret()
    except ValueError as exc:
        if settings.is_production:
            logger.error("❌ 生产环境启动失败（JWT 安全校验未通过）：%s", exc)
            sys.exit(1)
        logger.warning(
            "⚠️  JWT 安全校验未通过（非生产环境仅告警，生产环境将拒绝启动）：%s",
            exc,
        )
    if not settings.DATABASE_URL and settings.DB_PASSWORD == "postgres":
        logger.warning(
            "⚠️  数据库密码使用默认值，生产环境请设置 DATABASE_URL 或 POSTGRES_PASSWORD"
        )
    if not settings.REDIS_URL and settings.REDIS_PASSWORD == "redis":
        logger.warning(
            "⚠️  Redis 密码使用默认值，生产环境请设置 REDIS_URL 或 REDIS_PASSWORD"
        )

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
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由
app.include_router(api_router)


@app.get("/health")
async def health():
    """健康检查端点 - docker-compose healthcheck 依赖"""
    return {
        "status": "ok",
        "service": "smartlearn-api",
        "version": settings.APP_VERSION,
    }


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
        await redis_client.aclose()
        result["checks"]["redis"] = "ok"
    except Exception as e:
        result["checks"]["redis"] = f"error: {e}"
        # Redis 不可用不改变 status,因为有内存降级

    return result


@app.get("/")
async def root():
    return {
        "message": "SmartLearn AI API",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)