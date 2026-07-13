"""P1-03 / P1-05 整改：词汇/作答事件流 + 词汇进度乐观锁 + 错题软毕业

Revision ID: 008
Revises: 007
Create Date: 2026-07-13

本次迁移落地用户全流程复审报告 P1-03 / P1-05 整改所需的结构变更：
- P1-05: user_word_progress 新增 version 列（乐观锁版本号）
- P1-05: 新建 word_learning_events 表（不可变词汇学习事件流）
- P1-03: 新建 question_attempt_events 表（不可变作答事件流）
- P1-03: wrong_questions 新增 graduated_at 索引（支持软毕业查询）
- P1-03: question_attempt_events / word_learning_events 新增唯一索引（幂等键兜底）

datetime 列统一使用 TIMESTAMP WITHOUT TIME ZONE（与既有表一致）。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── P1-05: user_word_progress 新增 version 列（乐观锁）──
    op.add_column(
        "user_word_progress",
        sa.Column("version", sa.Integer(), server_default="0", nullable=False),
    )

    # ── P1-05: word_learning_events（不可变词汇学习事件流）──
    op.create_table(
        "word_learning_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "word_id",
            sa.String(100),
            sa.ForeignKey("vocabulary_words.word_id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("event_id", sa.String(128), nullable=False, index=True),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("source", sa.String(50), nullable=True),
        sa.Column("correct", sa.Boolean(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    # P1-05: event_id 幂等键唯一约束（DB 层兜底，防止重复写入）
    op.create_index(
        "uq_word_learning_events_event_id",
        "word_learning_events",
        ["event_id"],
        unique=True,
    )
    # 按用户+词查询的复合索引
    op.create_index(
        "ix_word_learning_events_user_word",
        "word_learning_events",
        ["user_id", "word_id"],
    )

    # ── P1-03: question_attempt_events（不可变作答事件流）──
    op.create_table(
        "question_attempt_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("attempt_id", sa.String(128), nullable=False, index=True),
        sa.Column("user_answer", sa.Text(), nullable=True),
        sa.Column("correct", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        # JSONB 仅 PostgreSQL 支持；其他后端回退到 JSON
        sa.Column("knowledge_points", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    # P1-03: attempt_id 幂等键唯一约束
    op.create_index(
        "uq_question_attempt_events_attempt_id",
        "question_attempt_events",
        ["attempt_id"],
        unique=True,
    )
    op.create_index(
        "ix_question_attempt_events_user_question",
        "question_attempt_events",
        ["user_id", "question_id"],
    )

    # ── P1-03: wrong_questions.graduated_at 索引（软毕业查询）──
    op.create_index(
        "ix_wrong_questions_graduated_at",
        "wrong_questions",
        ["graduated_at"],
    )


def downgrade() -> None:
    # P1-03: 移除 wrong_questions 索引
    op.drop_index("ix_wrong_questions_graduated_at", table_name="wrong_questions")

    # P1-03: 移除 question_attempt_events
    op.drop_index(
        "ix_question_attempt_events_user_question",
        table_name="question_attempt_events",
    )
    op.drop_index(
        "uq_question_attempt_events_attempt_id",
        table_name="question_attempt_events",
    )
    op.drop_table("question_attempt_events")

    # P1-05: 移除 word_learning_events
    op.drop_index(
        "ix_word_learning_events_user_word",
        table_name="word_learning_events",
    )
    op.drop_index(
        "uq_word_learning_events_event_id",
        table_name="word_learning_events",
    )
    op.drop_table("word_learning_events")

    # P1-05: 移除 user_word_progress.version
    op.drop_column("user_word_progress", "version")
