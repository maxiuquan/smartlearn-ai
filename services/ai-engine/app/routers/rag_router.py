"""
RAG 知识检索路由
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.services.rag_service import get_rag_service
from app.services.llm_service import get_llm_service

router = APIRouter(prefix="/rag", tags=["知识检索"])


# ─── 请求/响应模型 ──────────────────────────────────────────

class RAGQueryRequest(BaseModel):
    """知识检索请求"""
    query: str = Field(..., description="查询文本")
    top_k: int = Field(default=5, ge=1, le=20, description="返回结果数量")


class KnowledgePointItem(BaseModel):
    """知识点项"""
    id: str
    name: str
    description: str
    keywords: list[str]
    subject: str
    chapter: str
    section: str
    difficulty: int
    importance: int
    similarity: float


class RAGQueryResponse(BaseModel):
    """知识检索响应"""
    query: str
    results: list[KnowledgePointItem]
    total: int


class ExplainRequest(BaseModel):
    """题目解析请求"""
    question: str = Field(..., description="题目内容")
    answer: str = Field(..., description="题目答案")
    context: str = Field(default="", description="可选的知识上下文")


class ExplainResponse(BaseModel):
    """题目解析响应"""
    explanation: str
    model: str = "mock"
    offline: bool = True


class SimilarQuestionsRequest(BaseModel):
    """相似题目检索请求"""
    query: str = Field(..., description="查询文本")
    top_k: int = Field(default=5, ge=1, le=20, description="返回结果数量")


class SimilarQuestionItem(BaseModel):
    """相似题目项"""
    id: str
    type: str
    difficulty: int
    title: str
    content: str
    answer: str
    solution: str
    tags: list[str]
    subject: str
    similarity: float


class SimilarQuestionsResponse(BaseModel):
    """相似题目检索响应"""
    query: str
    results: list[SimilarQuestionItem]
    total: int


# ─── 路由 ───────────────────────────────────────────────────

@router.post("/query", response_model=RAGQueryResponse)
async def query_knowledge(request: RAGQueryRequest):
    """
    知识检索

    根据查询文本检索相关知识内容。
    可用于学习时查找相关知识点。
    """
    rag = get_rag_service()
    contexts = await rag.retrieve_context(request.query, top_k=request.top_k)

    results = [
        KnowledgePointItem(
            id=ctx["id"],
            name=ctx["name"],
            description=ctx["description"],
            keywords=ctx.get("keywords", []),
            subject=ctx.get("subject", ""),
            chapter=ctx.get("chapter", ""),
            section=ctx.get("section", ""),
            difficulty=ctx.get("difficulty", 1),
            importance=ctx.get("importance", 1),
            similarity=ctx.get("similarity", 0.0),
        )
        for ctx in contexts
    ]

    return RAGQueryResponse(
        query=request.query,
        results=results,
        total=len(results),
    )


@router.post("/explain", response_model=ExplainResponse)
async def explain_question(request: ExplainRequest):
    """
    题目解析

    对指定题目进行 AI 驱动的详细解析，结合相关知识库内容。
    """
    from config import settings

    llm = get_llm_service()
    explanation = await llm.generate_explanation(
        question=request.question,
        answer=request.answer,
        context=request.context,
    )

    return ExplainResponse(
        explanation=explanation,
        model=settings.LLM_MODEL_NAME if not settings.offline_mode else "mock",
        offline=settings.offline_mode,
    )


@router.post("/similar", response_model=SimilarQuestionsResponse)
async def similar_questions(request: SimilarQuestionsRequest):
    """
    相似题目检索

    根据查询文本检索相似的题目。
    """
    rag = get_rag_service()
    questions = await rag.search_similar_questions(request.query, top_k=request.top_k)

    results = [
        SimilarQuestionItem(
            id=q["id"],
            type=q.get("type", ""),
            difficulty=q.get("difficulty", 1),
            title=q.get("title", ""),
            content=q.get("content", ""),
            answer=q.get("answer", ""),
            solution=q.get("solution", ""),
            tags=q.get("tags", []),
            subject=q.get("subject", ""),
            similarity=q.get("similarity", 0.0),
        )
        for q in questions
    ]

    return SimilarQuestionsResponse(
        query=request.query,
        results=results,
        total=len(results),
    )


@router.get("/health")
async def health_check():
    """健康检查"""
    rag = get_rag_service()
    return {
        "status": "ok",
        "service": "rag",
        "knowledge_chunks": len(rag._knowledge_chunks),
        "question_chunks": len(rag._question_chunks),
    }
