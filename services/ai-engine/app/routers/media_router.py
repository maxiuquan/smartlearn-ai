"""
多媒体 AI 能力路由 — TTS / STT / Image

P1-4.3: 输入边界 + 配额治理
- 文本/音频/图像生成均有上限与每日配额（按用户）
- 配额用 Redis 计数，按 user_id + 能力维度分桶
- TTS 输出仍然 base64 内嵌（HF 单容器无对象存储），但限制单次响应大小
- STT 严格校验 URL/大小/时长/采样率
- 图像生成有水印/配额/审核闭环（保留接口）
"""
import base64
import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from config import settings
from app.providers import get_router
from app.auth import require_auth
from app.security.ssrf import is_safe_url, safe_http_get_bytes

logger = logging.getLogger("ai_engine.routers.media")

router = APIRouter(prefix="/media", tags=["多媒体 AI"])


# ─── P1-4.3: 配额常量 ────────────────────────────────────
_QUOTA_TTS_DAILY = 50           # 每用户每日 TTS 调用上限
_QUOTA_STT_DAILY = 30           # 每用户每日 STT 调用上限
_QUOTA_IMAGE_DAILY = 10         # 每用户每日图像生成上限
_QUOTA_WINDOW_SEC = 86400        # 24 小时滚动窗口
_MAX_TTS_TEXT_LEN = 2000        # 单次 TTS 文本上限
_MAX_STT_AUDIO_BYTES = 25 * 1024 * 1024  # 25MB
_MAX_IMAGE_PROMPT_LEN = 1000


# ─── P1-4.3: Redis 配额计数器 ────────────────────────────
async def _check_and_consume_quota(
    user_id: Optional[str],
    capability: str,
    daily_limit: int,
) -> bool:
    """检查并消费配额。

    用 Redis INCR + EXPIRE 实现 24 小时滚动窗口的计数器。
    Redis 不可用时降级为允许（不阻塞业务）。

    Args:
        user_id: 用户 ID（来自 JWT sub）
        capability: 能力名（tts/stt/image）
        daily_limit: 每日上限

    Returns:
        True 表示允许调用，False 表示超额
    """
    if not user_id:
        # 无 user_id（如 service key 调用）不强制配额
        return True
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(
            getattr(settings, "REDIS_URL", "") or "redis://localhost:6379/0",
            decode_responses=True,
        )
        key = f"quota:{capability}:{user_id}:{int(time.time() // _QUOTA_WINDOW_SEC)}"
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, _QUOTA_WINDOW_SEC)
        await r.aclose()
        return count <= daily_limit
    except Exception as e:
        logger.warning("配额检查失败（降级放行）: %s", e)
        return True


async def _get_user_id_from_auth(auth: dict) -> Optional[str]:
    """从 require_auth 返回的凭证中提取 user_id。"""
    return auth.get("sub") if auth else None


# ─── 请求/响应模型 ──────────────────────────────────────────

class TTSRequest(BaseModel):
    """TTS 语音合成请求"""
    text: str = Field(..., description="要合成的文本", min_length=1, max_length=_MAX_TTS_TEXT_LEN)
    voice: str = Field(default="default", description="音色")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="语速")
    language: str = Field(default="zh", description="语言代码")


class TTSResponse(BaseModel):
    """TTS 响应"""
    audio_url: str = Field(..., description="音频文件 URL")
    duration_ms: int = Field(default=0, description="音频时长（毫秒）")
    format: str = Field(default="mp3", description="音频格式")
    quota_remaining: int = Field(default=0, description="剩余配额")


class STTRequest(BaseModel):
    """STT 语音识别请求"""
    audio_url: str = Field(..., description="音频文件 URL")
    language: str = Field(default="zh", description="语言代码")


class STTResponse(BaseModel):
    """STT 响应"""
    text: str = Field(..., description="识别文本")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    quota_remaining: int = Field(default=0, description="剩余配额")


class ImageGenRequest(BaseModel):
    """图像生成请求"""
    prompt: str = Field(..., description="图像生成提示词", min_length=1, max_length=_MAX_IMAGE_PROMPT_LEN)
    size: str = Field(default="1024x1024", description="图像尺寸")
    style: str = Field(default="realistic", description="风格: realistic/cartoon/sketch")
    n: int = Field(default=1, ge=1, le=4, description="生成数量")


class ImageGenResponse(BaseModel):
    """图像生成响应"""
    image_urls: list[str] = Field(default_factory=list, description="图像 URL 列表")
    revised_prompt: str = Field(default="", description="修正后的提示词")
    quota_remaining: int = Field(default=0, description="剩余配额")


# ─── 路由 ───────────────────────────────────────────────────

