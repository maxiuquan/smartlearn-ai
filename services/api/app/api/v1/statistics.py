"""统计 API 路由.

提供管理后台仪表盘所需的概览与用户分析数据。
所有端点要求管理员权限。
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_db
from app.models.business import (
    AIConversation,
    GameSession,
    Question,
    VocabularyWord,
)
from app.models.user import User
from app.schemas.admin import StatisticsOverviewResponse, UserAnalysisResponse

router = APIRouter()


async def _count(db: AsyncSession, stmt) -> int:
    """执行 count 标量查询并返回 int。"""
    return (await db.execute(stmt)).scalar() or 0


@router.get(
    "/overview",
    response_model=StatisticsOverviewResponse,
    summary="统计概览",
)
async def get_overview(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> StatisticsOverviewResponse:
    """返回管理后台仪表盘的概览数据。

    - total_users: 用户总数
    - active_users_7d: 近 7 天有登录行为的用户数
    - new_users_7d: 近 7 天新增用户数
    - total_questions / total_vocab / total_ai_calls / total_game_sessions: 业务总量
    - vip_users: VIP 等级 > 0 的用户数
    """
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    total_users = await _count(db, select(func.count()).select_from(User))
    active_users_7d = await _count(
        db,
        select(func.count())
        .select_from(User)
        .where(User.last_login_at >= seven_days_ago),
    )
    new_users_7d = await _count(
        db,
        select(func.count())
        .select_from(User)
        .where(User.created_at >= seven_days_ago),
    )
    total_questions = await _count(db, select(func.count()).select_from(Question))
    total_vocab = await _count(db, select(func.count()).select_from(VocabularyWord))
    total_ai_calls = await _count(db, select(func.count()).select_from(AIConversation))
    total_game_sessions = await _count(
        db, select(func.count()).select_from(GameSession)
    )
    vip_users = await _count(
        db,
        select(func.count()).select_from(User).where(User.vip_level > 0),
    )

    return StatisticsOverviewResponse(
        total_users=total_users,
        active_users_7d=active_users_7d,
        new_users_7d=new_users_7d,
        total_questions=total_questions,
        total_vocab=total_vocab,
        total_ai_calls=total_ai_calls,
        total_game_sessions=total_game_sessions,
        vip_users=vip_users,
    )


@router.get(
    "/users",
    response_model=UserAnalysisResponse,
    summary="用户分析（趋势 + 分布）",
)
async def get_user_analysis(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> UserAnalysisResponse:
    """返回用户分析数据。

    - new_users_daily: 近 30 天每日新增用户数
    - active_users_daily: 近 30 天每日活跃用户数（按 last_login_at 日期分组）
    - role_distribution: 按角色分布
    - vip_distribution: 按 VIP 等级分布
    """
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # 每日新增用户数（PostgreSQL 用 func.date_trunc）
    new_users_stmt = (
        select(
            func.to_char(func.date_trunc("day", User.created_at), "YYYY-MM-DD").label(
                "date"
            ),
            func.count().label("count"),
        )
        .where(User.created_at >= thirty_days_ago)
        .group_by(func.date_trunc("day", User.created_at))
        .order_by(func.date_trunc("day", User.created_at))
    )
    new_users_rows = (await db.execute(new_users_stmt)).all()
    new_users_daily = [
        {"date": row.date, "count": int(row.count)} for row in new_users_rows
    ]

    # 每日活跃用户数（按 last_login_at 日期分组）
    active_users_stmt = (
        select(
            func.to_char(func.date_trunc("day", User.last_login_at), "YYYY-MM-DD").label(
                "date"
            ),
            func.count().label("count"),
        )
        .where(User.last_login_at.is_not(None))
        .where(User.last_login_at >= thirty_days_ago)
        .group_by(func.date_trunc("day", User.last_login_at))
        .order_by(func.date_trunc("day", User.last_login_at))
    )
    active_users_rows = (await db.execute(active_users_stmt)).all()
    active_users_daily = [
        {"date": row.date, "count": int(row.count)} for row in active_users_rows
    ]

    # 角色分布
    role_stmt = select(User.role, func.count()).group_by(User.role)
    role_rows = (await db.execute(role_stmt)).all()
    role_distribution = {str(row[0]): int(row[1]) for row in role_rows}

    # VIP 等级分布（key 用字符串）
    vip_stmt = select(User.vip_level, func.count()).group_by(User.vip_level)
    vip_rows = (await db.execute(vip_stmt)).all()
    vip_distribution = {str(row[0]): int(row[1]) for row in vip_rows}

    return UserAnalysisResponse(
        new_users_daily=new_users_daily,
        active_users_daily=active_users_daily,
        role_distribution=role_distribution,
        vip_distribution=vip_distribution,
    )
