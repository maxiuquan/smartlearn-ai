"""
多媒体 AI 能力路由 — TTS / STT / Image
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.providers import get_router

router = APIRouter(prefix="/media", tags=["多媒体 AI"])


# ─── 请求/响应模型 ──────────────────────────────────────────

class TTSRequest(BaseModel):
    """TTS 语音合成请求"""
    text: str = Field(..., description="要合成的文本", min_length=1, max_length=2000)
    voice: str = Field(default="default", description="音色")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="语速")
    language: str = Field(default="zh", description="语言代码")


class TTSResponse(BaseModel):
    """TTS 响应"""
    audio_url: str = Field(..., description="音频文件 URL")
    duration_ms: int = Field(default=0, description="音频时长（毫秒）")
    format: str = Field(default="mp3", description="音频格式")


class STTRequest(BaseModel):
    """STT 语音识别请求"""
    audio_url: str = Field(..., description="音频文件 URL")
    language: str = Field(default="zh", description="语言代码")


class STTResponse(BaseModel):
    """STT 响应"""
    text: str = Field(..., description="识别文本")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="置信度")


class ImageGenRequest(BaseModel):
    """图像生成请求"""
    prompt: str = Field(..., description="图像生成提示词", min_length=1, max_length=1000)
    size: str = Field(default="1024x1024", description="图像尺寸")
    style: str = Field(default="realistic", description="风格: realistic/cartoon/sketch")
    n: int = Field(default=1, ge=1, le=4, description="生成数量")


class ImageGenResponse(BaseModel):
    """图像生成响应"""
    image_urls: list[str] = Field(default_factory=list, description="图像 URL 列表")
    revised_prompt: str = Field(default="", description="修正后的提示词")


# ─── 路由 ───────────────────────────────────────────────────

@router.post("/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    """
    文本转语音 (TTS)

    将文本合成为语音音频，用于单词发音、例句朗读、听力练习等。
    """
    ai_router = get_router()
    try:
        result = await ai_router.text_to_speech(
            text=request.text,
            voice=request.voice,
            speed=request.speed,
            language=request.language,
        )
        return TTSResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS 失败: {str(e)}")


@router.post("/stt", response_model=STTResponse)
async def speech_to_text(request: STTRequest):
    """
    语音转文本 (STT)

    将语音音频识别为文本，用于口语跟读评测、听写练习等。
    """
    ai_router = get_router()
    try:
        result = await ai_router.speech_to_text(
            audio_url=request.audio_url,
            language=request.language,
        )
        return STTResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STT 失败: {str(e)}")


@router.post("/image", response_model=ImageGenResponse)
async def generate_image(request: ImageGenRequest):
    """
    生成图像

    根据文本描述生成图片，用于图词配对、场景配图等游戏素材。
    """
    ai_router = get_router()
    try:
        result = await ai_router.generate_image(
            prompt=request.prompt,
            size=request.size,
            style=request.style,
            n=request.n,
        )
        return ImageGenResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图像生成失败: {str(e)}")


@router.get("/health")
async def health_check():
    """健康检查"""
    ai_router = get_router()
    return {
        "status": "ok",
        "service": "media",
        "providers": ai_router.get_active_providers(),
        "tts_available": ai_router.is_capability_available("tts"),
        "stt_available": ai_router.is_capability_available("stt"),
        "image_available": ai_router.is_capability_available("image"),
    }