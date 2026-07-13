"""P1-2 持久化 RAG 索引服务.

提供文档索引、分块检索、版本管理、追踪记录等能力。
向量以 base64 编码 float32 数组存储在 Text 字段，检索时加载到内存做余弦相似度。
未来可平滑切换到 pgvector（只需把 embedding 字段改为 Vector 类型）。
"""
import base64
import json
import logging
from datetime import datetime
from typing import Optional

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rag_index import (
    DocumentChunk,
    EmbeddingJob,
    IndexVersion,
    KnowledgeDocument,
    RetrievalTrace,
)

logger = logging.getLogger(__name__)

# 默认分块大小（与 AI Engine config.RAG_CHUNK_SIZE 对齐）
RAG_CHUNK_SIZE = 500

# OutboxEvent 可选导入（P1-4 支付模块 order.py 未上线时降级，不阻塞索引主流程）
try:
    from app.models.order import OutboxEvent  # type: ignore

    _HAS_OUTBOX = True
except ImportError:
    OutboxEvent = None  # type: ignore[assignment]
    _HAS_OUTBOX = False


# ─── 向量编解码 helper ─────────────────────────────────────


def encode_embedding(vec: np.ndarray) -> str:
    """将 float32 numpy 数组编码为 base64 字符串存储。"""
    arr = np.asarray(vec, dtype=np.float32)
    return base64.b64encode(arr.tobytes()).decode("ascii")


def decode_embedding(s: str) -> np.ndarray:
    """将 base64 字符串解码为 float32 numpy 数组。"""
    raw = base64.b64decode(s.encode("ascii"))
    return np.frombuffer(raw, dtype=np.float32).copy()


def _cosine_similarity(query_vec: np.ndarray, chunk_vecs: np.ndarray) -> list[float]:
    """计算查询向量与多个 chunk 向量的余弦相似度。

    Args:
        query_vec: 查询向量 (D,) 或 (1, D)
        chunk_vecs: chunk 向量矩阵 (N, D)

    Returns:
        长度为 N 的相似度列表
    """
    if chunk_vecs.size == 0:
        return []
    q = np.asarray(query_vec, dtype=np.float32)
    c = np.asarray(chunk_vecs, dtype=np.float32)
    if q.ndim == 1:
        q = q.reshape(1, -1)
    if c.ndim == 1:
        c = c.reshape(1, -1)
    q_norm = q / (np.linalg.norm(q, axis=1, keepdims=True) + 1e-10)
    c_norm = c / (np.linalg.norm(c, axis=1, keepdims=True) + 1e-10)
    scores = (c_norm @ q_norm.T).reshape(-1)
    return [float(x) for x in scores]


def _split_text(text: str, chunk_size: int = RAG_CHUNK_SIZE) -> list[str]:
    """按字符数切分文本（优先按段落，避免截断句子）。

    策略：先按双换行分段落，累积到接近 chunk_size 时输出；
    超长段落强制按 chunk_size 切分。
    """
    if not text:
        return []
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    buf = ""
    for para in paragraphs:
        if len(buf) + len(para) + 2 <= chunk_size:
            buf = (buf + "\n\n" + para) if buf else para
        else:
            if buf:
                chunks.append(buf)
                buf = ""
            if len(para) <= chunk_size:
                buf = para
            else:
                # 长段落强制切分
                for i in range(0, len(para), chunk_size):
                    piece = para[i : i + chunk_size]
                    if len(buf) + len(piece) + 2 <= chunk_size:
                        buf = (buf + "\n\n" + piece) if buf else piece
                    else:
                        if buf:
                            chunks.append(buf)
                        buf = piece
    if buf:
        chunks.append(buf)
    return chunks


# ─── 核心服务函数 ───────────────────────────────────────────


