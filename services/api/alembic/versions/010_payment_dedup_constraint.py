"""P0-02 (R4): 支付回调去重 DB 唯一约束兜底

Revision ID: 010
Revises: 009
Create Date: 2026-07-14

本次迁移落地 R4 审计报告要求的支付回调去重 DB 级兜底：
- orders 表新增 (channel, third_party_trade_no) 唯一约束
- Redis SETNX 故障时，DB 唯一约束仍可防止重复回调处理

channel 和 third_party_trade_no 列在 006 迁移中已创建，本次仅追加唯一约束。
执行前先清理潜在重复数据（保留每组 channel+third_party_trade_no 最新 id，其余置 NULL），
确保约束创建不会因历史脏数据失败。
"""
from typing import Sequence, Union

from alembic import op


revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 清理潜在重复数据：保留每组 (channel, third_party_trade_no) 最大 id，其余置 NULL
    # 使用派生表包装以兼容 MySQL / PostgreSQL / SQLite
    op.execute(
        """
        UPDATE orders SET third_party_trade_no = NULL
        WHERE third_party_trade_no IS NOT NULL
          AND id NOT IN (
            SELECT max_id FROM (
              SELECT MAX(id) AS max_id
              FROM orders
              WHERE third_party_trade_no IS NOT NULL
              GROUP BY channel, third_party_trade_no
            ) AS latest
          )
        """
    )

    # P0-02 (R4): (channel, third_party_trade_no) 唯一约束 — DB 级兜底防重复回调
    op.create_unique_constraint(
        "uq_order_channel_trade_no",
        "orders",
        ["channel", "third_party_trade_no"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_order_channel_trade_no", "orders", type_="unique")
