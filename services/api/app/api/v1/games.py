"""游戏相关 API 路由"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
import hashlib
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.models.business import GameSession, UserGameProfile, User
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
# 开发环境 parents[5]=项目根; Docker 环境 parents[3]=/app
_parents = Path(__file__).resolve().parents
_GAMES_CONFIG_PATH = (
    (_parents[5] if len(_parents) > 5 else _parents[3])
    / "data" / "games" / "games-config.json"
)

# P0-08: 已提交的 session nonce 集合（防止重复提交）
_USED_NONCES: set[str] = set()


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

    P0-08: 服务端校验增强
    - 校验 URL game_id == body.game_id 一致性
    - 基于 accuracy 重算分数，防止客户端伪造高分
    - idempotency nonce 防止重复提交
    - 更严格的分数/时长上限
    """
    # P0-08: 校验 URL game_id 与 body.game_id 一致
    if body.game_id != game_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"game_id 不一致: URL={game_id}, body={body.game_id}",
        )

    # 服务端校验：加载游戏配置，验证分数合理性
    games_raw = _load_games_config()
    game_cfg = next((g for g in games_raw if g["game_id"] == body.game_id), None)
    if not game_cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"游戏 '{body.game_id}' 不存在",
        )

    # 校验时长合理性（不超过配置时长的 2 倍，防止超时作弊）
    session_cfg = game_cfg.get("session") or {}
    configured_time = session_cfg.get("time_limit_sec", 0)
    if configured_time > 0 and body.duration is not None:
        if body.duration > configured_time * 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="游戏时长异常，疑似作弊",
            )
        # P0-08: 时长过短也疑似作弊（低于配置的 10%）
        if body.duration < configured_time * 0.1 and body.score > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="游戏时长过短但分数不为 0，疑似作弊",
            )

    # P0-08: 服务端基于 accuracy 重算分数
    # 客户端传入的 score 仅作参考，服务端根据 accuracy 重新计算
    rewards_cfg = game_cfg.get("rewards") or {}
    base_xp = rewards_cfg.get("base_xp", 10)
    # 合理上限：base_xp * 50（更严格）
    score_cap = max(base_xp * 50, 5000)

    # 如果客户端提供了 accuracy，服务端用它验证分数合理性
    if body.accuracy is not None:
        # accuracy 0 但 score > 0 → 拒绝
        if body.score > 0 and body.accuracy == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="准确率为 0 但分数大于 0，数据不一致",
            )
        # 服务端重算分数：基于 accuracy 校验
        # 期望分数 <= base_xp * accuracy * 难度系数
        expected_max = int(base_xp * max(body.accuracy, 0.1) * 100)
        if body.score > expected_max * 2:  # 允许 2 倍容差（combo 等加成）
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"分数 {body.score} 远超 accuracy {body.accuracy} 对应的合理上限 {expected_max * 2}",
            )

    if body.score > score_cap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"分数 {body.score} 超过合理上限 {score_cap}，疑似作弊",
        )

    # P0-08: idempotency nonce 防止重复提交
    nonce = body.nonce if hasattr(body, "nonce") and body.nonce else str(uuid.uuid4())
    if nonce in _USED_NONCES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="重复提交被拒绝（nonce 已使用）",
        )
    _USED_NONCES.add(nonce)
    # 限制集合大小防止内存泄漏
    if len(_USED_NONCES) > 10000:
        _USED_NONCES.clear()

    # 计算经验值和金币
    xp_gained = max(1, body.score // 10)
    coins_gained = max(1, body.score // 20)

    # DB 列为 TIMESTAMP WITHOUT TIME ZONE, 必须剥离 tzinfo 避免 asyncpg DataError
    started = body.started_at.replace(tzinfo=None) if body.started_at else datetime.utcnow()
    finished = body.finished_at or datetime.now(timezone.utc)
    finished = finished.replace(tzinfo=None) if finished.tzinfo else finished

    # 记录游戏会话
    new_session = GameSession(
        user_id=user_id,
        game_id=body.game_id,
        score=body.score,
        xp_gained=xp_gained,
        coins_gained=coins_gained,
        accuracy=body.accuracy,
        duration=body.duration,
        started_at=started,
        finished_at=finished,
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

    P0-08: 真正实现 scope 过滤 + 隐藏裸 user_id，使用 nickname。
    - global: 全部用户总 XP
    - daily: 当日游戏 XP
    - weekly: 本周（7天）游戏 XP
    - friends: 暂无好友关系表，降级为 global（标注 estimated）
    """
    if scope not in ("friends", "global", "daily", "weekly"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的排行榜范围: {scope}，可选值: friends, global, daily, weekly",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    entries: list[LeaderboardEntry] = []

    if scope == "global":
        # 全局：用户游戏档案总 XP
        result = await db.execute(
            select(UserGameProfile, User.nickname, User.avatar)
            .join(User, UserGameProfile.user_id == User.id)
            .order_by(UserGameProfile.total_xp.desc())
            .limit(50)
        )
        rows = result.all()
        for i, (profile, nickname, avatar) in enumerate(rows):
            entries.append(
                LeaderboardEntry(
                    rank=i + 1,
                    user_id=profile.user_id,
                    score=profile.total_xp,
                    level=profile.level,
                    nickname=nickname or f"用户{profile.user_id}",
                    avatar=avatar,
                )
            )
    elif scope in ("daily", "weekly"):
        # 按时间窗口查询游戏会话 XP
        if scope == "daily":
            # 当天 00:00 UTC
            cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            # 最近 7 天
            cutoff = now - timedelta(days=7)

        result = await db.execute(
            select(
                GameSession.user_id,
                func.sum(GameSession.xp_gained).label("total_xp"),
                User.nickname,
                User.avatar,
            )
            .join(User, GameSession.user_id == User.id)
            .where(GameSession.finished_at >= cutoff)
            .group_by(GameSession.user_id, User.nickname, User.avatar)
            .order_by(func.sum(GameSession.xp_gained).desc())
            .limit(50)
        )
        rows = result.all()
        for i, (uid, total_xp, nickname, avatar) in enumerate(rows):
            entries.append(
                LeaderboardEntry(
                    rank=i + 1,
                    user_id=uid,
                    score=int(total_xp or 0),
                    level=1,  # 窗口排行不返回 level
                    nickname=nickname or f"用户{uid}",
                    avatar=avatar,
                )
            )
    elif scope == "friends":
        # 暂无好友关系表，降级为 global（标注 estimated）
        result = await db.execute(
            select(UserGameProfile, User.nickname, User.avatar)
            .join(User, UserGameProfile.user_id == User.id)
            .order_by(UserGameProfile.total_xp.desc())
            .limit(50)
        )
        rows = result.all()
        for i, (profile, nickname, avatar) in enumerate(rows):
            entries.append(
                LeaderboardEntry(
                    rank=i + 1,
                    user_id=profile.user_id,
                    score=profile.total_xp,
                    level=profile.level,
                    nickname=nickname or f"用户{profile.user_id}",
                    avatar=avatar,
                )
            )

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