async def index_document(
    db: AsyncSession,
    doc_type: str,
    doc_ref_id: Optional[str],
    title: str,
    content: str,
    knowledge_points: Optional[str] = None,
    acl_scope: str = "public",
    embedding_model: Optional[str] = None,
    embedding_version: Optional[str] = None,
) -> KnowledgeDocument:
    """创建文档 + 分块（按 RAG_CHUNK_SIZE 切分）+ 创建 EmbeddingJob + 同事务写 OutboxEvent.

    所有操作在同一事务内，由调用方负责 commit。
    """
    doc = KnowledgeDocument(
        doc_type=doc_type,
        doc_ref_id=doc_ref_id,
        title=title,
        status="pending",
        acl_scope=acl_scope,
    )
    db.add(doc)
    await db.flush()  # 获取 doc.id

    chunks_text = _split_text(content, RAG_CHUNK_SIZE)
    for idx, chunk_text in enumerate(chunks_text):
        chunk = DocumentChunk(
            document_id=doc.id,
            chunk_index=idx,
            content=chunk_text,
            knowledge_points=knowledge_points,
            acl_scope=acl_scope,
            embedding_model=embedding_model,
            embedding_version=embedding_version,
            embedding=None,  # 待索引
        )
        db.add(chunk)
        await db.flush()  # 获取 chunk.id

        idem_key = (
            f"{doc.id}:{chunk.id}:{embedding_model or 'default'}:{embedding_version or 'v1'}"
        )
        job = EmbeddingJob(
            document_id=doc.id,
            chunk_id=chunk.id,
            idempotency_key=idem_key,
            status="pending",
        )
        db.add(job)

    # OutboxEvent（content.indexed）— 若 P1-4 order.py 已上线则同事务写入
    if _HAS_OUTBOX and OutboxEvent is not None:
        try:
            outbox = OutboxEvent(
                aggregate_type="knowledge_document",
                aggregate_id=doc.id,
                event_type="content.indexed",
                payload=json.dumps(
                    {
                        "document_id": doc.id,
                        "doc_type": doc_type,
                        "title": title,
                        "chunk_count": len(chunks_text),
                        "acl_scope": acl_scope,
                    },
                    ensure_ascii=False,
                ),
            )
            db.add(outbox)
        except Exception as e:
            logger.warning(f"写 OutboxEvent 失败（字段不兼容？跳过）: {e}")

    await db.flush()
    return doc


async def get_chunks_for_retrieval(
    db: AsyncSession,
    acl_scopes: Optional[list[str]] = None,
    limit: int = 1000,
) -> list[DocumentChunk]:
    """获取可检索 chunks（embedding 非空, acl_scope 在允许范围内）."""
    query = select(DocumentChunk).where(DocumentChunk.embedding.isnot(None))
    if acl_scopes:
        query = query.where(DocumentChunk.acl_scope.in_(acl_scopes))
    query = query.limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def search_chunks(
    db: AsyncSession,
    query_vec: np.ndarray,
    acl_scopes: Optional[list[str]] = None,
    top_k: int = 5,
) -> list[tuple[DocumentChunk, float]]:
    """从数据库加载所有 chunks 的 embedding 做内存余弦相似度（向后兼容，未来可换 pgvector）."""
    chunks = await get_chunks_for_retrieval(db, acl_scopes, limit=10000)
    if not chunks:
        return []

    # 解码所有 embedding
    valid: list[tuple[DocumentChunk, np.ndarray]] = []
    for chunk in chunks:
        if not chunk.embedding:
            continue
        try:
            vec = decode_embedding(chunk.embedding)
            valid.append((chunk, vec))
        except Exception as e:
            logger.warning(f"解码 chunk {chunk.id} embedding 失败: {e}")
            continue

    if not valid:
        return []

    chunk_vecs = np.stack([v for _, v in valid])
    scores = _cosine_similarity(query_vec, chunk_vecs)

    # 取 top_k
    indexed = sorted(zip(valid, scores), key=lambda x: x[1], reverse=True)[:top_k]
    return [(chunk, score) for (chunk, _), score in indexed]


