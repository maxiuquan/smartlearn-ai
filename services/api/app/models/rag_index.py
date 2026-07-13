"""P1-2 持久化 RAG 索引 ORM 模型.

表建在 API 服务的数据库（API 是数据权威，AI Engine 通过 HTTP 调 API 读写）。
向量以 base64 编码 float32 数组存储在 Text 字段，检索时解码为 numpy 做内存余弦相似度。
未来可平滑切换到 pgvector（只需把 embedding 字段改为 Vector 类型）。
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class KnowledgeDocument(Base):
    """文档级元数据.

    doc_type: knowledge/question/vocabulary/exam
    status: pending/indexed/failed/deleted
    acl_scope: 权限范围（public/course/grade_x）
    """

    __tablename__ = "knowledge_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    doc_ref_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    version: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)
    status: Mapped[str] = mapped_column(String(20), server_default="pending", nullable=False, index=True)
    acl_scope: Mapped[Optional[str]] = mapped_column(String(100), server_default="public", nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<KnowledgeDocument id={self.id} type={self.doc_type} status={self.status}>"


class DocumentChunk(Base):
    """分块.

    embedding: base64 编码 float32 数组（或 null 待索引）
    knowledge_points: 关联知识点（逗号分隔）
    """

    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    knowledge_points: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    acl_scope: Mapped[Optional[str]] = mapped_column(String(100), server_default="public", nullable=True)
    embedding_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    embedding_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    embedding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<DocumentChunk id={self.id} doc={self.document_id} idx={self.chunk_index}>"


class EmbeddingJob(Base):
    """索引任务（幂等 + 重试）.

    idempotency_key: doc_id+chunk_id+model_version 防重复
    status: pending/processing/success/failed/dead
    """

    __tablename__ = "embedding_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), server_default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    max_retry: Mapped[int] = mapped_column(Integer, server_default="3", nullable=False)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<EmbeddingJob id={self.id} status={self.status} retries={self.retry_count}>"


class IndexVersion(Base):
    """索引版本发布.

    status: staging/active/rolled_back
    version: 如 v20260713
    """

    __tablename__ = "index_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(100), nullable=False)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), server_default="staging", nullable=False)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<IndexVersion version={self.version} status={self.status}>"


class RetrievalTrace(Base):
    """检索追踪（用于审计 + 效果分析）.

    retrieved_chunk_ids / scores: JSON 数组
    """

    __tablename__ = "retrieval_traces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    retrieved_chunk_ids: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scores: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    prompt_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    cost_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<RetrievalTrace id={self.id} query={self.query[:30]!r}>"
