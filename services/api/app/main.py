"""
SmartLearn AI - FastAPI 主服务
"""
import logging
import os

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

    # 初始化 Celery（确保任务模块已加载）
    try:
        from app.celery_app import celery_app
        logger.info("Celery 应用已初始化")
    except Exception as e:
        logger.warning(f"Celery 初始化失败（非关键）: {e}")

    yield

    # 关闭时清理
    logger.info("应用正在关闭...")


def _startup_security_check() -> None:
    """启动时安全检查（可选模块未配置只 warning，不阻塞启动）"""
    if settings.JWT_SECRET == "change-me-in-production":
        logger.warning(
            "⚠️  JWT_SECRET 使用默认值，生产环境请设置环境变量 JWT_SECRET"
        )
    if settings.DB_PASSWORD == "postgres":
        logger.warning(
            "⚠️  DB_PASSWORD 使用默认值，生产环境请设置环境变量 POSTGRES_PASSWORD"
        )
    if settings.REDIS_PASSWORD == "redis":
        logger.warning(
            "⚠️  REDIS_PASSWORD 使用默认值，生产环境请设置环境变量 REDIS_PASSWORD"
        )

    # 可选第三方服务状态提示（不阻塞启动）
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