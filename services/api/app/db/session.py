"""Database session and engine configuration."""
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# 异步引擎（应用运行时使用，asyncpg）
engine = create_async_engine(
    settings.database_url,
    echo=settings.DEBUG,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
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
