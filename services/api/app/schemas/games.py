"""游戏相关 Pydantic schemas"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class GameConfigResponse(BaseModel):
    """游戏配置响应"""

    game_id: str
    name: str
    description: str
    type: str
    icon: Optional[str] = None
    min_level: int = 1
    subject: str = "english"
    config: Optional[dict[str, Any]] = None


class GameListResponse(BaseModel):
    """游戏列表响应"""

    games: list[GameConfigResponse]


class GameDetailResponse(GameConfigResponse):
    """游戏详情响应"""

    leaderboard_top: Optional[list["LeaderboardEntry"]] = None
    user_best_score: Optional[int] = None
    user_best_rank: Optional[int] = None


class GameSessionRequest(BaseModel):
    """提交游戏会话请求"""

    game_id: str = Field(..., min_length=1)
    score: int = Field(..., ge=0)
    accuracy: Optional[float] = Field(None, ge=0, le=1)
    duration: Optional[int] = Field(None, ge=0, description="游戏时长（秒）")
    started_at: datetime = Field(...)
    finished_at: Optional[datetime] = None
    details: Optional[dict[str, Any]] = None

    model_config = {"extra": "forbid"}


class GameSessionResponse(BaseModel):
    """游戏会话响应"""

    session_id: int
    xp_gained: int
    coins_gained: int
    new_level: Optional[int] = None
    level_up: bool = False
    achievements_unlocked: list[str] = Field(default_factory=list)


class LeaderboardEntry(BaseModel):
    """排行榜条目"""

    rank: int
    user_id: int
    username: Optional[str] = None
    score: int
    level: int = 1
    badge: Optional[str] = None


class LeaderboardResponse(BaseModel):
    """排行榜响应"""

    scope: str  # friends / global / daily / weekly
    entries: list[LeaderboardEntry]
    user_rank: Optional[int] = None
    updated_at: datetime