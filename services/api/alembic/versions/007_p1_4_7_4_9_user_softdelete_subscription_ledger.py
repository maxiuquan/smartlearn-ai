"""P1-4.7 / P1-4.9 整改：用户软删除 + 订阅权益账本 + Outbox 索引

Revision ID: 007
Revises: 006
Create Date: 2026-07-13

本次迁移落地 P1-4.7 与 P1-4.9 整改所需的结构变更：
- P1-4.7: users 表新增 deleted_at 列（软删除时间戳）
- P1-4.9: 新建 subscription_ledger 表（不可变权益账本）
- P1-4.9: subscriptions 表新增 partial unique index（每用户仅一条 active）
- P1-4.9: outbox_events 新增 next_retry_at 索引（dispatcher 扫描用）

datetime 列统一使用 TIMESTAMP WITHOUT TIME ZONE（与既有表一致）。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── P1-4.7: users.deleted_at ──
    op.add_column(
        "users",
        sa.Column("deleted_at", sa.DateTime(), nullable=True, index=True),
    )

    # ── P1-4.9: subscription_ledger（不可变权益账本）──
    op.create_table(
        "subscription_ledger",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "subscription_id",
            sa.Integer(),
            sa.ForeignKey("subscriptions.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        # event_type: grant / renew / revoke / partial_revoke / upgrade / downgrade
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("plan_from", sa.String(50), nullable=True),
        sa.Column("plan_to", sa.String(50), nullable=False),
        sa.Column("quota_daily_from", sa.Integer(), nullable=True),
        sa.Column("quota_daily_to", sa.Integer(), nullable=False),
        sa.Column("start_at", sa.DateTime(), nullable=True),
        sa.Column("end_at", sa.DateTime(), nullable=True),
        # 触发来源: order:42 / admin:7 / refund:55 / system
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("order_id", sa.Integer(), nullable=True, index=True),
        # 不可变字段：快照 JSON（金额/周期/原因等）
        sa.Column("snapshot_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_subscription_ledger_user_created",
        "subscription_ledger",
        ["user_id", "created_at"],
    )

    # ── P1-4.9: subscriptions 部分唯一索引（每用户仅一条 active）──
    # PostgreSQL / SQLite 3.8+ 均支持部分索引（WHERE 子句）
    op.create_index(
        "uq_subscriptions_user_active",
        "subscriptions",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
        sqlite_where=sa.text("status = 'active'"),
    )

    # ── P1-4.9: outbox_events 扫描索引（dispatcher 用）──
    op.create_index(
        "ix_outbox_events_dispatch",
        "outbox_events",
        ["status", "next_retry_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_outbox_events_dispatch", table_name="outbox_events")
    op.drop_index("uq_subscriptions_user_active", table_name="subscriptions")
    op.drop_index("ix_subscription_ledger_user_created", table_name="subscription_ledger")
    op.drop_table("subscription_ledger")
    op.drop_column("users", "deleted_at")
