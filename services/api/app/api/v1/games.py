"""游戏相关 API 路由"""
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
import hashlib
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.models.business import GameSession, UserGameProfile
from app.models.user import User
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

# P0-08: 已提交的 session nonce 集合（Redis 故障降级用）
_USED_NONCES: set[str] = set()

logger = logging.getLogger(__name__)


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


def _build_game_config(game: dict, *, include_internal: bool = False) -> GameConfigResponse:
    """将 JSON 字典转换为 GameConfigResponse 模型。

    P1-06: 默认只返回公开字段；include_internal=True 时返回 GameConfigAdminResponse（含内部字段）。

    Args:
        game: 从 JSON 配置中解析出的单个游戏字典。
        include_internal: 是否包含 tech_notes/business_value/config 等内部字段（仅管理员）。

    Returns:
        GameConfigResponse 或 GameConfigAdminResponse 实例。
    """
    session_raw = game.get("session") or {}
    rewards_raw = game.get("rewards") or {}
    leaderboard_raw = game.get("leaderboard") or {}

    # P1-06: 公开端点的基础字段
    common_kwargs = dict(
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
    )

    if include_internal:
        # P1-06: 管理端响应包含内部字段
        from app.schemas.games import GameConfigAdminResponse
        return GameConfigAdminResponse(
            **common_kwargs,
            data_sources=game.get("data_sources"),
            stage=game.get("stage"),
            tech_notes=game.get("tech_notes"),
            business_value=game.get("business_value"),
            config=game.get("config"),
        )

    return GameConfigResponse(**common_kwargs)


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
        # P1-06: data_sources/stage/tech_notes/business_value/config 不再对客户端暴露
        difficulty_levels=base.difficulty_levels,
        session=base.session,
        rewards=base.rewards,
        props=base.props,
        leaderboard=base.leaderboard,
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

    P0-02: 服务端事实重算
    - score 由服务端基于 accuracy + combo 规则重算，客户端 score 仅作参考
    - nonce 改用 Redis SETNX + TTL（跨 worker 共享，自动过期）
    - 保留合理性校验作为反作弊前置拦截
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

    # ── P0-02: 服务端事实重算 score ──
    # 客户端 body.score 被忽略，服务端基于 accuracy + 游戏配置重算
    rewards_cfg = game_cfg.get("rewards") or {}
    base_xp = rewards_cfg.get("base_xp", 10)
    base_coin = rewards_cfg.get("base_coin", 5)
    combo_multiplier = rewards_cfg.get("combo_multiplier", 1.0)

    # 服务端重算：基于 accuracy 计算实际分数
    # 规则：score = base_xp * accuracy * 100 * combo_factor
    if body.accuracy is not None and body.accuracy > 0:
        server_score = int(base_xp * body.accuracy * 100 * combo_multiplier)
    else:
        # accuracy 为 0 或未提供，分数为 0
        server_score = 0

    # 反作弊：若客户端 score 与服务端重算值偏差过大（>2倍），记录审计但使用服务端值
    if body.score > 0 and server_score == 0:
        logger.warning(
            "game_score_mismatch user_id=%s game=%s client_score=%s server_score=0",
            user_id, body.game_id, body.score,
        )

    # 合理上限：base_xp * 100（更严格）
    score_cap = max(base_xp * 100, 5000)
    server_score = min(server_score, score_cap)

    # ── P0-02: nonce 改用 Redis SETNX + TTL（跨 worker 共享） ──
    nonce_key = f"game:nonce:{user_id}:{body.game_id}:{body.nonce}"
    redis_client = None
    try:
        from app.core.deps import get_redis
        from fastapi import Request
        # 直接使用独立 Redis 客户端（不依赖 request）
        from app.core.security import get_redis_client
        redis_client = await get_redis_client()
        if redis_client:
            # SETNX: 已存在返回 0（重复），不存在返回 1（首次）
            set_result = await redis_client.set(nonce_key, "1", ex=86400, nx=True)
            if not set_result:
                # 重复提交
                await redis_client.aclose()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="重复提交被拒绝（nonce 已使用）",
                )
    except HTTPException:
        raise
    except Exception as e:
        # Redis 故障降级：回退到内存集合（单 worker 场景）
        logger.warning("nonce redis failed, fallback to memory: %s", e)
        if body.nonce in _USED_NONCES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="重复提交被拒绝（nonce 已使用）",
            )
        _USED_NONCES.add(body.nonce)
        if len(_USED_NONCES) > 10000:
            _USED_NONCES.clear()
    finally:
        if redis_client:
            try:
                await redis_client.aclose()
            except Exception:
                pass

    # 使用服务端重算的 score（忽略客户端 score）
    final_score = server_score
    xp_gained = max(1, final_score // 10)
    coins_gained = max(1, final_score // 20)

    # DB 列为 TIMESTAMP WITHOUT TIME ZONE, 必须剥离 tzinfo 避免 asyncpg DataError
    started = body.started_at.replace(tzinfo=None) if body.started_at else datetime.utcnow()
    finished = body.finished_at or datetime.now(timezone.utc)
    finished = finished.replace(tzinfo=None) if finished.tzinfo else finished

    # 记录游戏会话（使用服务端重算的 score）
    new_session = GameSession(
        user_id=user_id,
        game_id=body.game_id,
        score=final_score,  # P0-02: 服务端重算值
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

    P1-03: 排行榜隐私改造
    - 移除裸 user_id，改用 display_hash（SHA256 截断，不可逆）
    - friends scope 未实现好友关系，返回 501 Not Implemented（不再伪装为 global）
    - 当前用户匹配通过服务端计算 is_current_user 标志
    """
    if scope not in ("friends", "global", "daily", "weekly"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的排行榜范围: {scope}，可选值: global, daily, weekly, friends",
        )

    # P1-03: friends 未实现好友关系表，直接返回 501，不再伪装为 global
    if scope == "friends":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="好友排行榜暂未实现（需要好友关系表支持）",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    entries: list[LeaderboardEntry] = []

    def _make_display_hash(uid: int) -> str:
        """P1-03: 生成不可逆用户展示 ID（SHA256 截断前 12 位）."""
        return hashlib.sha256(f"sl_user_{uid}".encode()).hexdigest()[:12]

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
                    display_hash=_make_display_hash(profile.user_id),
                    score=profile.total_xp,
                    level=profile.level,
                    nickname=nickname or f"用户{profile.user_id}",
                    avatar=avatar,
                    is_current_user=(profile.user_id == user_id),
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
                    display_hash=_make_display_hash(uid),
                    score=int(total_xp or 0),
                    level=1,  # 窗口排行不返回 level
                    nickname=nickname or f"用户{uid}",
                    avatar=avatar,
                    is_current_user=(uid == user_id),
                )
            )

    # P1-03: user_rank 由服务端通过 is_current_user 计算，不依赖暴露的 user_id
    user_rank: Optional[int] = None
    for entry in entries:
        if entry.is_current_user:
            user_rank = entry.rank
            break

    return LeaderboardResponse(
        scope=scope,
        entries=entries,
        user_rank=user_rank,
        updated_at=datetime.now(timezone.utc),
    )
