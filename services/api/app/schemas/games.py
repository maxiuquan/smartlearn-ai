"""游戏相关 Pydantic schemas"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class GameSessionConfig(BaseModel):
    """游戏会话配置（单局规则）"""

    time_limit_sec: int = 0
    lives: int = 0
    combo_enabled: bool = False


class GameRewards(BaseModel):
    """游戏奖励配置"""

    base_xp: int = 0
    base_coin: int = 0
    combo_multiplier: float = 1.0


class GameLeaderboardConfig(BaseModel):
    """游戏排行榜配置"""

    enabled: bool = False
    scopes: list[str] = Field(default_factory=list)


class GameConfigResponse(BaseModel):
    """游戏配置响应"""

    game_id: str
    name: str
    name_en: Optional[str] = None
    description: str
    category: Optional[str] = None
    type: Optional[str] = None
    icon: Optional[str] = None
    min_level: int = 1
    subject: str = "english"
    subjects: Optional[list[str]] = None
    learning_goal: Optional[str] = None
    core_mechanisms: Optional[list[str]] = None
    data_sources: Optional[list[str]] = None
    difficulty_levels: Optional[list[str]] = None
    session: Optional[GameSessionConfig] = None
    rewards: Optional[GameRewards] = None
    props: Optional[list[str]] = None
    leaderboard: Optional[GameLeaderboardConfig] = None
    stage: Optional[int] = None
    tech_notes: Optional[str] = None
    business_value: Optional[str] = None
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
    # P0-08: 幂等性 nonce，防止重复提交
    nonce: Optional[str] = Field(None, description="幂等键，防止重复提交")

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
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    score: int
    level: int = 1
    badge: Optional[str] = None


class LeaderboardResponse(BaseModel):
    """排行榜响应"""

    scope: str  # friends / global / daily / weekly
    entries: list[LeaderboardEntry]
    user_rank: Optional[int] = None
    updated_at: datetime