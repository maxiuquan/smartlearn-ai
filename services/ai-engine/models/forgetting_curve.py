"""
遗忘曲线算法数据模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class MemoryStrength(str, Enum):
    """记忆强度等级"""
    NEW = "new"  # 新学
    WEAK = "weak"  # 弱记忆
    MEDIUM = "medium"  # 中等记忆
    STRONG = "strong"  # 强记忆
    MASTERED = "mastered"  # 已掌握


class ReviewSchedule(BaseModel):
    """复习计划"""
    knowledge_point_id: str = Field(..., description="知识点ID")
    knowledge_point_name: str = Field(..., description="知识点名称")
    next_review_date: datetime = Field(..., description="下次复习日期")
    review_interval_days: int = Field(..., description="复习间隔(天)")
    memory_strength: MemoryStrength = Field(..., description="记忆强度")
    retention_rate: float = Field(..., ge=0, le=1, description="记忆保持率")
    review_count: int = Field(..., ge=0, description="已复习次数")
    priority: int = Field(..., ge=1, description="复习优先级")
    is_overdue: bool = Field(..., description="是否已过期")


class LearningRecord(BaseModel):
    """学习记录"""
    knowledge_point_id: str = Field(..., description="知识点ID")
    learned_at: datetime = Field(..., description="学习时间")
    performance: float = Field(..., ge=0, le=1, description="表现分数")
    time_spent_minutes: int = Field(..., ge=0, description="花费时间(分钟)")


class ForgettingCurveRequest(BaseModel):
    """遗忘曲线请求"""
    user_id: str = Field(..., description="用户ID")
    knowledge_point_id: Optional[str] = Field(None, description="指定知识点ID")
    days_ahead: int = Field(default=7, ge=1, le=30, description="预测天数")
    learning_records: Optional[List[LearningRecord]] = Field(None, description="学习记录")


class ForgettingCurveResponse(BaseModel):
    """遗忘曲线响应"""
    user_id: str = Field(..., description="用户ID")
    schedules: List[ReviewSchedule] = Field(..., description="复习计划列表")
    overdue_count: int = Field(..., description="过期知识点数")
    upcoming_count: int = Field(..., description="即将到期数")
    average_retention: float = Field(..., description="平均记忆保持率")
    curve_data: dict = Field(default_factory=dict, description="曲线数据点")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")


class ReviewResult(BaseModel):
    """复习结果"""
    knowledge_point_id: str = Field(..., description="知识点ID")
    reviewed_at: datetime = Field(..., description="复习时间")
    performance: float = Field(..., ge=0, le=1, description="表现分数")
    correct: bool = Field(..., description="是否正确")
    time_spent_seconds: int = Field(..., ge=0, description="花费时间(秒)")


class UpdateMemoryRequest(BaseModel):
    """更新记忆请求"""
    user_id: str = Field(..., description="用户ID")
    review_result: ReviewResult = Field(..., description="复习结果")


class UpdateMemoryResponse(BaseModel):
    """更新记忆响应"""
    knowledge_point_id: str = Field(..., description="知识点ID")
    new_memory_strength: MemoryStrength = Field(..., description="新的记忆强度")
    new_retention_rate: float = Field(..., description="新的记忆保持率")
    next_review_date: datetime = Field(..., description="下次复习日期")
    review_interval_days: int = Field(..., description="新的复习间隔")
