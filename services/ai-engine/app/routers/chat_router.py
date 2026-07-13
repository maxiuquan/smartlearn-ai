"""
AI 导师对话路由

P1-4.2: 聊天输入边界治理
- messages ≤ 20 条 / 每条 ≤ 4k 字符 / 总上下文 ≤ 32k 字符
- 禁止用户提交 system / tool role（仅允许 user / assistant）
- 失败统一返回结构化 5xx + trace ID，不再以模拟内容掩盖 Provider 故障

P1-R3: Prompt 安全 + 速率限制
- 用户外部输入只允许 user/assistant role（_sanitize_messages 纵深防御）
- AI 接口速率限制：Per-user 20 req/min / Per-IP 30 req/min（滑动窗口）
"""
import json
import logging
import time
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, status
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


# ─── 速率限制常量（P1-R3）──────────────────────────────────
_RATE_WINDOW_SECONDS = 60   # 滑动窗口：1 分钟
_RATE_PER_USER = 20         # 每用户每分钟 20 次
_RATE_PER_IP = 30           # 每 IP 每分钟 30 次

# 滑动窗口存储：key -> list[timestamp]（内存，进程级）
_user_request_times: dict[str, list[float]] = defaultdict(list)
_ip_request_times: dict[str, list[float]] = defaultdict(list)


def _sanitize_messages(messages: list[dict]) -> list[dict]:
    """P1 (R3): 过滤用户提交的消息，只允许 user/assistant role.

    纵深防御：即使 Pydantic 层已校验 role，仍在传入 LLM 前再次过滤，
    确保任何 system / tool 消息（含未来字段扩展）不会到达模型。
    """
    allowed_roles = {"user", "assistant"}
    return [msg for msg in messages if msg.get("role") in allowed_roles]


def _prune_window(store: dict[str, list[float]], key: str, now: float) -> list[float]:
    """移除滑动窗口外的旧时间戳，返回仍在窗口内的时间戳列表"""
    window_start = now - _RATE_WINDOW_SECONDS
    fresh = [t for t in store[key] if t > window_start]
    store[key] = fresh
    return fresh


def _check_rate_limit(http_request: Request, auth: dict) -> None:
    """P1-R3: AI 接口速率限制（滑动窗口）

    Per-user: 20 req/min；Per-IP: 30 req/min。
    超限时抛出 429。

    用户标识优先使用 JWT sub；无 sub（匿名/服务密钥）时回退到 IP。
    """
    now = time.time()

    # 获取客户端 IP（优先 X-Forwarded-For，兼容反向代理）
    forwarded = http_request.headers.get("x-forwarded-for", "")
    if forwarded:
        ip_key = forwarded.split(",")[0].strip()
    else:
        ip_key = http_request.client.host if http_request.client else "unknown"

    # 获取用户标识：JWT sub 优先，否则回退到 IP
    user_sub = auth.get("sub")
    user_key = f"user:{user_sub}" if user_sub else f"ip:{ip_key}"

    # 检查 IP 限制
    ip_fresh = _prune_window(_ip_request_times, ip_key, now)
    if len(ip_fresh) >= _RATE_PER_IP:
        raise HTTPException(
            status_code=429,
            detail=f"请求过于频繁：IP 每分钟最多 {_RATE_PER_IP} 次请求，请稍后重试",
        )

    # 检查用户限制
    user_fresh = _prune_window(_user_request_times, user_key, now)
    if len(user_fresh) >= _RATE_PER_USER:
        raise HTTPException(
            status_code=429,
            detail=f"请求过于频繁：用户每分钟最多 {_RATE_PER_USER} 次请求，请稍后重试",
        )

    # 记录本次请求
    _ip_request_times[ip_key].append(now)
    _user_request_times[user_key].append(now)


# ─── 请求/响应模型 ──────────────────────────────────────────

class ChatMessage(BaseModel):
    """对话消息"""
    model_config = {"extra": "forbid"}  # P1-07: 禁止未声明字段（防 embedding/tools 注入）

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
    model_config = {"extra": "forbid"}  # P1-07: 禁止未声明字段

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
async def chat(
    request: ChatRequest,
    http_request: Request,
    auth: dict = Depends(require_auth),
):
    """
    AI 导师对话

    发送对话消息，获取 AI 导师的回复。
    会自动检索相关知识库内容作为上下文增强。

    P1-4.2: 输入边界治理 — 限制 messages 数量/长度/角色；
    失败统一返回结构化 5xx + trace ID。
    P1-R3: 速率限制 + _sanitize_messages 纵深防御。
    """
    from config import settings

    # P1-R3: 速率限制（Per-user 20/min, Per-IP 30/min）
    _check_rate_limit(http_request, auth)

    llm = get_llm_service()
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    # P1-R3: 纵深防御 — 再次过滤，确保只允许 user/assistant role 到达 LLM
    messages = _sanitize_messages(messages)

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
async def chat_stream(
    request: ChatRequest,
    http_request: Request,
    auth: dict = Depends(require_auth),
):
    """AI 导师对话（流式 SSE）

    通过 Server-Sent Events 逐 token 返回 AI 回复，大幅降低首字延迟。
    前端使用 EventSource 或 fetch ReadableStream 消费。

    SSE 事件格式:
      data: {"type":"chunk","content":"你好"}\\n\\n
      data: {"type":"done","model":"glm-4-flash"}\\n\\n
      data: {"type":"error","message":"..."}\\n\\n

    P1-4.2: 输入边界治理同 /chat。
    P1-R3: 速率限制 + _sanitize_messages 纵深防御。
    """
    from config import settings

    # P1-R3: 速率限制（Per-user 20/min, Per-IP 30/min）
    _check_rate_limit(http_request, auth)

    llm = get_llm_service()
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    # P1-R3: 纵深防御 — 再次过滤，确保只允许 user/assistant role 到达 LLM
    messages = _sanitize_messages(messages)

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
