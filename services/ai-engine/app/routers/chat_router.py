"""
AI 导师对话路由
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.llm_service import get_llm_service

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


# ─── 路由 ───────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    AI 导师对话

    发送对话消息，获取 AI 导师的回复。
    会自动检索相关知识库内容作为上下文增强。
    """
    from config import settings

    llm = get_llm_service()
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    reply = llm.chat(messages, context=request.context)

    return ChatResponse(
        reply=reply,
        model=settings.LLM_MODEL_NAME if not settings.offline_mode else "mock",
        offline=settings.offline_mode,
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