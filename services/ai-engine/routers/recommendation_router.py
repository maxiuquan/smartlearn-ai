"""
智能推题引擎路由
"""
from fastapi import APIRouter, Depends
from typing import Annotated

from models.recommendation import (
    RecommendationRequest,
    RecommendationResponse
)
from services.recommendation_service import RecommendationService

router = APIRouter(prefix="/recommendation", tags=["智能推题"])

# 服务实例
recommendation_service = RecommendationService()


@router.post("/get", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest):
    """
    获取推荐题目
    
    根据用户能力画像，智能推荐适合的题目：
    - 分析用户能力水平
    - 考虑知识点掌握度
    - 平衡难度和挑战性
    """
    return await recommendation_service.get_recommendations(request)


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "recommendation"}
