"""
AI 导师对话路由

P1-4.2: 聊天输入边界治理
- messages ≤ 20 条 / 每条 ≤ 4k 字符 / 总上下文 ≤ 32k 字符
- 禁止用户提交 system / tool role（仅允许 user / assistant）
- 失败统一返回结构化 5xx + trace ID，不再以模拟内容掩盖 Provider 故障
"""
import json
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.services.llm_service import get_llm_service
from app.auth import require_auth
from app.providers import ProviderUnavailableError

logger = logging.getLogger("ai_engine.routers.chat")

router = APIRouter(prefix="/chat", tags=["AI 对话"])


# ─── 输入边界常量（P1-4.2）─────────────────────────────────
_MAX_MESSAGES = 20             # 单次请求最多 20 条消息
_MAX_PER_MESSAGE_CHARS = 4000   # 单条消息最多 4k 字符
_MAX_TOTAL_CHARS = 32_000       # 总上下文最多 ~32k 字符
_ALLOWED_USER_ROLES = {"user", "assistant"}  # 禁止用户提交 system / tool


# ─── 请求/响应模型 ──────────────────────────────────────────

class ChatMessage(BaseModel):
    """对话消息"""
    role: str = Field(..., description="角色: user / assistant")
    content: str = Field(..., description="消息内容")

    @field_validator("role")
    @classmethod
    def _validate_role(cls, v: str) -> str:
        # P1-4.2: 禁止用户提交 system / tool role，防止与系统提示词竞争
        if v not in _ALLOWED_USER_ROLES:
            raise ValueError(
                f"禁止的 role: {v!r}；仅允许 user / assistant"
            )
        return v

    @field_validator("content")
    @classmethod
    def _validate_content(cls, v: str) -> str:
        if len(v) > _MAX_PER_MESSAGE_CHARS:
            raise ValueError(
                f"单条消息长度超过上限 {_MAX_PER_MESSAGE_CHARS} 字符"
            )
        return v


class ChatRequest(BaseModel):
    """对话请求"""
    messages: list[ChatMessage] = Field(..., description="对话历史消息列表")
    context: str = Field(default="", description="可选的附加上下文")

    @field_validator("messages")
    @classmethod
    def _validate_messages(cls, v: list[ChatMessage]) -> list[ChatMessage]:
        # P1-4.2: 限制消息数量
        if len(v) > _MAX_MESSAGES:
            raise ValueError(
                f"messages 数量超过上限 {_MAX_MESSAGES} 条"
            )
        # 限制总字符数
        total_chars = sum(len(m.content) for m in v)
        if total_chars > _MAX_TOTAL_CHARS:
            raise ValueError(
                f"消息总长度 {total_chars} 超过上限 {_MAX_TOTAL_CHARS} 字符"
            )
        return v

    @field_validator("context")
    @classmethod
    def _validate_context(cls, v: str) -> str:
        if len(v) > _MAX_PER_MESSAGE_CHARS:
            raise ValueError(
                f"context 长度超过上限 {_MAX_PER_MESSAGE_CHARS} 字符"
            )
        return v


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
async def chat(request: ChatRequest, auth: dict = Depends(require_auth)):
    """
    AI 导师对话

    发送对话消息，获取 AI 导师的回复。
    会自动检索相关知识库内容作为上下文增强。

    P1-4.2: 输入边界治理 — 限制 messages 数量/长度/角色；
    失败统一返回结构化 5xx + trace ID。
    """
    from config import settings

    llm = get_llm_service()
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    try:
        reply = await llm.chat(messages, context=request.context)
    except ProviderUnavailableError as e:
        # P1-4.2: 运行时故障：返回 503 + 结构化错误体，使故障可见（不再静默 mock）
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


@router.post("/stream")
async def chat_stream(request: ChatRequest, auth: dict = Depends(require_auth)):
    """AI 导师对话（流式 SSE）

    通过 Server-Sent Events 逐 token 返回 AI 回复，大幅降低首字延迟。
    前端使用 EventSource 或 fetch ReadableStream 消费。

    SSE 事件格式:
      data: {"type":"chunk","content":"你好"}\\n\\n
      data: {"type":"done","model":"glm-4-flash"}\\n\\n
      data: {"type":"error","message":"..."}\\n\\n

    P1-4.2: 输入边界治理同 /chat。
    """
    from config import settings

    llm = get_llm_service()
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    async def event_generator():
        try:
            async for chunk in llm.chat_stream(messages, context=request.context):
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'model': settings.LLM_MODEL_NAME, 'offline': settings.offline_mode}, ensure_ascii=False)}\n\n"
        except ProviderUnavailableError as e:
            trace_id = e.trace_id or uuid.uuid4().hex
            logger.error(
                "Chat stream 供应商不可用: provider=%s error_type=%s trace_id=%s",
                e.provider, e.error_type, trace_id,
            )
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI 供应商当前不可用，请稍后重试', 'trace_id': trace_id}, ensure_ascii=False)}\n\n"
        except Exception as e:
            # P1-4.2: 异常返回 trace_id，不再以模拟内容掩盖故障
            trace_id = uuid.uuid4().hex
            logger.error("Chat stream 异常: trace_id=%s err=%s", trace_id, e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': '内部错误', 'trace_id': trace_id}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
