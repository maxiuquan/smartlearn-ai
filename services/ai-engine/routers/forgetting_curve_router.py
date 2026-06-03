"""
遗忘曲线路由
"""
from fastapi import APIRouter
from datetime import datetime

from models.forgetting_curve import (
    ForgettingCurveRequest,
    ForgettingCurveResponse,
    UpdateMemoryRequest,
    UpdateMemoryResponse
)
from services.forgetting_curve_service import ForgettingCurveService

router = APIRouter(prefix="/forgetting-curve", tags=["遗忘曲线"])

# 服务实例
forgetting_curve_service = ForgettingCurveService()


@router.post("/schedule", response_model=ForgettingCurveResponse)
async def get_review_schedule(request: ForgettingCurveRequest):
    """
    获取复习计划
    
    基于艾宾浩斯遗忘曲线计算复习计划：
    - 计算记忆保持率
    - 生成复习时间表
    - 确定复习优先级
    """
    return await forgetting_curve_service.calculate_review_schedule(request)


@router.post("/update", response_model=UpdateMemoryResponse)
async def update_memory(request: UpdateMemoryRequest):
    """
    更新记忆状态
    
    根据复习结果更新记忆状态：
    - 调整记忆强度
    - 计算下次复习时间
    - 更新保持率
    """
    return await forgetting_curve_service.update_memory(request)


@router.get("/curve-data")
async def get_curve_data(days: int = 30):
    """
    获取遗忘曲线数据
    
    返回指定天数内的遗忘曲线数据点
    """
    import numpy as np
    
    points = []
    for day in range(days + 1):
        retention = np.exp(-0.03 * day)
        points.append({
            "day": day,
            "retention": round(float(retention), 3)
        })
    
    return {
        "points": points,
        "formula": "R = e^(-0.03t)",
        "description": "艾宾浩斯遗忘曲线"
    }


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "forgetting_curve"}
