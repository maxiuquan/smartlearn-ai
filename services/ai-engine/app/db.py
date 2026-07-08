"""
AI Engine — asyncpg 数据库连接池模块

提供共享 PostgreSQL 连接池，供 word_games_service / conversation_service
等持久化场景使用。连接串从环境变量 DATABASE_URL 读取（与 api 服务共享同一 PG 实例）。

设计依据：优化设计-2026-07-08 组G（G02/G03）
"""
import logging
from typing import Optional
from urllib.parse import urlparse, parse_qs, urlunparse

import asyncpg

from config import settings

logger = logging.getLogger("ai_engine.db")

_pool: Optional[asyncpg.Pool] = None


def _sanitize_dsn(dsn: str) -> tuple[str, bool]:
    """剥离 asyncpg 不支持的 sslmode 参数,返回 (清理后 dsn, 是否需要 ssl).

    Aiven 等云 PG 给的连接串通常带 ?sslmode=require,
    而 asyncpg 不识别 sslmode 参数,需要在 create_pool(dsn=..., ssl=True) 显式传。
    """
    if "?" not in dsn:
        return dsn, False
    parsed = urlparse(dsn)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    requires_ssl = False
    sslmode_val = qs.pop("sslmode", [])
    if sslmode_val:
        val = sslmode_val[0].lower()
        if val in ("require", "prefer", "verify-ca", "verify-full"):
            requires_ssl = True
    # 重新拼 query
    new_qs = "&".join(f"{k}={v[0]}" for k, v in qs.items())
    new_parsed = parsed._replace(query=new_qs)
    return urlunparse(new_parsed), requires_ssl


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

    # 剥离 sslmode 参数(asyncpg 不支持),改为通过 ssl 参数传递
    dsn, requires_ssl = _sanitize_dsn(dsn)

    logger.info("Creating asyncpg connection pool (ssl=%s) …", requires_ssl)
    pool_kwargs: dict = {
        "min_size": 2,
        "max_size": 10,
        "command_timeout": 30,
    }
    if requires_ssl:
        pool_kwargs["ssl"] = True
    _pool = await asyncpg.create_pool(dsn=dsn, **pool_kwargs)
    logger.info("asyncpg pool created successfully.")
    return _pool


async def close_pool() -> None:
    """优雅关闭连接池（应用停机时调用）。"""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("asyncpg pool closed.")
