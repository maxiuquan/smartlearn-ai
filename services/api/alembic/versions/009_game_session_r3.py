"""P0-02 (R3): 服务端逐题作答会话架构

Revision ID: 009
Revises: 008
Create Date: 2026-07-14

本次迁移落地 R3 审计报告要求的服务端逐题作答会话架构：
- game_sessions 表新增 server_nonce / expires_at / status 列
- 新建 game_questions 表（session 绑定的题目集，含 correct_answer）
- 新建 game_answer_events 表（不可变答题事件流，含 idempotency_key 幂等约束）
- 新建 game_rewards_ledger 表（不可变奖励账本，每 session 仅结算一次）

datetime 列统一使用 TIMESTAMP WITHOUT TIME ZONE（与既有表一致）。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── game_sessions 新增 P0-02 (R3) 列 ──
    op.add_column(
        "game_sessions",
        sa.Column("server_nonce", sa.String(128), nullable=True, index=True),
    )
    op.add_column(
        "game_sessions",
        sa.Column("expires_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "game_sessions",
        sa.Column(
            "status",
            sa.String(20),
            server_default="active",
            nullable=False,
        ),
    )
    # 既有数据迁移：旧行视为已完成（finished），不影响新流程
    op.execute("UPDATE game_sessions SET status = 'finished' WHERE status IS NULL OR status = 'active'")

    # ── game_questions（session 绑定的题目集）──
    op.create_table(
        "game_questions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("game_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("question_id", sa.String(200), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("correct_answer", sa.Text(), nullable=False),
        sa.Column("user_answer", sa.Text(), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("answered_at", sa.DateTime(), nullable=True),
    )
    # P0-02 (R3): (session_id, sequence) 唯一约束 — 防止同 session 内重复序号
    op.create_index(
        "uq_game_questions_session_seq",
        "game_questions",
        ["session_id", "sequence"],
        unique=True,
    )

    # ── game_answer_events（不可变答题事件流）──
    op.create_table(
        "game_answer_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("game_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("question_id", sa.String(200), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("user_answer", sa.Text(), nullable=False),
        sa.Column(
            "is_correct",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("idempotency_key", sa.String(128), nullable=False, index=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    # P0-02 (R3): (session_id, idempotency_key) 唯一约束 — 防止同 session 重复提交
    op.create_index(
        "uq_game_answer_idempotency",
        "game_answer_events",
        ["session_id", "idempotency_key"],
        unique=True,
    )
    # P0-02 (R3): (user_id, idempotency_key) 唯一约束 — 跨 session 防止用户重放
    op.create_index(
        "uq_game_answer_user_idempotency",
        "game_answer_events",
        ["user_id", "idempotency_key"],
        unique=True,
    )
    # 查询索引：按 session 时序回放
    op.create_index(
        "ix_game_answer_events_session_created",
        "game_answer_events",
        ["session_id", "created_at"],
    )

    # ── game_rewards_ledger（不可变奖励账本）──
    op.create_table(
        "game_rewards_ledger",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("game_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("game_id", sa.String(100), nullable=False),
        sa.Column(
            "xp_gained",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "coins_gained",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "score",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "accuracy",
            sa.Float(),
            server_default="0.0",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    # P0-02 (R3): session_id 唯一约束 — 每 session 仅结算一次（DB 层兜底）
    op.create_index(
        "uq_game_rewards_session",
        "game_rewards_ledger",
        ["session_id"],
        unique=True,
    )
    # 查询索引：用户维度结算历史
    op.create_index(
        "ix_game_rewards_ledger_user_created",
        "game_rewards_ledger",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    # ── 移除 game_rewards_ledger ──
    op.drop_index(
        "ix_game_rewards_ledger_user_created",
        table_name="game_rewards_ledger",
    )
    op.drop_index(
        "uq_game_rewards_session",
        table_name="game_rewards_ledger",
    )
    op.drop_table("game_rewards_ledger")

    # ── 移除 game_answer_events ──
    op.drop_index(
        "ix_game_answer_events_session_created",
        table_name="game_answer_events",
    )
    op.drop_index(
        "uq_game_answer_user_idempotency",
        table_name="game_answer_events",
    )
    op.drop_index(
        "uq_game_answer_idempotency",
        table_name="game_answer_events",
    )
    op.drop_table("game_answer_events")

    # ── 移除 game_questions ──
    op.drop_index(
        "uq_game_questions_session_seq",
        table_name="game_questions",
    )
    op.drop_table("game_questions")

    # ── 移除 game_sessions 新增列 ──
    op.drop_column("game_sessions", "status")
    op.drop_column("game_sessions", "expires_at")
    op.drop_column("game_sessions", "server_nonce")
