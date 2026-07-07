"""
AI Engine — asyncpg 数据库连接池模块

提供共享 PostgreSQL 连接池，供 word_games_service / conversation_service
等持久化场景使用。连接串从环境变量 DATABASE_URL 读取（与 api 服务共享同一 PG 实例）。

设计依据：优化设计-2026-07-08 组G（G02/G03）
"""
import logging
from typing import Optional

import asyncpg

from config import settings

logger = logging.getLogger("ai_engine.db")

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """获取（或首次创建）全局 asyncpg 连接池。

    连接串来自 ``settings.DATABASE_URL``。如果未配置则抛出 RuntimeError，
    调用方应捕获并降级（如回退到 JSON 文件加载）。
    """
    global _pool
    if _pool is not None:
        return _pool

    if not settings.DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not configured; "
            "ai-engine DB persistence is unavailable."
        )

    # asyncpg 使用标准 postgresql:// scheme（非 sqlalchemy 的 postgresql+asyncpg://）
    dsn = settings.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql://"
    ).replace("postgresql+psycopg://", "postgresql://")

    logger.info("Creating asyncpg connection pool …")
    _pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    logger.info("asyncpg pool created successfully.")
    return _pool


async def close_pool() -> None:
    """优雅关闭连接池（应用停机时调用）。"""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("asyncpg pool closed.")
