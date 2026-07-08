"""Database session and engine configuration."""
import ssl

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# 异步引擎（应用运行时使用，asyncpg）
# asyncpg 不支持 URL 中的 sslmode 参数，需要在 connect_args 中传 ssl
# (config.database_url 已剥离 sslmode;此处的 ssl 仅在原 URL 含 sslmode=require 时启用)
# 注意: Aiven/Supabase 等云 PG 用自签名 CA 证书,asyncpg 默认会严格验证,
# 这里禁用证书验证(仅加密不验证)以兼容各家云 PG 的自签名证书场景。
async_connect_args: dict = {}
if settings.database_requires_ssl:
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    async_connect_args["ssl"] = ssl_ctx

engine = create_async_engine(
    settings.database_url,
    echo=settings.DEBUG,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args=async_connect_args,
)

async_session_factory = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# 同步引擎（数据导入 / 迁移脚本使用，psycopg2）
# 注意: 仅创建引擎，首次连接时才真正建立连接，导入模块本身不会连库。
sync_engine = create_engine(
    settings.database_url_sync,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    bind=sync_engine,
    autoflush=False,
    autocommit=False,
    future=True,
)
