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
    """游戏配置响应（公开端点用）.

    P1-06: 对外 DTO 收敛 — 隐藏 tech_notes / business_value / config 等内部字段。
    """

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
    difficulty_levels: Optional[list[str]] = None
    session: Optional[GameSessionConfig] = None
    rewards: Optional[GameRewards] = None
    props: Optional[list[str]] = None
    leaderboard: Optional[GameLeaderboardConfig] = None
    # P1-06: 以下内部字段不暴露给客户端（data_sources/stage/tech_notes/business_value/config）
    # 如需展示，使用管理端 GameConfigAdminResponse 显式请求


class GameConfigAdminResponse(GameConfigResponse):
    """游戏配置管理端响应（含内部字段）.

    P1-06: 仅管理员可访问，包含 tech_notes/business_value/config 等内部字段。
    """

    data_sources: Optional[list[str]] = None
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
    # P0-02: 幂等性 nonce 必填，防止重复提交（服务端不再随机生成）
    nonce: str = Field(..., min_length=8, max_length=128, description="幂等键，客户端生成 UUID，防止重复提交")

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
    """排行榜条目.

    P1-03: 移除裸 user_id，改为 display_hash（不可逆展示 ID）。
    当前用户匹配通过服务端计算的 is_current_user 标志。
    """

    rank: int
    # P1-03: 不再暴露裸 user_id，使用不可逆 display_hash
    display_hash: Optional[str] = Field(None, description="用户不可逆展示 ID（SHA256 截断）")
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    score: int
    level: int = 1
    badge: Optional[str] = None
    # P1-03: 标识是否为当前请求用户（服务端计算，不暴露 user_id）
    is_current_user: bool = False


class LeaderboardResponse(BaseModel):
    """排行榜响应"""

    scope: str  # friends / global / daily / weekly
    entries: list[LeaderboardEntry]
    user_rank: Optional[int] = None
    updated_at: datetime


# ── P0-02 (R3): 服务端逐题作答会话架构 ──


class GameSessionStartRequest(BaseModel):
    """开始游戏会话请求 — P0-02 (R3).

    客户端仅需声明 game_id 与可选难度；题目集、nonce、过期时间均由服务端生成。
    """

    game_id: str = Field(..., min_length=1)
    difficulty: Optional[str] = Field(None, description="难度级别")
    model_config = {"extra": "forbid"}


class GameSessionStartResponse(BaseModel):
    """开始游戏会话响应 — P0-02 (R3).

    返回 session_id、server_nonce、题目集（不含答案）、过期时间与限时秒数。
    题目集中 correct_answer 字段由服务端剥离，客户端仅可见 question_id / sequence / 题面。
    """

    session_id: int
    server_nonce: str
    questions: list[dict[str, Any]]
    expires_at: datetime
    time_limit_sec: int


class GameAnswerSubmitRequest(BaseModel):
    """提交单题答案请求 — P0-02 (R3).

    客户端仅发送题目 ID、答案、序号与幂等键，由服务端判定正误并落库。
    """

    question_id: str = Field(..., min_length=1)
    answer: str = Field(...)
    sequence: int = Field(..., ge=0)
    idempotency_key: str = Field(..., min_length=8, max_length=128)
    model_config = {"extra": "forbid"}


class GameAnswerSubmitResponse(BaseModel):
    """提交单题答案响应 — P0-02 (R3).

    返回判定结果、累计已答题数与总题数。correct_answer 仅在 finish 阶段返回，
    避免客户端通过逐题试探反推答案。
    """

    is_correct: bool
    correct_answer: Optional[str] = None
    answered_count: int
    total_questions: int


class GameSessionFinishRequest(BaseModel):
    """结束游戏会话请求 — P0-02 (R3).

    无需客户端字段；服务端基于已写入的 GameAnswerEvent 一次性结算。
    """

    model_config = {"extra": "forbid"}


class GameSessionFinishResponse(BaseModel):
    """结束游戏会话响应 — P0-02 (R3).

    服务端一次性返回最终结算结果：分数、XP、金币、正确率、正确题数、总题数。
    """

    session_id: int
    score: int
    xp_gained: int
    coins_gained: int
    accuracy: float
    correct_count: int
    total_questions: int