"""Add game_id/subject/answered columns to word_game_sessions

Revision ID: 004
Revises: 003
Create Date: 2026-07-08

第五轮复审 6.1/6.2/6.3 修复：
- game_id: 真实游戏标识（25 款游戏独立排行榜，6.2⑤/⑥）
- subject: 学科分流（vocabulary/math/cross_subject，6.1①）
- answered: 逐题作答记录 JSONB（错词本真实数据，6.2④）

注：三列均允许 NULL，兼容迁移 003 已写入的旧数据；
    ai-engine 读取时对 NULL 做默认值兜底。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # game_id: 真实游戏标识（如 "word-match-blast"），允许 NULL 兼容旧数据
    op.add_column(
        "word_game_sessions",
        sa.Column(
            "game_id",
            sa.String(length=100),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_word_game_sessions_game_id",
        "word_game_sessions",
        ["game_id"],
    )

    # subject: 学科类型（vocabulary/math/cross_subject），允许 NULL 兼容旧数据
    op.add_column(
        "word_game_sessions",
        sa.Column(
            "subject",
            sa.String(length=20),
            nullable=True,
        ),
    )

    # answered: 逐题作答记录 JSONB 数组，允许 NULL 兼容旧数据
    op.add_column(
        "word_game_sessions",
        sa.Column(
            "answered",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("word_game_sessions", "answered")
    op.drop_column("word_game_sessions", "subject")
    op.drop_index(
        "ix_word_game_sessions_game_id",
        table_name="word_game_sessions",
    )
    op.drop_column("word_game_sessions", "game_id")
