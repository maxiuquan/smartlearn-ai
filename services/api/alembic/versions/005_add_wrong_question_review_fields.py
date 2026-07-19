"""Add review_count/review_stage to wrong_questions for SRS graduation

Revision ID: 005
Revises: 004
Create Date: 2026-07-10

错题本 SRS 闭环修复：
- review_count: 独立记录复习次数（原用 wrong_count 做索引导致始终同一档间隔）
- review_stage: 复习阶段（0=新错题,1-5=逐级递增,5=已毕业可移除）
- graduated_at: 毕业时间（连续答对后移出错题本）

注：三列均允许 NULL / 有默认值，兼容迁移 004 已写入的旧数据。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # review_count: 独立复习次数（区别于 wrong_count 答错次数）
    op.add_column(
        "wrong_questions",
        sa.Column("review_count", sa.Integer(), server_default="0", nullable=False),
    )
    # review_stage: 复习阶段 0-5，用于 SRS 间隔递增
    op.add_column(
        "wrong_questions",
        sa.Column("review_stage", sa.Integer(), server_default="0", nullable=False),
    )
    # graduated_at: 毕业时间（答对后从错题本移除时记录）
    op.add_column(
        "wrong_questions",
        sa.Column("graduated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("wrong_questions", "graduated_at")
    op.drop_column("wrong_questions", "review_stage")
    op.drop_column("wrong_questions", "review_count")
