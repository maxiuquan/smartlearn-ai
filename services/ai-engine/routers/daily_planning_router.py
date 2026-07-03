"""
每日规划路由
"""
from fastapi import APIRouter

from models.daily_planning import (
    DailyPlanRequest,
    DailyPlanResponse,
    UpdatePlanRequest,
    UpdatePlanResponse,
    WeeklyPlanRequest,
    WeeklyPlanResponse
)
from services.daily_planning_service import DailyPlanningService

router = APIRouter(prefix="/daily-planning", tags=["每日规划"])

# 服务实例
planning_service = DailyPlanningService()

# 临时存储计划（实际应用中应使用数据库）
_plans_store = {}


@router.post("/create", response_model=DailyPlanResponse)
async def create_daily_plan(request: DailyPlanRequest):
    """
    创建每日计划
    
    智能分配每日学习任务：
    - 复习任务安排
    - 薄弱知识点练习
    - 新知识学习
    - 趣味游戏
    """
    response = await planning_service.create_daily_plan(request)
    _plans_store[response.plan.plan_id] = response.plan
    return response


@router.post("/update", response_model=UpdatePlanResponse)
async def update_plan(request: UpdatePlanRequest):
    """
    更新计划进度
    
    更新每日计划的完成进度
    """
    plan = _plans_store.get(request.plan_id)
    if not plan:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return await planning_service.update_plan(plan, request)


@router.post("/weekly", response_model=WeeklyPlanResponse)
async def create_weekly_plan(request: WeeklyPlanRequest):
    """
    创建周计划
    
    为一周创建学习计划
    """
    response = await planning_service.create_weekly_plan(request)
    for plan in response.daily_plans:
        _plans_store[plan.plan_id] = plan
    return response


@router.get("/{plan_id}")
async def get_daily_plan(plan_id: str):
    """
    获取每日计划详情
    """
    plan = _plans_store.get(plan_id)
    if not plan:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return plan


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "daily_planning"}
