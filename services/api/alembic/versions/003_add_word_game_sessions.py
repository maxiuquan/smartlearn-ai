"""Add word_game_sessions table

Revision ID: 003
Revises: 002
Create Date: 2026-07-08

新增 word_game_sessions 表，存储单词游戏活跃会话状态，
实现跨 worker 可恢复的 session 持久化。
ai-engine 通过 asyncpg 读写此表。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "word_game_sessions",
        sa.Column("session_id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=100), nullable=False, index=True),
        sa.Column("game_type", sa.String(length=50), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False),
        sa.Column("words", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("current_index", sa.Integer(), server_default="0", nullable=False),
        sa.Column("score", sa.Integer(), server_default="0", nullable=False),
        sa.Column("correct_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("wrong_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("time_limit_seconds", sa.Integer(), server_default="60", nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_word_game_sessions_user_id",
        "word_game_sessions",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_word_game_sessions_user_id", table_name="word_game_sessions")
    op.drop_table("word_game_sessions")
