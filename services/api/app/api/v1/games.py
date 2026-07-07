"""游戏相关 API 路由"""
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.models.business import GameSession, UserGameProfile
from app.schemas.games import (
    GameConfigResponse,
    GameDetailResponse,
    GameLeaderboardConfig,
    GameListResponse,
    GameRewards,
    GameSessionConfig,
    GameSessionRequest,
    GameSessionResponse,
    LeaderboardEntry,
    LeaderboardResponse,
)

router = APIRouter()

# JSON 配置文件路径：项目根目录 / data / games / games-config.json
_GAMES_CONFIG_PATH = Path(__file__).resolve().parents[5] / "data" / "games" / "games-config.json"


def _load_games_config() -> list[dict]:
    """从 JSON 文件加载全部游戏配置。

    Returns:
        游戏配置字典列表，若文件不存在或解析失败则返回空列表。
    """
    try:
        with open(_GAMES_CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("games", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _build_game_config(game: dict) -> GameConfigResponse:
    """将 JSON 字典转换为 GameConfigResponse 模型。

    Args:
        game: 从 JSON 配置中解析出的单个游戏字典。

    Returns:
        GameConfigResponse 实例。
    """
    session_raw = game.get("session") or {}
    rewards_raw = game.get("rewards") or {}
    leaderboard_raw = game.get("leaderboard") or {}

    return GameConfigResponse(
        game_id=game["game_id"],
        name=game["name"],
        name_en=game.get("name_en"),
        description=game.get("description", ""),
        category=game.get("category"),
        type=game.get("type"),
        icon=game.get("icon"),
        min_level=game.get("min_level", 1),
        subject=game.get("subject", "english"),
        subjects=game.get("subjects"),
        learning_goal=game.get("learning_goal"),
        core_mechanisms=game.get("core_mechanisms"),
        data_sources=game.get("data_sources"),
        difficulty_levels=game.get("difficulty_levels"),
        session=GameSessionConfig(
            time_limit_sec=session_raw.get("time_limit_sec", 0),
            lives=session_raw.get("lives", 0),
            combo_enabled=session_raw.get("combo_enabled", False),
        ),
        rewards=GameRewards(
            base_xp=rewards_raw.get("base_xp", 0),
            base_coin=rewards_raw.get("base_coin", 0),
            combo_multiplier=rewards_raw.get("combo_multiplier", 1.0),
        ),
        props=game.get("props"),
        leaderboard=GameLeaderboardConfig(
            enabled=leaderboard_raw.get("enabled", False),
            scopes=leaderboard_raw.get("scopes", []),
        ),
        stage=game.get("stage"),
        tech_notes=game.get("tech_notes"),
        business_value=game.get("business_value"),
        config=game.get("config"),
    )


@router.get(
    "",
    response_model=GameListResponse,
    summary="获取所有游戏配置",
)
async def list_games(
    db: AsyncSession = Depends(get_db),
) -> GameListResponse:
    """获取所有可用游戏的配置列表。

    - 从 games-config.json 加载全部游戏配置
    - 包含游戏名称、描述、分类、学习目标、核心机制等信息
    """
    games_raw = _load_games_config()
    games = [_build_game_config(g) for g in games_raw]
    return GameListResponse(games=games)


@router.get(
    "/{game_id}",
    response_model=GameDetailResponse,
    summary="获取游戏详情",
)
async def get_game_detail(
    game_id: str,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GameDetailResponse:
    """获取指定游戏的详细配置和用户最佳成绩。

    - 从 games-config.json 加载游戏详情
    """
    games_raw = _load_games_config()
    game_data = next((g for g in games_raw if g["game_id"] == game_id), None)

    if not game_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"游戏 '{game_id}' 不存在",
        )

    base = _build_game_config(game_data)

    # 查询用户该游戏的最佳成绩
    best_score_result = await db.execute(
        select(func.max(GameSession.score)).where(
            GameSession.user_id == user_id,
            GameSession.game_id == game_id,
        )
    )
    user_best_score = best_score_result.scalar()

    return GameDetailResponse(
        game_id=base.game_id,
        name=base.name,
        name_en=base.name_en,
        description=base.description,
        category=base.category,
        type=base.type,
        icon=base.icon,
        min_level=base.min_level,
        subject=base.subject,
        subjects=base.subjects,
        learning_goal=base.learning_goal,
        core_mechanisms=base.core_mechanisms,
        data_sources=base.data_sources,
        difficulty_levels=base.difficulty_levels,
        session=base.session,
        rewards=base.rewards,
        props=base.props,
        leaderboard=base.leaderboard,
        stage=base.stage,
        tech_notes=base.tech_notes,
        business_value=base.business_value,
        config=base.config,
        user_best_score=user_best_score,
    )


@router.post(
    "/{game_id}/sessions",
    response_model=GameSessionResponse,
    summary="提交游戏会话",
)
async def submit_game_session(
    game_id: str,
    body: GameSessionRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GameSessionResponse:
    """提交完成的游戏会话，记录分数并更新用户游戏档案。

    - 记录分数、经验值、金币
    - 更新用户等级
    - 检查成就解锁
    """
    # 计算经验值和金币
    xp_gained = max(1, body.score // 10)
    coins_gained = max(1, body.score // 20)

    # 记录游戏会话
    new_session = GameSession(
        user_id=user_id,
        game_id=body.game_id,
        score=body.score,
        xp_gained=xp_gained,
        coins_gained=coins_gained,
        accuracy=body.accuracy,
        duration=body.duration,
        started_at=body.started_at,
        finished_at=body.finished_at or datetime.now(timezone.utc),
    )
    db.add(new_session)
    await db.flush()  # 获取自增 ID
    session_id = new_session.id

    # 更新用户游戏档案
    await db.execute(
        text(
            """
            INSERT INTO user_game_profile (user_id, level, total_xp, coins, streak_days, updated_at)
            VALUES (:user_id, 1, :xp, :coins, 0, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                total_xp = user_game_profile.total_xp + :xp,
                coins = user_game_profile.coins + :coins,
                updated_at = NOW()
            """
        ),
        {"user_id": user_id, "xp": xp_gained, "coins": coins_gained},
    )

    await db.commit()

    return GameSessionResponse(
        session_id=session_id,
        xp_gained=xp_gained,
        coins_gained=coins_gained,
    )


@router.get(
    "/leaderboards/{scope}",
    response_model=LeaderboardResponse,
    summary="获取排行榜",
)
async def get_leaderboard(
    scope: str,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> LeaderboardResponse:
    """获取排行榜数据。

    - scope 可选值: friends, global, daily, weekly
    """
    if scope not in ("friends", "global", "daily", "weekly"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的排行榜范围: {scope}，可选值: friends, global, daily, weekly",
        )

    result = await db.execute(
        select(UserGameProfile)
        .order_by(UserGameProfile.total_xp.desc())
        .limit(50)
    )
    rows = result.scalars().all()

    entries = [
        LeaderboardEntry(
            rank=i + 1,
            user_id=row.user_id,
            score=row.total_xp,
            level=row.level,
        )
        for i, row in enumerate(rows)
    ]

    # 查找当前用户排名
    user_rank: Optional[int] = None
    for entry in entries:
        if entry.user_id == user_id:
            user_rank = entry.rank
            break

    return LeaderboardResponse(
        scope=scope,
        entries=entries,
        user_rank=user_rank,
        updated_at=datetime.now(timezone.utc),
    )
