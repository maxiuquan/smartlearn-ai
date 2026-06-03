"""
智能推题引擎数据模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class QuestionType(str, Enum):
    """题目类型"""
    CHOICE = "choice"  # 选择题
    FILL = "fill"  # 填空题
    SHORT_ANSWER = "short_answer"  # 简答题
    CALCULATION = "calculation"  # 计算题
    PROOF = "proof"  # 证明题


class DifficultyLevel(str, Enum):
    """难度等级"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


class QuestionRecommendation(BaseModel):
    """推荐题目"""
    question_id: str = Field(..., description="题目ID")
    knowledge_point_id: str = Field(..., description="知识点ID")
    question_type: QuestionType = Field(..., description="题目类型")
    difficulty: DifficultyLevel = Field(..., description="难度等级")
    difficulty_score: float = Field(..., ge=0, le=1, description="难度分数(0-1)")
    relevance_score: float = Field(..., ge=0, le=1, description="相关性分数")
    priority: int = Field(..., ge=1, description="推荐优先级")
    reason: str = Field(..., description="推荐理由")


class UserAbilityProfile(BaseModel):
    """用户能力画像"""
    user_id: str = Field(..., description="用户ID")
    overall_ability: float = Field(..., ge=0, le=1, description="综合能力值")
    subject_abilities: dict[str, float] = Field(default_factory=dict, description="各科目能力")
    knowledge_mastery: dict[str, float] = Field(default_factory=dict, description="知识点掌握度")
    weak_points: List[str] = Field(default_factory=list, description="薄弱知识点")
    strong_points: List[str] = Field(default_factory=list, description="优势知识点")


class RecommendationRequest(BaseModel):
    """推题请求"""
    user_id: str = Field(..., description="用户ID")
    subject: Optional[str] = Field(None, description="科目筛选")
    knowledge_points: Optional[List[str]] = Field(None, description="指定知识点")
    difficulty_range: Optional[tuple[float, float]] = Field(None, description="难度范围")
    count: int = Field(default=10, ge=1, le=50, description="推荐数量")
    exclude_ids: Optional[List[str]] = Field(None, description="排除的题目ID")
    user_ability: Optional[UserAbilityProfile] = Field(None, description="用户能力画像")


class RecommendationResponse(BaseModel):
    """推题响应"""
    user_id: str = Field(..., description="用户ID")
    recommendations: List[QuestionRecommendation] = Field(..., description="推荐题目列表")
    total_count: int = Field(..., description="总推荐数")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")
    strategy: str = Field(..., description="推荐策略")
    metadata: dict = Field(default_factory=dict, description="元数据")
