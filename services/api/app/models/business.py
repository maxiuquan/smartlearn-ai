"""业务表 ORM 模型 — 题目/知识点/词汇/游戏相关.

供 admin 管理端点使用（创建/更新/删除/统计）。
"""
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Boolean, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class KnowledgePoint(Base):
    """知识点表."""

    __tablename__ = "knowledge_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subject: Mapped[str] = mapped_column(String(50), server_default="math", nullable=False, index=True)
    chapter: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    section: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)
    importance: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)
    prerequisites: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    keywords: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class Question(Base):
    """题目表."""

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subject: Mapped[str] = mapped_column(String(50), server_default="math", nullable=False, index=True)
    knowledge_points: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    type: Mapped[str] = mapped_column(String(50), server_default="choice", nullable=False, index=True)
    difficulty: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    solution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class VocabularyWord(Base):
    """词汇表."""

    __tablename__ = "vocabulary_words"

    word_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    headword: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    meaning: Mapped[str] = mapped_column(Text, nullable=False)
    phonetic: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    tags: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    frequency: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False, index=True)
    synonyms: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    antonyms: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    examples: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class UserWordProgress(Base):
    """用户词汇学习进度."""

    __tablename__ = "user_word_progress"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    word_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("vocabulary_words.word_id", ondelete="CASCADE"), primary_key=True
    )
    status: Mapped[str] = mapped_column(String(20), server_default="new", nullable=False)
    mastery_level: Mapped[float] = mapped_column(Float, server_default="0", nullable=False)
    ease_factor: Mapped[float] = mapped_column(Float, server_default="2.5", nullable=False)
    interval_days: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    next_review_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    review_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    wrong_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class UserQuestionAttempt(Base):
    """用户答题记录."""

    __tablename__ = "user_question_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    user_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    correct: Mapped[bool] = mapped_column(nullable=False, default=False)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class WrongQuestion(Base):
    """错题本."""

    __tablename__ = "wrong_questions"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True
    )
    wrong_count: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)
    last_wrong_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    next_review_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # SRS 闭环字段（迁移 005）
    review_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    review_stage: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    graduated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class AIConversation(Base):
    """AI 对话记录."""

    __tablename__ = "ai_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    messages: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    cited_kp: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    token_cost: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class GameSession(Base):
    """游戏会话记录."""

    __tablename__ = "game_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    game_id: Mapped[str] = mapped_column(String(100), nullable=False)
    score: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    xp_gained: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    coins_gained: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    finished_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class UserGameProfile(Base):
    """用户游戏档案."""

    __tablename__ = "user_game_profile"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    level: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)
    total_xp: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    coins: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    streak_days: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    badges: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WordGameSession(Base):
    """单词游戏活跃会话状态（跨 worker 可恢复）.

    由 ai-engine asyncpg 读写；ORM 定义在此供 Alembic 迁移创建表。
    """

    __tablename__ = "word_game_sessions"

    session_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    game_type: Mapped[str] = mapped_column(String(50), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False)
    words: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    current_index: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    score: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    wrong_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    time_limit_seconds: Mapped[int] = mapped_column(Integer, server_default="60", nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
