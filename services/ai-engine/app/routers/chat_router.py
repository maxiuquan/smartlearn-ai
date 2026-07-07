"""
AI 导师对话路由
"""
import logging
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.services.llm_service import get_llm_service
from app.auth import require_auth
from app.providers import ProviderUnavailableError

logger = logging.getLogger("ai_engine.routers.chat")

router = APIRouter(prefix="/chat", tags=["AI 对话"])


# ─── 请求/响应模型 ──────────────────────────────────────────

class ChatMessage(BaseModel):
    """对话消息"""
    role: str = Field(..., description="角色: user / assistant / system")
    content: str = Field(..., description="消息内容")


class ChatRequest(BaseModel):
    """对话请求"""
    messages: list[ChatMessage] = Field(..., description="对话历史消息列表")
    context: str = Field(default="", description="可选的附加上下文")


class ChatResponse(BaseModel):
    """对话响应"""
    reply: str = Field(..., description="AI 回复内容")
    model: str = Field(default="mock", description="使用的模型名称")
    offline: bool = Field(default=True, description="是否为离线模式")
    simulated: bool = Field(
        default=False,
        description="是否为离线模拟响应（透明标注，不伪装为真实模型输出）",
    )
    reason: str = Field(default="", description="模拟原因，如 offline_mode")


# ─── 路由 ───────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest, _auth: dict = Depends(require_auth)):
    """
    AI 导师对话

    发送对话消息，获取 AI 导师的回复。
    会自动检索相关知识库内容作为上下文增强。
    """
    from config import settings

    llm = get_llm_service()
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    try:
        reply = llm.chat(messages, context=request.context)
    except ProviderUnavailableError as e:
        # 运行时故障：返回 503 + 结构化错误体，使故障可见（不再静默 mock）
        trace_id = e.trace_id or uuid.uuid4().hex
        logger.error(
            "Chat 供应商不可用: provider=%s error_type=%s trace_id=%s msg=%s",
            e.provider,
            e.error_type,
            trace_id,
            e.message,
        )
        return JSONResponse(
            status_code=503,
            content={
                "detail": "AI 供应商当前不可用，请稍后重试",
                "provider": e.provider,
                "error_type": e.error_type,
                "trace_id": trace_id,
            },
        )

    return ChatResponse(
        reply=reply,
        model=settings.LLM_MODEL_NAME if not settings.offline_mode else "mock",
        offline=settings.offline_mode,
        simulated=settings.offline_mode,
        reason="offline_mode" if settings.offline_mode else "",
    )


@router.get("/health")
async def health_check():
    """健康检查"""
    from config import settings

    return {
        "status": "ok",
        "service": "chat",
        "model": settings.LLM_MODEL_NAME,
        "offline": settings.offline_mode,
    }