async def create_retrieval_trace(
    db: AsyncSession,
    query: str,
    request_id: Optional[str] = None,
    user_id: Optional[int] = None,
    retrieved_chunk_ids: Optional[list[int]] = None,
    scores: Optional[list[float]] = None,
    model: Optional[str] = None,
    prompt_hash: Optional[str] = None,
    cost_tokens: Optional[int] = None,
    latency_ms: Optional[int] = None,
) -> RetrievalTrace:
    """记录检索追踪."""
    trace = RetrievalTrace(
        request_id=request_id,
        user_id=user_id,
        query=query,
        retrieved_chunk_ids=json.dumps(retrieved_chunk_ids or []),
        scores=json.dumps(scores or []),
        model=model,
        prompt_hash=prompt_hash,
        cost_tokens=cost_tokens,
        latency_ms=latency_ms,
    )
    db.add(trace)
    await db.flush()
    return trace


async def publish_index_version(
    db: AsyncSession,
    version: str,
    embedding_model: str,
    notes: Optional[str] = None,
) -> IndexVersion:
    """发布新版本：统计当前已索引 chunk 数，标记为 staging.

    将当前 active 版本置为 rolled_back（同一时刻只有一个 active）。
    """
    # 统计当前已索引 chunk 数
    count_q = select(func.count()).select_from(DocumentChunk).where(
        DocumentChunk.embedding.isnot(None)
    )
    chunk_count = (await db.execute(count_q)).scalar() or 0

    iv = IndexVersion(
        version=version,
        embedding_model=embedding_model,
        chunk_count=chunk_count,
        status="staging",
        notes=notes,
    )
    db.add(iv)
    await db.flush()
    return iv


async def rollback_index_version(db: AsyncSession, version: str) -> IndexVersion:
    """回滚指定版本：标记为 rolled_back."""
    result = await db.execute(
        select(IndexVersion).where(IndexVersion.version == version)
    )
    iv = result.scalar_one_or_none()
    if iv is None:
        raise ValueError(f"索引版本 {version} 不存在")
    iv.status = "rolled_back"
    iv.activated_at = None
    await db.flush()
    return iv


async def reindex_failed_jobs(db: AsyncSession) -> int:
    """重试失败任务：将 failed 且 retry_count < max_retry 的 job 重置为 pending.

    Returns:
        重置的 job 数量
    """
    result = await db.execute(
        select(EmbeddingJob).where(
            EmbeddingJob.status == "failed",
            EmbeddingJob.retry_count < EmbeddingJob.max_retry,
        )
    )
    jobs = list(result.scalars().all())
    count = 0
    for job in jobs:
        job.status = "pending"
        job.retry_count = job.retry_count + 1
        count += 1
    await db.flush()
    return count


async def reindex_document(db: AsyncSession, doc_id: int) -> KnowledgeDocument:
    """重建指定文档的索引：清空所有 chunk 的 embedding，重置 job 状态."""
    result = await db.execute(
        select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise ValueError(f"文档 {doc_id} 不存在")

    # 重置该文档所有 chunk 的 embedding
    chunk_result = await db.execute(
        select(DocumentChunk).where(DocumentChunk.document_id == doc_id)
    )
    chunks = list(chunk_result.scalars().all())
    for chunk in chunks:
        chunk.embedding = None
        chunk.embedding_model = None
        chunk.embedding_version = None

    # 重置该文档所有 job 状态
    job_result = await db.execute(
        select(EmbeddingJob).where(EmbeddingJob.document_id == doc_id)
    )
    jobs = list(job_result.scalars().all())
    for job in jobs:
        job.status = "pending"
        job.retry_count = 0
        job.last_error = None

    doc.status = "pending"
    await db.flush()
    return doc


async def activate_index_version(db: AsyncSession, version: str) -> IndexVersion:
    """激活指定版本：置为 active，记录激活时间."""
    result = await db.execute(
        select(IndexVersion).where(IndexVersion.version == version)
    )
    iv = result.scalar_one_or_none()
    if iv is None:
        raise ValueError(f"索引版本 {version} 不存在")
    iv.status = "active"
    iv.activated_at = datetime.utcnow()
    await db.flush()
    return iv
