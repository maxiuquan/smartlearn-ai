"""
学习计划路由
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.llm_service import get_llm_service

router = APIRouter(prefix="/study", tags=["学习规划"])


# ─── 请求/响应模型 ──────────────────────────────────────────

class StudyPlanRequest(BaseModel):
    """学习计划请求"""
    subject: str = Field(..., description="学科名称，如：高等数学、英语、线性代数、概率论")
    weak_points: list[str] = Field(..., description="薄弱知识点列表")
    duration_weeks: int = Field(default=4, ge=1, le=12, description="计划周期（周）")


class StudyPlanResponse(BaseModel):
    """学习计划响应"""
    plan: str = Field(..., description="学习计划内容")
    subject: str
    weak_points_count: int
    model: str = "mock"
    offline: bool = True


# ─── 路由 ───────────────────────────────────────────────────

@router.post("/plan", response_model=StudyPlanResponse)
async def generate_plan(request: StudyPlanRequest):
    """
    生成学习计划

    根据学生的薄弱知识点，生成个性化的学习计划。
    会结合知识库中的知识点详情进行智能规划。
    """
    from config import settings

    llm = get_llm_service()
    plan_text = await llm.generate_study_plan(
        subject=request.subject,
        weak_points=request.weak_points,
    )

    return StudyPlanResponse(
        plan=plan_text,
        subject=request.subject,
        weak_points_count=len(request.weak_points),
        model=settings.LLM_MODEL_NAME if not settings.offline_mode else "mock",
        offline=settings.offline_mode,
    )


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "study_plan"}
