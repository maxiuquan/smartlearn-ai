"""
能力评估数据模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class AbilityLevel(str, Enum):
    """能力等级"""
    BEGINNER = "beginner"  # 初学者 (1-2)
    ELEMENTARY = "elementary"  # 初级 (3-4)
    INTERMEDIATE = "intermediate"  # 中级 (5-6)
    ADVANCED = "advanced"  # 高级 (7-8)
    EXPERT = "expert"  # 专家 (9-10)


class SubjectType(str, Enum):
    """科目类型"""
    MATH = "math"  # 数学
    CHINESE = "chinese"  # 语文
    ENGLISH = "english"  # 英语
    PHYSICS = "physics"  # 物理
    CHEMISTRY = "chemistry"  # 化学
    BIOLOGY = "biology"  # 生物
    HISTORY = "history"  # 历史
    GEOGRAPHY = "geography"  # 地理


class UserAbility(BaseModel):
    """用户能力"""
    subject: SubjectType = Field(..., description="科目")
    level: AbilityLevel = Field(..., description="能力等级")
    level_score: int = Field(..., ge=1, le=10, description="等级分数(1-10)")
    ability_value: float = Field(..., ge=0, le=1, description="能力值(0-1)")
    confidence: float = Field(..., ge=0, le=1, description="置信度")
    assessed_at: datetime = Field(default_factory=datetime.now, description="评估时间")


class QuestionPerformance(BaseModel):
    """题目表现"""
    question_id: str = Field(..., description="题目ID")
    knowledge_point_id: str = Field(..., description="知识点ID")
    difficulty: float = Field(..., ge=0, le=1, description="题目难度")
    is_correct: bool = Field(..., description="是否正确")
    time_spent_seconds: int = Field(..., ge=0, description="花费时间")
    attempts: int = Field(default=1, ge=1, description="尝试次数")


class AbilityAssessmentRequest(BaseModel):
    """能力评估请求"""
    user_id: str = Field(..., description="用户ID")
    subject: SubjectType = Field(..., description="科目")
    performances: List[QuestionPerformance] = Field(..., description="答题表现列表")
    previous_ability: Optional[float] = Field(None, description="之前的能力值")


class AbilityAssessmentResponse(BaseModel):
    """能力评估响应"""
    user_id: str = Field(..., description="用户ID")
    subject: SubjectType = Field(..., description="科目")
    ability: UserAbility = Field(..., description="能力评估结果")
    knowledge_abilities: Dict[str, float] = Field(default_factory=dict, description="各知识点能力")
    improvement_suggestions: List[str] = Field(default_factory=list, description="提升建议")
    estimated_time_to_next_level: Optional[int] = Field(None, description="升级预估时间(小时)")
    assessed_at: datetime = Field(default_factory=datetime.now, description="评估时间")


class AbilityHistory(BaseModel):
    """能力历史"""
    user_id: str = Field(..., description="用户ID")
    subject: SubjectType = Field(..., description="科目")
    history: List[Dict[str, any]] = Field(default_factory=list, description="历史记录")
    trend: str = Field(..., description="趋势: improving/declining/stable")


class BatchAssessmentRequest(BaseModel):
    """批量评估请求"""
    user_id: str = Field(..., description="用户ID")
    subjects: List[SubjectType] = Field(..., description="科目列表")
    performances: List[QuestionPerformance] = Field(..., description="答题表现列表")


class BatchAssessmentResponse(BaseModel):
    """批量评估响应"""
    user_id: str = Field(..., description="用户ID")
    abilities: List[UserAbility] = Field(..., description="各科目能力")
    overall_ability: float = Field(..., description="综合能力")
    strongest_subject: SubjectType = Field(..., description="最强科目")
    weakest_subject: SubjectType = Field(..., description="最弱科目")
