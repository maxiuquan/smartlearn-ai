"""SQLAlchemy ORM 模型导出.

所有模型在此统一导出，便于 `from app.models import User` 风格使用。
"""
from app.models.audit_log import AuditLog
from app.models.auth_session import AuthSession
from app.models.base import Base
from app.models.business import (
    AIConversation,
    GameAnswerEvent,
    GameQuestion,
    GameRewardsLedger,
    GameSession,
    KnowledgePoint,
    Question,
    QuestionAttemptEvent,
    UserGameProfile,
    UserQuestionAttempt,
    UserWordProgress,
    VocabularyWord,
    WordGameSession,
    WordLearningEvent,
    WrongQuestion,
)
from app.models.content_asset import ContentAsset, ContentTakedownRequest
from app.models.order import Order, OrderEvent, OutboxEvent
from app.models.rag_index import (
    DocumentChunk,
    EmbeddingJob,
    IndexVersion,
    KnowledgeDocument,
    RetrievalTrace,
)
from app.models.subscription import Subscription
from app.models.subscription_ledger import SubscriptionLedger
from app.models.user import User

__all__ = [
    "Base",
    "User",
    "Subscription",
    "SubscriptionLedger",
    "AuditLog",
    "AuthSession",
    "KnowledgePoint",
    "Question",
    "VocabularyWord",
    "UserWordProgress",
    "UserQuestionAttempt",
    "WrongQuestion",
    "AIConversation",
    "GameSession",
    "UserGameProfile",
    "WordGameSession",
    # P0-02 (R3): 逐题作答会话架构
    "GameQuestion",
    "GameAnswerEvent",
    "GameRewardsLedger",
    # P1-03/05: 学习事件流（不可变，用于幂等与回放）
    "WordLearningEvent",
    "QuestionAttemptEvent",
    # P0-5 内容版权
    "ContentAsset",
    "ContentTakedownRequest",
    # P1-4 支付账务
    "Order",
    "OrderEvent",
    "OutboxEvent",
    # P1-2 持久化 RAG
    "KnowledgeDocument",
    "DocumentChunk",
    "EmbeddingJob",
    "IndexVersion",
    "RetrievalTrace",
]
