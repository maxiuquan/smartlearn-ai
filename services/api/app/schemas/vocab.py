"""词汇相关 Pydantic schemas"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class WordResponse(BaseModel):
    """词汇响应"""

    word_id: str
    headword: str
    meaning: str
    phonetic: Optional[str] = None
    tags: Optional[list[str]] = None
    frequency: int = 0
    synonyms: Optional[list[str]] = None
    antonyms: Optional[list[str]] = None
    examples: Optional[list[dict[str, str]]] = None

    model_config = {"from_attributes": True}


class WordListResponse(BaseModel):
    """词汇列表响应"""

    items: list[WordResponse]
    total: int
    page: int = 1
    page_size: int = 20


class WordProgressResponse(BaseModel):
    """用户词汇进度响应"""

    word_id: str
    headword: str
    meaning: str
    status: str
    mastery_level: float
    next_review_at: Optional[datetime] = None
    review_count: int
    correct_count: int
    wrong_count: int

    model_config = {"from_attributes": True}


class WordProgressSummaryResponse(BaseModel):
    """用户词汇进度汇总"""

    total_words: int
    mastered: int
    learning: int
    new_words: int
    due_today: int
    average_mastery: float
    progress_by_tag: Optional[dict[str, int]] = None


class WordEventRequest(BaseModel):
    """单词学习事件请求"""

    word_id: str = Field(..., min_length=1)
    event_type: str = Field(
        ..., pattern=r"^(learned|reviewed|correct|wrong|mastered|forgotten)$"
    )
    game_id: Optional[str] = None
    duration_ms: Optional[int] = Field(None, ge=0)
    metadata: Optional[dict[str, Any]] = None

    model_config = {"extra": "forbid"}