"""P1-2 RAG 索引 Pydantic schemas.

提供 RAG 文档/分块/版本/追踪的请求与响应模型。
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class KnowledgeDocumentCreate(BaseModel):
    """创建文档请求."""

    doc_type: str = Field(..., max_length=30, description="knowledge/question/vocabulary/exam")
    doc_ref_id: Optional[str] = Field(None, max_length=100, description="关联源 ID（如 knowledge_point_id）")
    title: str = Field(..., max_length=255)
    source: Optional[str] = Field(None, max_length=200)
    content: str = Field(..., description="文档原文（用于切分）")
    knowledge_points: Optional[str] = Field(None, max_length=500, description="关联知识点（逗号分隔）")
    acl_scope: str = Field("public", max_length=100, description="权限范围（public/course/grade_x）")
    metadata_json: Optional[str] = None

    model_config = {"extra": "forbid"}


class KnowledgeDocumentResponse(BaseModel):
    """文档响应."""

    id: int
    doc_type: str
    doc_ref_id: Optional[str] = None
    title: str
    source: Optional[str] = None
    version: int
    status: str
    acl_scope: Optional[str] = None
    metadata_json: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentChunkResponse(BaseModel):
    """分块响应."""

    id: int
    document_id: int
    chunk_index: int
    content: str
    knowledge_points: Optional[str] = None
    acl_scope: Optional[str] = None
    embedding_model: Optional[str] = None
    embedding_version: Optional[str] = None
    metadata_json: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class IndexVersionCreate(BaseModel):
    """发布版本请求."""

    version: str = Field(..., max_length=50, description="版本号，如 v20260713")
    embedding_model: str = Field(..., max_length=100)
    notes: Optional[str] = None

    model_config = {"extra": "forbid"}


class IndexVersionResponse(BaseModel):
    """索引版本响应."""

    id: int
    version: str
    embedding_model: str
    chunk_count: int
    status: str
    activated_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RetrievalTraceResponse(BaseModel):
    """检索追踪响应."""

    id: int
    request_id: Optional[str] = None
    user_id: Optional[int] = None
    query: str
    retrieved_chunk_ids: Optional[str] = None
    scores: Optional[str] = None
    model: Optional[str] = None
    prompt_hash: Optional[str] = None
    cost_tokens: Optional[int] = None
    latency_ms: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}
