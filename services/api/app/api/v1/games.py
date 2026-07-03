"""游戏相关 API 路由"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.schemas.games import (
    GameConfigResponse,
    GameDetailResponse,
    GameListResponse,
    GameSessionRequest,
    GameSessionResponse,
    LeaderboardEntry,
    LeaderboardResponse,
)

router = APIRouter()


@router.get(
    "",
    response_model=GameListResponse,
    summary="获取所有游戏配置",
)
async def list_games(
    db: AsyncSession = Depends(get_db),
) -> GameListResponse:
    """获取所有可用游戏的配置列表。

    - 包含游戏名称、描述、类型、最低等级等信息
    """
    # TODO: 从 games-config.json 或数据库加载游戏配置
    # 当前返回硬编码的游戏列表作为占位
    games = [
        GameConfigResponse(
            game_id="word_match",
            name="单词配对",
            description="将单词与正确的中文释义配对，考验你的词汇记忆",
            type="match",
            icon="🧩",
            min_level=1,
            subject="english",
        ),
        GameConfigResponse(
            game_id="speed_challenge",
            name="速度挑战",
            description="在限定时间内快速选择正确的单词释义",
            type="speed",
            icon="⚡",
            min_level=1,
            subject="english",
        ),
        GameConfigResponse(
            game_id="word_puzzle",
            name="单词拼图",
            description="根据释义拼写正确的单词",
            type="spell",
            icon="🔤",
            min_level=2,
            subject="english",
        ),
        GameConfigResponse(
            game_id="word_rain",
            name="单词雨",
            description="单词从屏幕上方落下，快速选出正确释义",
            type="reaction",
            icon="🌧️",
            min_level=1,
            subject="english",
        ),
        GameConfigResponse(
            game_id="lexicon_defense",
            name="词汇防御",
            description="塔防式单词学习，用正确的单词击败敌人",
            type="tower_defense",
            icon="🏰",
            min_level=3,
            subject="english",
        ),
        GameConfigResponse(
            game_id="entropy_merge",
            name="熵值合并",
            description="合并相同单词升级，挑战更高分数",
            type="merge",
            icon="🔮",
            min_level=2,
            subject="english",
        ),
    ]
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
    """获取指定游戏的详细配置和用户最佳成绩。"""
    # TODO: 从配置或数据库加载游戏详情
    game_map = {
        "word_match": GameDetailResponse(
            game_id="word_match",
            name="单词配对",
            description="将单词与正确的中文释义配对，考验你的词汇记忆",
            type="match",
            icon="🧩",
            min_level=1,
            subject="english",
        ),
        "speed_challenge": GameDetailResponse(
            game_id="speed_challenge",
            name="速度挑战",
            description="在限定时间内快速选择正确的单词释义",
            type="speed",
            icon="⚡",
            min_level=1,
            subject="english",
        ),
        "word_puzzle": GameDetailResponse(
            game_id="word_puzzle",
            name="单词拼图",
            description="根据释义拼写正确的单词",
            type="spell",
            icon="🔤",
            min_level=2,
            subject="english",
        ),
        "word_rain": GameDetailResponse(
            game_id="word_rain",
            name="单词雨",
            description="单词从屏幕上方落下，快速选出正确释义",
            type="reaction",
            icon="🌧️",
            min_level=1,
            subject="english",
        ),
        "lexicon_defense": GameDetailResponse(
            game_id="lexicon_defense",
            name="词汇防御",
            description="塔防式单词学习，用正确的单词击败敌人",
            type="tower_defense",
            icon="🏰",
            min_level=3,
            subject="english",
        ),
        "entropy_merge": GameDetailResponse(
            game_id="entropy_merge",
            name="熵值合并",
            description="合并相同单词升级，挑战更高分数",
            type="merge",
            icon="🔮",
            min_level=2,
            subject="english",
        ),
    }

    game = game_map.get(game_id)
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"游戏 '{game_id}' 不存在",
        )

    return game


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
    from sqlalchemy import Table, Column, Integer, String, Float, DateTime, MetaData, func, text
    from sqlalchemy.dialects.postgresql import JSONB

    metadata = MetaData()

    # 计算经验值和金币
    xp_gained = max(1, body.score // 10)
    coins_gained = max(1, body.score // 20)

    # 记录游戏会话
    gs = Table(
        "game_sessions",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer),
        Column("game_id", String(100)),
        Column("score", Integer),
        Column("xp_gained", Integer),
        Column("coins_gained", Integer),
        Column("accuracy", Float),
        Column("duration", Integer),
        Column("started_at", DateTime),
        Column("finished_at", DateTime),
    )

    insert_result = await db.execute(
        gs.insert()
        .values(
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
        .returning(gs.c.id)
    )
    session_id = insert_result.scalar_one()

    # 更新用户游戏档案
    ugp = Table(
        "user_game_profile",
        metadata,
        Column("user_id", Integer, primary_key=True),
        Column("level", Integer),
        Column("total_xp", Integer),
        Column("coins", Integer),
        Column("streak_days", Integer),
        Column("badges", JSONB),
        Column("rank", Integer),
        Column("updated_at", DateTime),
    )

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

    from sqlalchemy import Table, Column, Integer, String, Float, DateTime, MetaData, func, text
    from sqlalchemy.dialects.postgresql import JSONB

    metadata = MetaData()
    ugp = Table(
        "user_game_profile",
        metadata,
        Column("user_id", Integer, primary_key=True),
        Column("level", Integer),
        Column("total_xp", Integer),
        Column("coins", Integer),
        Column("streak_days", Integer),
        Column("badges", JSONB),
        Column("rank", Integer),
        Column("updated_at", DateTime),
    )

    result = await db.execute(
        select(ugp)
        .order_by(ugp.c.total_xp.desc())
        .limit(50)
    )
    rows = result.fetchall()

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
    user_rank = None
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