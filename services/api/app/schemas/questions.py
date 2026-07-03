"""题目相关 Pydantic schemas"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class QuestionResponse(BaseModel):
    """题目响应"""

    id: int
    subject: str
    knowledge_points: Optional[list[dict[str, Any]]] = None
    type: str
    difficulty: int
    title: Optional[str] = None
    content: str
    options: Optional[list[dict[str, Any]]] = None
    answer: Optional[str] = None  # 列表或详情页隐藏，练习页不返回
    solution: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QuestionListResponse(BaseModel):
    """题目列表响应"""

    items: list[QuestionResponse]
    total: int
    page: int = 1
    page_size: int = 20


class QuestionAttemptRequest(BaseModel):
    """提交答案请求"""

    user_answer: str = Field(..., min_length=1)
    duration_ms: Optional[int] = Field(None, ge=0, description="作答耗时（毫秒）")

    model_config = {"extra": "forbid"}


class QuestionAttemptResponse(BaseModel):
    """提交答案响应"""

    correct: bool
    correct_answer: Optional[str] = None
    solution: Optional[str] = None
    xp_gained: int = 0
    mastery_update: Optional[dict[str, Any]] = None


class RecommendRequest(BaseModel):
    """推荐题目请求参数"""

    subject: Optional[str] = None
    count: int = Field(default=10, ge=1, le=50)
    exclude_ids: Optional[list[int]] = None


class RecommendResponse(BaseModel):
    """推荐题目响应"""

    questions: list[QuestionResponse]
    recommendation_reason: Optional[str] = None