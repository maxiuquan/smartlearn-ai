"""统计 API 路由.

提供管理后台仪表盘所需的概览与用户分析数据。
所有端点要求管理员权限。
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_current_user, get_db
from app.models.business import (
    AIConversation,
    GameSession,
    Question,
    UserGameProfile,
    UserQuestionAttempt,
    UserWordProgress,
    VocabularyWord,
)
from app.models.user import User
from app.schemas.admin import (
    StatisticsOverviewResponse,
    StudentOverviewResponse,
    StudentProfileResponse,
    UserAnalysisResponse,
)

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
    # last_login_at / created_at 列是 TIMESTAMP WITHOUT TIME ZONE, 需剥离 tzinfo
    seven_days_ago = (now - timedelta(days=7)).replace(tzinfo=None)

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
    # last_login_at / created_at 列是 TIMESTAMP WITHOUT TIME ZONE, 需剥离 tzinfo
    thirty_days_ago = (now - timedelta(days=30)).replace(tzinfo=None)

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


@router.get(
    "/my-overview",
    response_model=StudentOverviewResponse,
    summary="学生端平台概览（无需 admin 权限）",
)
async def get_my_overview(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> StudentOverviewResponse:
    """返回学生端 Dashboard 所需的平台概览数据。

    - total_questions: 题目总数
    - total_vocab: 词汇总数
    - total_users: 注册用户数
    - today_active: 今日活跃用户数（last_login_at 在今天）
    """
    now = datetime.now(timezone.utc)
    # last_login_at 列是 TIMESTAMP WITHOUT TIME ZONE, 传 aware datetime 会触发
    # asyncpg "can't subtract offset-naive and offset-aware datetimes" 错误, 故剥离 tzinfo
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)

    total_questions = await _count(db, select(func.count()).select_from(Question))
    total_vocab = await _count(db, select(func.count()).select_from(VocabularyWord))
    total_users = await _count(db, select(func.count()).select_from(User))
    today_active = await _count(
        db,
        select(func.count())
        .select_from(User)
        .where(User.last_login_at.is_not(None))
        .where(User.last_login_at >= today_start),
    )

    return StudentOverviewResponse(
        total_questions=total_questions,
        total_vocab=total_vocab,
        total_users=total_users,
        today_active=today_active,
    )


@router.get(
    "/my-profile",
    response_model=StudentProfileResponse,
    summary="学生端个人资料统计（无需 admin 权限）",
)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> StudentProfileResponse:
    """返回学生端 Profile 所需的当前用户个人学习统计。

    - total_study_days: 注册至今的天数（学习天数近似）
    - total_questions_answered: 当前用户答题总数
    - total_correct: 当前用户答对数
    - accuracy: 正确率（0~1）
    - total_study_minutes: 游戏会话累计时长（分钟）
    - current_streak: 连续打卡天数（取自 user_game_profile）
    - vocab_mastered: 当前用户已掌握词汇数
    - last_login_at: 最近登录时间
    """
    user_id = current.id

    # 学习天数：注册至今的天数（统一为 UTC 做比较，避免 naive/aware 混用报错）
    now = datetime.now(timezone.utc)
    created = current.created_at
    if created is not None and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    total_study_days = (
        max(0, (now - created).days) if created is not None else 0
    )

    # 答题总数 / 答对数
    total_questions_answered = await _count(
        db,
        select(func.count())
        .select_from(UserQuestionAttempt)
        .where(UserQuestionAttempt.user_id == user_id),
    )
    total_correct = await _count(
        db,
        select(func.count())
        .select_from(UserQuestionAttempt)
        .where(
            UserQuestionAttempt.user_id == user_id,
            UserQuestionAttempt.correct == True,  # noqa: E712
        ),
    )
    accuracy = (
        round(total_correct / total_questions_answered, 4)
        if total_questions_answered > 0
        else 0.0
    )

    # 学习时长：游戏会话 duration 累计（秒 → 分钟）
    study_seconds_result = await db.execute(
        select(func.coalesce(func.sum(GameSession.duration), 0)).where(
            GameSession.user_id == user_id
        )
    )
    study_seconds = study_seconds_result.scalar() or 0
    total_study_minutes = int(study_seconds / 60) if study_seconds else 0

    # 连续打卡天数：取自用户游戏档案
    streak_result = await db.execute(
        select(UserGameProfile.streak_days).where(UserGameProfile.user_id == user_id)
    )
    current_streak = streak_result.scalar() or 0

    # 已掌握词汇数
    vocab_mastered = await _count(
        db,
        select(func.count())
        .select_from(UserWordProgress)
        .where(
            UserWordProgress.user_id == user_id,
            UserWordProgress.status == "mastered",
        ),
    )

    return StudentProfileResponse(
        total_study_days=total_study_days,
        total_questions_answered=total_questions_answered,
        total_correct=total_correct,
        accuracy=accuracy,
        total_study_minutes=total_study_minutes,
        current_streak=current_streak,
        vocab_mastered=vocab_mastered,
        last_login_at=current.last_login_at,
    )
