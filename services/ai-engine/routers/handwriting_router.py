"""
手写识别路由
"""
from fastapi import APIRouter

from models.handwriting import (
    HandwritingRequest,
    HandwritingResponse,
    RealtimeRecognitionRequest,
    RealtimeRecognitionResponse
)
from services.handwriting_service import HandwritingService

router = APIRouter(prefix="/handwriting", tags=["手写识别"])

# 服务实例
handwriting_service = HandwritingService()


@router.post("/recognize", response_model=HandwritingResponse)
async def recognize_handwriting(request: HandwritingRequest):
    """
    识别手写内容
    
    对手写图片进行OCR识别：
    - 文字识别
    - 数学公式检测
    - 多语言支持
    """
    return await handwriting_service.recognize(request)


@router.post("/realtime", response_model=RealtimeRecognitionResponse)
async def realtime_recognize(request: RealtimeRecognitionRequest):
    """
    实时手写识别
    
    基于笔画数据进行实时识别：
    - 增量识别
    - 候选词建议
    - 实时反馈
    """
    return await handwriting_service.realtime_recognize(request)


@router.get("/languages")
async def get_supported_languages():
    """
    获取支持的语言列表
    """
    return {
        "languages": [
            {"code": "zh", "name": "中文"},
            {"code": "en", "name": "英文"},
            {"code": "ja", "name": "日文"},
            {"code": "ko", "name": "韩文"},
        ]
    }


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "handwriting"}
