"""
手写识别数据模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class ContentType(str, Enum):
    """内容类型"""
    TEXT = "text"  # 普通文本
    MATH = "math"  # 数学公式
    ENGLISH = "english"  # 英文
    CHINESE = "chinese"  # 中文
    MIXED = "mixed"  # 混合


class RecognizedCharacter(BaseModel):
    """识别字符"""
    character: str = Field(..., description="识别的字符")
    confidence: float = Field(..., ge=0, le=1, description="置信度")
    position: tuple[int, int, int, int] = Field(..., description="位置(x, y, width, height)")
    alternatives: List[str] = Field(default_factory=list, description="候选字符")


class RecognizedLine(BaseModel):
    """识别行"""
    text: str = Field(..., description="识别文本")
    confidence: float = Field(..., ge=0, le=1, description="置信度")
    characters: List[RecognizedCharacter] = Field(default_factory=list, description="字符列表")
    position: tuple[int, int, int, int] = Field(..., description="行位置")


class HandwritingRequest(BaseModel):
    """手写识别请求"""
    image_base64: Optional[str] = Field(None, description="Base64编码图片")
    image_url: Optional[str] = Field(None, description="图片URL")
    content_type: ContentType = Field(default=ContentType.TEXT, description="内容类型")
    language: str = Field(default="zh", description="语言")
    enable_math_detection: bool = Field(default=True, description="启用数学公式检测")
    user_id: Optional[str] = Field(None, description="用户ID")


class HandwritingResponse(BaseModel):
    """手写识别响应"""
    text: str = Field(..., description="识别文本")
    lines: List[RecognizedLine] = Field(default_factory=list, description="识别行列表")
    overall_confidence: float = Field(..., ge=0, le=1, description="整体置信度")
    content_type: ContentType = Field(..., description="检测到的内容类型")
    math_expressions: List[str] = Field(default_factory=list, description="数学表达式")
    processing_time_ms: int = Field(..., description="处理时间(毫秒)")
    metadata: Dict = Field(default_factory=dict, description="元数据")


class StrokePoint(BaseModel):
    """笔画点"""
    x: float = Field(..., description="X坐标")
    y: float = Field(..., description="Y坐标")
    timestamp: int = Field(..., description="时间戳(毫秒)")
    pressure: Optional[float] = Field(None, description="压力值")


class Stroke(BaseModel):
    """笔画"""
    points: List[StrokePoint] = Field(..., description="点列表")
    color: str = Field(default="#000000", description="颜色")
    width: float = Field(default=2.0, description="线宽")


class RealtimeRecognitionRequest(BaseModel):
    """实时识别请求"""
    strokes: List[Stroke] = Field(..., description="笔画列表")
    language: str = Field(default="zh", description="语言")
    previous_text: Optional[str] = Field(None, description="之前识别的文本")


class RealtimeRecognitionResponse(BaseModel):
    """实时识别响应"""
    text: str = Field(..., description="识别文本")
    candidates: List[str] = Field(default_factory=list, description="候选文本")
    confidence: float = Field(..., ge=0, le=1, description="置信度")
    is_complete: bool = Field(default=False, description="是否完整字符")
