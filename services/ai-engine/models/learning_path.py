"""
学习路径生成数据模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class LearningStatus(str, Enum):
    """学习状态"""
    NOT_STARTED = "not_started"  # 未开始
    IN_PROGRESS = "in_progress"  # 进行中
    COMPLETED = "completed"  # 已完成
    SKIPPED = "skipped"  # 已跳过
    LOCKED = "locked"  # 锁定


class LearningStep(BaseModel):
    """学习步骤"""
    step_id: str = Field(..., description="步骤ID")
    knowledge_point_id: str = Field(..., description="知识点ID")
    knowledge_point_name: str = Field(..., description="知识点名称")
    order: int = Field(..., ge=1, description="顺序")
    status: LearningStatus = Field(default=LearningStatus.NOT_STARTED, description="状态")
    estimated_time_minutes: int = Field(..., ge=1, description="预估时间(分钟)")
    difficulty: float = Field(..., ge=0, le=1, description="难度")
    prerequisites: List[str] = Field(default_factory=list, description="前置知识点")
    dependencies: List[str] = Field(default_factory=list, description="依赖步骤")
    resources: List[str] = Field(default_factory=list, description="学习资源")
    practice_questions: int = Field(default=5, ge=0, description="练习题数量")
    description: Optional[str] = Field(None, description="步骤描述")


class LearningPath(BaseModel):
    """学习路径"""
    path_id: str = Field(..., description="路径ID")
    name: str = Field(..., description="路径名称")
    subject: str = Field(..., description="科目")
    target_knowledge: str = Field(..., description="目标知识点")
    steps: List[LearningStep] = Field(..., description="学习步骤")
    total_steps: int = Field(..., description="总步骤数")
    total_time_minutes: int = Field(..., description="总时间(分钟)")
    completed_steps: int = Field(default=0, description="已完成步骤")
    progress: float = Field(default=0, ge=0, le=1, description="进度")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")


class LearningPathRequest(BaseModel):
    """学习路径请求"""
    user_id: str = Field(..., description="用户ID")
    target_knowledge_id: str = Field(..., description="目标知识点ID")
    current_knowledge: Optional[List[str]] = Field(None, description="当前已学知识点")
    mastered_knowledge: Optional[List[str]] = Field(None, description="已掌握知识点")
    time_available_minutes: Optional[int] = Field(None, description="可用时间(分钟)")
    learning_style: Optional[str] = Field(None, description="学习风格")
    difficulty_preference: Optional[float] = Field(None, ge=0, le=1, description="难度偏好")


class LearningPathResponse(BaseModel):
    """学习路径响应"""
    user_id: str = Field(..., description="用户ID")
    path: LearningPath = Field(..., description="学习路径")
    estimated_completion_date: Optional[datetime] = Field(None, description="预计完成日期")
    milestones: List[Dict] = Field(default_factory=list, description="里程碑")
    alternative_paths: List[LearningPath] = Field(default_factory=list, description="备选路径")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")


class PathProgressUpdate(BaseModel):
    """路径进度更新"""
    path_id: str = Field(..., description="路径ID")
    step_id: str = Field(..., description="步骤ID")
    status: LearningStatus = Field(..., description="新状态")
    actual_time_minutes: Optional[int] = Field(None, description="实际时间(分钟)")
    score: Optional[float] = Field(None, ge=0, le=1, description="得分")


class PathProgressResponse(BaseModel):
    """路径进度响应"""
    path_id: str = Field(..., description="路径ID")
    updated_step: LearningStep = Field(..., description="更新后的步骤")
    overall_progress: float = Field(..., ge=0, le=1, description="整体进度")
    next_step: Optional[LearningStep] = Field(None, description="下一步")
    unlocked_steps: List[str] = Field(default_factory=list, description="解锁的步骤")
    is_completed: bool = Field(..., description="是否完成")


class AdaptivePathRequest(BaseModel):
    """自适应路径请求"""
    user_id: str = Field(..., description="用户ID")
    current_path_id: str = Field(..., description="当前路径ID")
    performance: Dict[str, float] = Field(..., description="各知识点表现")
    struggling_points: Optional[List[str]] = Field(None, description="困难知识点")
    fast_points: Optional[List[str]] = Field(None, description="快速掌握的知识点")


class AdaptivePathResponse(BaseModel):
    """自适应路径响应"""
    path_id: str = Field(..., description="路径ID")
    adjustments: List[Dict] = Field(..., description="调整内容")
    new_steps: List[LearningStep] = Field(default_factory=list, description="新增步骤")
    removed_steps: List[str] = Field(default_factory=list, description="移除步骤")
    reason: str = Field(..., description="调整原因")
