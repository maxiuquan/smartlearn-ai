"""
智能批改路由
"""
from fastapi import APIRouter

from models.grading import (
    GradingRequest,
    GradingResponse,
    BatchGradingRequest,
    BatchGradingResponse,
    ErrorAnalysisRequest,
    ErrorAnalysisResponse
)
from services.grading_service import GradingService

router = APIRouter(prefix="/grading", tags=["智能批改"])

# 服务实例
grading_service = GradingService()


@router.post("/grade", response_model=GradingResponse)
async def grade_answer(request: GradingRequest):
    """
    批改答案
    
    对用户答案进行智能批改：
    - 正确性判断
    - 错误类型分析
    - 步骤分析（计算题）
    - 改进建议
    """
    return await grading_service.grade(request)


@router.post("/batch-grade", response_model=BatchGradingResponse)
async def batch_grade(request: BatchGradingRequest):
    """
    批量批改
    
    批量批改多个答案：
    - 统计正确率
    - 错误类型统计
    - 整体建议
    """
    return await grading_service.batch_grade(request)


@router.post("/analyze-errors", response_model=ErrorAnalysisResponse)
async def analyze_errors(request: ErrorAnalysisRequest):
    """
    分析错误模式
    
    分析用户的错误模式：
    - 错误类型统计
    - 薄弱知识点
    - 改进计划
    """
    return await grading_service.analyze_errors(request)


@router.get("/error-types")
async def get_error_types():
    """
    获取错误类型列表
    """
    return {
        "error_types": [
            {"type": "calculation", "name": "计算错误", "description": "运算过程中的错误"},
            {"type": "concept", "name": "概念错误", "description": "对概念理解有误"},
            {"type": "careless", "name": "粗心错误", "description": "因粗心导致的错误"},
            {"type": "incomplete", "name": "不完整", "description": "回答不完整"},
            {"type": "logic", "name": "逻辑错误", "description": "推理逻辑有误"},
            {"type": "method", "name": "方法错误", "description": "解题方法不当"},
            {"type": "syntax", "name": "语法错误", "description": "表达格式有误"},
        ]
    }


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "grading"}
