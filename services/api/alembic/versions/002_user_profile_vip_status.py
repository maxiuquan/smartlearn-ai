"""Add user profile / vip / status columns to users

Revision ID: 002
Revises: 001
Create Date: 2026-07-05

新增字段支持管理后台「手动改用户权限/角色/VIP/配额/状态」需求。
所有新增列均可空或有默认值，迁移不破坏现有数据。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users 表追加列（管理后台所需）
    op.add_column("users", sa.Column("nickname", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("avatar", sa.String(length=500), nullable=True))
    op.add_column(
        "users",
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
    )
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))
    op.add_column(
        "users",
        sa.Column("vip_level", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("users", sa.Column("vip_expire_at", sa.DateTime(), nullable=True))
    op.add_column(
        "users",
        sa.Column("ai_quota_daily_override", sa.Integer(), nullable=True),
    )

    # 状态索引（admin 列表常按状态筛选）
    op.create_index("ix_users_status", "users", ["status"])
    # VIP 索引（按 VIP 等级筛选）
    op.create_index("ix_users_vip_level", "users", ["vip_level"])

    # audit_logs 表加 actor_id（便于按管理员筛选），保留 actor 字符串字段兼容
    op.add_column(
        "audit_logs",
        sa.Column("actor_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_audit_actor_id", "audit_logs", ["actor_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_actor_id", table_name="audit_logs")
    op.drop_column("audit_logs", "actor_id")

    op.drop_index("ix_users_vip_level", table_name="users")
    op.drop_index("ix_users_status", table_name="users")

    op.drop_column("users", "ai_quota_daily_override")
    op.drop_column("users", "vip_expire_at")
    op.drop_column("users", "vip_level")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "status")
    op.drop_column("users", "avatar")
    op.drop_column("users", "nickname")
