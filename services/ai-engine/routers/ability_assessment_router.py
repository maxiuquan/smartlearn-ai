"""
能力评估路由
"""
from fastapi import APIRouter

from models.ability_assessment import (
    AbilityAssessmentRequest,
    AbilityAssessmentResponse,
    BatchAssessmentRequest,
    BatchAssessmentResponse
)
from services.ability_assessment_service import AbilityAssessmentService

router = APIRouter(prefix="/ability", tags=["能力评估"])

# 服务实例
ability_service = AbilityAssessmentService()


@router.post("/assess", response_model=AbilityAssessmentResponse)
async def assess_ability(request: AbilityAssessmentRequest):
    """
    评估用户能力
    
    根据答题表现评估用户能力：
    - 计算能力值和等级
    - 分析各知识点掌握情况
    - 生成提升建议
    """
    return await ability_service.assess_ability(request)


@router.post("/batch-assess", response_model=BatchAssessmentResponse)
async def batch_assess(request: BatchAssessmentRequest):
    """
    批量评估多科目能力
    
    一次评估多个科目的能力水平
    """
    return await ability_service.batch_assess(request)


@router.get("/levels")
async def get_ability_levels():
    """
    获取能力等级说明
    """
    return {
        "levels": [
            {"level": "beginner", "range": "1-2", "description": "初学者"},
            {"level": "elementary", "range": "3-4", "description": "初级"},
            {"level": "intermediate", "range": "5-6", "description": "中级"},
            {"level": "advanced", "range": "7-8", "description": "高级"},
            {"level": "expert", "range": "9-10", "description": "专家"},
        ]
    }


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "ability_assessment"}
