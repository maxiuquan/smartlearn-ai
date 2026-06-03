"""
每日规划数据模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, date
from enum import Enum


class TaskType(str, Enum):
    """任务类型"""
    LEARN = "learn"  # 学习新知识
    REVIEW = "review"  # 复习
    PRACTICE = "practice"  # 练习
    TEST = "test"  # 测试
    GAME = "game"  # 游戏


class TaskPriority(str, Enum):
    """任务优先级"""
    HIGH = "high"  # 高优先级
    MEDIUM = "medium"  # 中优先级
    LOW = "low"  # 低优先级


class DailyTask(BaseModel):
    """每日任务"""
    task_id: str = Field(..., description="任务ID")
    title: str = Field(..., description="任务标题")
    task_type: TaskType = Field(..., description="任务类型")
    priority: TaskPriority = Field(..., description="优先级")
    knowledge_point_id: Optional[str] = Field(None, description="知识点ID")
    estimated_time_minutes: int = Field(..., ge=1, description="预估时间(分钟)")
    difficulty: float = Field(..., ge=0, le=1, description="难度")
    question_count: int = Field(default=5, ge=0, description="题目数量")
    is_completed: bool = Field(default=False, description="是否完成")
    scheduled_time: Optional[datetime] = Field(None, description="计划时间")
    description: Optional[str] = Field(None, description="任务描述")
    reason: Optional[str] = Field(None, description="安排原因")


class DailyPlan(BaseModel):
    """每日计划"""
    plan_id: str = Field(..., description="计划ID")
    user_id: str = Field(..., description="用户ID")
    date: date = Field(..., description="日期")
    tasks: List[DailyTask] = Field(..., description="任务列表")
    total_time_minutes: int = Field(..., description="总时间(分钟)")
    total_tasks: int = Field(..., description="总任务数")
    completed_tasks: int = Field(default=0, description="已完成任务")
    focus_subjects: List[str] = Field(default_factory=list, description="重点科目")
    goals: List[str] = Field(default_factory=list, description="今日目标")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")


class DailyPlanRequest(BaseModel):
    """每日规划请求"""
    user_id: str = Field(..., description="用户ID")
    date: Optional[date] = Field(None, description="日期(默认今天)")
    available_time_minutes: int = Field(default=60, ge=15, description="可用时间(分钟)")
    focus_subjects: Optional[List[str]] = Field(None, description="重点科目")
    energy_level: Optional[float] = Field(None, ge=0, le=1, description="精力水平")
    preferences: Optional[Dict] = Field(None, description="偏好设置")


class DailyPlanResponse(BaseModel):
    """每日规划响应"""
    plan: DailyPlan = Field(..., description="每日计划")
    time_distribution: Dict[str, int] = Field(..., description="时间分配")
    priority_summary: Dict[TaskPriority, int] = Field(..., description="优先级统计")
    recommendations: List[str] = Field(default_factory=list, description="建议")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")


class TaskCompletion(BaseModel):
    """任务完成记录"""
    task_id: str = Field(..., description="任务ID")
    completed_at: datetime = Field(..., description="完成时间")
    actual_time_minutes: int = Field(..., ge=0, description="实际时间(分钟)")
    score: Optional[float] = Field(None, ge=0, le=1, description="得分")
    notes: Optional[str] = Field(None, description="备注")


class UpdatePlanRequest(BaseModel):
    """更新计划请求"""
    plan_id: str = Field(..., description="计划ID")
    task_completion: TaskCompletion = Field(..., description="任务完成记录")


class UpdatePlanResponse(BaseModel):
    """更新计划响应"""
    plan_id: str = Field(..., description="计划ID")
    updated_task: DailyTask = Field(..., description="更新后的任务")
    remaining_tasks: int = Field(..., description="剩余任务数")
    progress: float = Field(..., ge=0, le=1, description="进度")
    next_task: Optional[DailyTask] = Field(None, description="下一个任务")
    encouragement: str = Field(..., description="鼓励语")


class WeeklyPlanRequest(BaseModel):
    """周计划请求"""
    user_id: str = Field(..., description="用户ID")
    start_date: date = Field(..., description="开始日期")
    daily_available_minutes: int = Field(default=60, ge=15, description="每日可用时间")
    goals: Optional[List[str]] = Field(None, description="本周目标")


class WeeklyPlanResponse(BaseModel):
    """周计划响应"""
    user_id: str = Field(..., description="用户ID")
    daily_plans: List[DailyPlan] = Field(..., description="每日计划列表")
    weekly_goals: List[str] = Field(..., description="周目标")
    total_time_minutes: int = Field(..., description="总时间(分钟)")
    milestones: List[Dict] = Field(default_factory=list, description="里程碑")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")