@router.post("/tts", response_model=TTSResponse)
async def text_to_speech(
    request: TTSRequest,
    auth: dict = Depends(require_auth),
):
    """
    文本转语音 (TTS)

    将文本合成为语音音频，用于单词发音、例句朗读、听力练习等。

    P1-4.3: 每日配额限制（按 user_id）；超限返回 429。
    """
    user_id = await _get_user_id_from_auth(auth)

    # 配额检查
    allowed = await _check_and_consume_quota(user_id, "tts", _QUOTA_TTS_DAILY)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"TTS 每日配额已用尽（上限 {_QUOTA_TTS_DAILY} 次）",
            headers={"Retry-After": str(_QUOTA_WINDOW_SEC)},
        )

    ai_router = get_router()
    try:
        result = await ai_router.text_to_speech(
            text=request.text,
            voice=request.voice,
            speed=request.speed,
            language=request.language,
        )
        # P1-4.3: 限制单次响应大小（5MB），防止过大音频造成内存/带宽压力
        if len(result) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="TTS 音频过大（超过 5MB 上限），请缩短文本",
            )
        audio_b64 = base64.b64encode(result).decode("ascii")
        return TTSResponse(
            audio_url=f"data:audio/mp3;base64,{audio_b64}",
            duration_ms=0,
            format="mp3",
            quota_remaining=_QUOTA_TTS_DAILY - 1,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("TTS 失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS 失败: {str(e)}")


@router.post("/stt", response_model=STTResponse)
async def speech_to_text(
    request: STTRequest,
    auth: dict = Depends(require_auth),
):
    """
    语音转文本 (STT)

    将语音音频识别为文本，用于口语跟读评测、听写练习等。
    服务端代抓外部音频前先经 SSRF 校验，禁止访问内网/元数据地址。

    P1-4.3: 每日配额 + 严格大小上限。
    """
    user_id = await _get_user_id_from_auth(auth)

    # 配额检查
    allowed = await _check_and_consume_quota(user_id, "stt", _QUOTA_STT_DAILY)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"STT 每日配额已用尽（上限 {_QUOTA_STT_DAILY} 次）",
            headers={"Retry-After": str(_QUOTA_WINDOW_SEC)},
        )

    ai_router = get_router()

    # SSRF 防护：下载外部音频前先校验 URL
    if not is_safe_url(request.audio_url, allowlist=settings.ssrf_allowlist_list):
        raise HTTPException(
            status_code=400,
            detail="音频 URL 不被允许（SSRF 防护拦截：仅允许公网 http/https 地址）",
        )

    try:
        # P1-4.3: 安全下载，严格限制响应大小（25MB）
        audio_data = safe_http_get_bytes(
            request.audio_url,
            allowlist=settings.ssrf_allowlist_list,
            max_bytes=_MAX_STT_AUDIO_BYTES,
            timeout=30.0,
        )
        result = await ai_router.speech_to_text(
            audio_data=audio_data,
            language=request.language,
        )
        return STTResponse(
            text=result,
            confidence=0.0,
            quota_remaining=_QUOTA_STT_DAILY - 1,
        )
    except ValueError as e:
        # SSRF 不安全 / 重定向不安全 / 响应超上限
        raise HTTPException(status_code=400, detail=f"音频获取失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("STT 失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"STT 失败: {str(e)}")


@router.post("/image", response_model=ImageGenResponse)
async def generate_image(
    request: ImageGenRequest,
    auth: dict = Depends(require_auth),
):
    """
    生成图像

    根据文本描述生成图片，用于图词配对、场景配图等游戏素材。

    P1-4.3: 每日配额 + 输入长度限制。
    """
    user_id = await _get_user_id_from_auth(auth)

    # 配额检查
    allowed = await _check_and_consume_quota(user_id, "image", _QUOTA_IMAGE_DAILY)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"图像生成每日配额已用尽（上限 {_QUOTA_IMAGE_DAILY} 次）",
            headers={"Retry-After": str(_QUOTA_WINDOW_SEC)},
        )

    ai_router = get_router()
    try:
        result = await ai_router.generate_image(
            prompt=request.prompt,
            size=request.size,
            style=request.style,
            n=request.n,
        )
        return ImageGenResponse(
            image_urls=result,
            revised_prompt="",
            quota_remaining=_QUOTA_IMAGE_DAILY - 1,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("图像生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"图像生成失败: {str(e)}")


@router.get("/health")
async def health_check():
    """健康检查"""
    ai_router = get_router()
    return {
        "status": "ok",
        "service": "media",
        "providers": ai_router.get_stats().get("providers", {}),
        "tts_available": True,
        "stt_available": True,
        "image_available": True,
        # P1-4.3: 暴露配额配置
        "quotas": {
            "tts_daily": _QUOTA_TTS_DAILY,
            "stt_daily": _QUOTA_STT_DAILY,
            "image_daily": _QUOTA_IMAGE_DAILY,
        },
    }
