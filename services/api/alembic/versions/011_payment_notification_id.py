"""P0-02 (R5): 支付回调通知 ID 去重 + 唯一约束

Revision ID: 011
Revises: 010
Create Date: 2026-07-14

本次迁移落地 R5 审计报告要求的支付平台通知 ID 去重：
- orders 表新增 notification_id 列（微信通知 ID / 支付宝通知流水）
- 新增 (channel, notification_id) 唯一约束，覆盖通知 ID 级别去重
- 与 (channel, third_party_trade_no) 唯一约束形成双重去重

notification_id 允许 NULL（兼容旧数据和未携带通知 ID 的回调），
唯一约束在 PostgreSQL 中 NULL 值不冲突，可正常多条 NULL。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "011"
down_revision: str = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """添加 notification_id 列 + 唯一约束."""
    # 添加 notification_id 列（nullable，兼容旧数据）
    op.add_column(
        "orders",
        sa.Column("notification_id", sa.String(128), nullable=True),
    )
    # 创建索引加速 notification_id 查询
    op.create_index(
        "ix_orders_notification_id",
        "orders",
        ["notification_id"],
    )
    # 创建唯一约束 (channel, notification_id)
    # 注意：PostgreSQL 中多个 NULL 值不违反唯一约束，兼容旧数据
    op.create_unique_constraint(
        "uq_order_channel_notification_id",
        "orders",
        ["channel", "notification_id"],
    )


def downgrade() -> None:
    """移除 notification_id 列 + 唯一约束."""
    op.drop_constraint("uq_order_channel_notification_id", "orders", type_="unique")
    op.drop_index("ix_orders_notification_id", table_name="orders")
    op.drop_column("orders", "notification_id")
