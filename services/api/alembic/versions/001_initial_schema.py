"""Initial schema - all core tables

Revision ID: 001
Revises:
Create Date: 2026-07-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ==================== users ====================
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("wechat_openid", sa.String(length=128), nullable=True),
        sa.Column("role", sa.String(length=20), server_default="user", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("phone"),
        sa.UniqueConstraint("wechat_openid"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_phone", "users", ["phone"])

    # ==================== subscriptions ====================
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plan", sa.String(length=50), server_default="free", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("start_at", sa.DateTime(), nullable=True),
        sa.Column("end_at", sa.DateTime(), nullable=True),
        sa.Column("ai_quota_daily", sa.Integer(), server_default="10", nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])

    # ==================== knowledge_points ====================
    op.create_table(
        "knowledge_points",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject", sa.String(length=50), server_default="math", nullable=False),
        sa.Column("chapter", sa.String(length=200), nullable=True),
        sa.Column("section", sa.String(length=200), nullable=True),
        sa.Column("name", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("difficulty", sa.Integer(), server_default="1", nullable=False),
        sa.Column("importance", sa.Integer(), server_default="1", nullable=False),
        sa.Column("prerequisites", postgresql.JSONB(), nullable=True),
        sa.Column("keywords", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_kp_subject", "knowledge_points", ["subject"])
    op.create_index("ix_kp_subject_chapter", "knowledge_points", ["subject", "chapter"])

    # ==================== questions ====================
    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject", sa.String(length=50), server_default="math", nullable=False),
        sa.Column("knowledge_points", postgresql.JSONB(), nullable=True),
        sa.Column("type", sa.String(length=50), server_default="choice", nullable=False),
        sa.Column("difficulty", sa.Integer(), server_default="1", nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("options", postgresql.JSONB(), nullable=True),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("solution", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_questions_subject", "questions", ["subject"])
    op.create_index("ix_questions_type", "questions", ["type"])

    # ==================== vocabulary_words ====================
    op.create_table(
        "vocabulary_words",
        sa.Column("word_id", sa.String(length=100), nullable=False),
        sa.Column("headword", sa.String(length=200), nullable=False),
        sa.Column("meaning", sa.Text(), nullable=False),
        sa.Column("phonetic", sa.String(length=200), nullable=True),
        sa.Column("tags", postgresql.JSONB(), nullable=True),
        sa.Column("frequency", sa.Integer(), server_default="0", nullable=False),
        sa.Column("synonyms", postgresql.JSONB(), nullable=True),
        sa.Column("antonyms", postgresql.JSONB(), nullable=True),
        sa.Column("examples", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("word_id"),
    )
    op.create_index("ix_vocab_headword", "vocabulary_words", ["headword"])
    op.create_index("ix_vocab_frequency", "vocabulary_words", ["frequency"])

    # ==================== user_word_progress ====================
    op.create_table(
        "user_word_progress",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("word_id", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="new", nullable=False),
        sa.Column("mastery_level", sa.Float(), server_default="0", nullable=False),
        sa.Column("ease_factor", sa.Float(), server_default="2.5", nullable=False),
        sa.Column("interval_days", sa.Integer(), server_default="0", nullable=False),
        sa.Column("next_review_at", sa.DateTime(), nullable=True),
        sa.Column("review_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("correct_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("wrong_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["word_id"], ["vocabulary_words.word_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "word_id"),
    )
    op.create_index("ix_uwp_next_review", "user_word_progress", ["user_id", "next_review_at"])

    # ==================== user_question_attempts ====================
    op.create_table(
        "user_question_attempts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("user_answer", sa.Text(), nullable=True),
        sa.Column("correct", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_uqa_user_question", "user_question_attempts", ["user_id", "question_id"])

    # ==================== wrong_questions ====================
    op.create_table(
        "wrong_questions",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("wrong_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column("last_wrong_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("next_review_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "question_id"),
    )
    op.create_index("ix_wq_next_review", "wrong_questions", ["user_id", "next_review_at"])

    # ==================== ai_conversations ====================
    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("messages", postgresql.JSONB(), nullable=False),
        sa.Column("cited_kp", postgresql.JSONB(), nullable=True),
        sa.Column("token_cost", sa.Integer(), server_default="0", nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_aic_user_id", "ai_conversations", ["user_id"])

    # ==================== game_sessions ====================
    op.create_table(
        "game_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.String(length=100), nullable=False),
        sa.Column("score", sa.Integer(), server_default="0", nullable=False),
        sa.Column("xp_gained", sa.Integer(), server_default="0", nullable=False),
        sa.Column("coins_gained", sa.Integer(), server_default="0", nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gs_user_game", "game_sessions", ["user_id", "game_id"])

    # ==================== user_game_profile ====================
    op.create_table(
        "user_game_profile",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("level", sa.Integer(), server_default="1", nullable=False),
        sa.Column("total_xp", sa.Integer(), server_default="0", nullable=False),
        sa.Column("coins", sa.Integer(), server_default="0", nullable=False),
        sa.Column("streak_days", sa.Integer(), server_default="0", nullable=False),
        sa.Column("badges", postgresql.JSONB(), nullable=True),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    # ==================== audit_logs ====================
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target", sa.String(length=255), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_actor", "audit_logs", ["actor"])
    op.create_index("ix_audit_action", "audit_logs", ["action"])
    op.create_index("ix_audit_created", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("user_game_profile")
    op.drop_table("game_sessions")
    op.drop_table("ai_conversations")
    op.drop_table("wrong_questions")
    op.drop_table("user_question_attempts")
    op.drop_table("user_word_progress")
    op.drop_table("vocabulary_words")
    op.drop_table("questions")
    op.drop_table("knowledge_points")
    op.drop_table("subscriptions")
    op.drop_table("users")