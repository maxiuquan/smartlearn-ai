"""P1-2 RAG 管理 API 路由（admin only）.

提供文档索引管理、版本发布/回滚、检索追踪查询等端点。
所有端点均需管理员权限（admin / super_admin）。
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_db
from app.models.rag_index import KnowledgeDocument, RetrievalTrace
from app.models.user import User
from app.schemas.rag import (
    IndexVersionCreate,
    IndexVersionResponse,
    KnowledgeDocumentCreate,
    KnowledgeDocumentResponse,
    RetrievalTraceResponse,
)
from app.services.rag_index_service import (
    index_document,
    publish_index_version,
    reindex_document,
    rollback_index_version,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/rag/admin/documents",
    response_model=KnowledgeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建文档（admin）",
)
async def create_document(
    payload: KnowledgeDocumentCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> KnowledgeDocumentResponse:
    """创建文档并自动切分 + 创建索引任务。"""
    doc = await index_document(
        db=db,
        doc_type=payload.doc_type,
        doc_ref_id=payload.doc_ref_id,
        title=payload.title,
        content=payload.content,
        knowledge_points=payload.knowledge_points,
        acl_scope=payload.acl_scope,
    )
    await db.commit()
    await db.refresh(doc)
    return KnowledgeDocumentResponse.model_validate(doc)


@router.get(
    "/rag/admin/documents",
    summary="文档列表（admin，分页）",
)
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    doc_type: Optional[str] = Query(None, description="按文档类型筛选"),
    status_filter: Optional[str] = Query(None, alias="status", description="按状态筛选"),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """获取文档列表（分页 + 多条件筛选）。"""
    conditions = []
    if doc_type:
        conditions.append(KnowledgeDocument.doc_type == doc_type)
    if status_filter:
        conditions.append(KnowledgeDocument.status == status_filter)

    base_q = select(KnowledgeDocument)
    count_q = select(func.count()).select_from(KnowledgeDocument)
    for cond in conditions:
        base_q = base_q.where(cond)
        count_q = count_q.where(cond)

    total = (await db.execute(count_q)).scalar() or 0
    base_q = (
        base_q.order_by(KnowledgeDocument.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(base_q)
    docs = result.scalars().all()

    return {
        "items": [KnowledgeDocumentResponse.model_validate(d).model_dump() for d in docs],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post(
    "/rag/admin/documents/{doc_id}/reindex",
    response_model=KnowledgeDocumentResponse,
    summary="重建索引（admin）",
)
async def reindex_doc(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> KnowledgeDocumentResponse:
    """重建指定文档的索引：清空 embedding，重置 job 状态。"""
    try:
        doc = await reindex_document(db, doc_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    await db.commit()
    await db.refresh(doc)
    return KnowledgeDocumentResponse.model_validate(doc)


@router.post(
    "/rag/admin/index-versions",
    response_model=IndexVersionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="发布版本（admin）",
)
async def create_index_version(
    payload: IndexVersionCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> IndexVersionResponse:
    """发布新索引版本。"""
    iv = await publish_index_version(
        db=db,
        version=payload.version,
        embedding_model=payload.embedding_model,
        notes=payload.notes,
    )
    await db.commit()
    await db.refresh(iv)
    return IndexVersionResponse.model_validate(iv)


@router.post(
    "/rag/admin/index-versions/{version}/rollback",
    response_model=IndexVersionResponse,
    summary="回滚（admin）",
)
async def rollback_version(
    version: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> IndexVersionResponse:
    """回滚指定索引版本。"""
    try:
        iv = await rollback_index_version(db, version)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    await db.commit()
    await db.refresh(iv)
    return IndexVersionResponse.model_validate(iv)


@router.get(
    "/rag/admin/traces",
    summary="检索追踪列表（admin）",
)
async def list_traces(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    request_id: Optional[str] = Query(None, description="按 request_id 筛选"),
    user_id: Optional[int] = Query(None, description="按 user_id 筛选"),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """获取检索追踪列表（分页 + 多条件筛选）。"""
    conditions = []
    if request_id:
        conditions.append(RetrievalTrace.request_id == request_id)
    if user_id is not None:
        conditions.append(RetrievalTrace.user_id == user_id)

    base_q = select(RetrievalTrace)
    count_q = select(func.count()).select_from(RetrievalTrace)
    for cond in conditions:
        base_q = base_q.where(cond)
        count_q = count_q.where(cond)

    total = (await db.execute(count_q)).scalar() or 0
    base_q = (
        base_q.order_by(RetrievalTrace.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(base_q)
    traces = result.scalars().all()

    return {
        "items": [RetrievalTraceResponse.model_validate(t).model_dump() for t in traces],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
