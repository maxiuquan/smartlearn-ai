"""
Alembic 环境配置 - PostgreSQL 支持

从 settings.database_url 读取连接串（支持 DATABASE_URL 单一连接串或分散字段）。
使用同步 psycopg2 驱动（与 entrypoint.sh 的 PG 连通性检查一致），避免 asyncpg SSL 问题。
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.models.base import Base

# 导入全部 ORM 模型，使 alembic revision --autogenerate 能检测全部表
import app.models.business  # noqa: F401
import app.models.user  # noqa: F401
import app.models.subscription  # noqa: F401
import app.models.audit_log  # noqa: F401
import app.models.auth_session  # noqa: F401  P0-2
import app.models.content_asset  # noqa: F401  P0-5
import app.models.order  # noqa: F401  P1-4
import app.models.rag_index  # noqa: F401  P1-2

# Alembic Config 对象
config = context.config

# 设置日志
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 从 settings 读取同步数据库 URL（psycopg2 驱动）
config.set_main_option("sqlalchemy.url", settings.database_url_sync)

# 目标元数据 - 用于自动检测模型变更
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """Run migrations with the given connection."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using sync engine (psycopg2)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        do_run_migrations(connection)
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
