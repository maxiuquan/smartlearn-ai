"""统计 API 路由.

提供管理后台仪表盘所需的概览与用户分析数据。
所有端点要求管理员权限。
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Date, Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_current_user, get_db
from app.models.business import (
    AIConversation,
    GameSession,
    KnowledgePoint,
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
    total_knowledge_points = await _count(
        db, select(func.count()).select_from(KnowledgePoint)
    )
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
        total_knowledge_points=total_knowledge_points,
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

    # 每日新增用户数
    # 注意: 不能用 func.date_trunc('day', col), 因为 asyncpg prepared statement 会把
    # 字符串参数化为 $1, SELECT/GROUP BY/ORDER BY 用不同占位符 ($1/$3/$4),
    # PostgreSQL planner 无法证明表达式相同 → GroupingError.
    # 改用 CAST(col AS DATE), 不带参数, SELECT/GROUP BY 生成完全相同的 SQL 字符串.
    new_date_expr = cast(User.created_at, Date)
    new_users_stmt = (
        select(
            new_date_expr.label("date"),
            func.count().label("count"),
        )
        .where(User.created_at >= thirty_days_ago)
        .group_by(new_date_expr)
        .order_by(new_date_expr)
    )
    new_users_rows = (await db.execute(new_users_stmt)).all()
    new_users_daily = [
        {"date": row.date.strftime("%Y-%m-%d") if row.date else "", "count": int(row.count)}
        for row in new_users_rows
    ]

    # 每日活跃用户数（按 last_login_at 日期分组）
    active_date_expr = cast(User.last_login_at, Date)
    active_users_stmt = (
        select(
            active_date_expr.label("date"),
            func.count().label("count"),
        )
        .where(User.last_login_at.is_not(None))
        .where(User.last_login_at >= thirty_days_ago)
        .group_by(active_date_expr)
        .order_by(active_date_expr)
    )
    active_users_rows = (await db.execute(active_users_stmt)).all()
    active_users_daily = [
        {"date": row.date.strftime("%Y-%m-%d") if row.date else "", "count": int(row.count)}
        for row in active_users_rows
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

    - total_study_days: 实际学习天数（去重：有作答/游戏会话的天数）
    - total_questions_answered: 当前用户答题总数
    - total_correct: 当前用户答对数
    - accuracy: 正确率（0~1）
    - total_study_minutes: 游戏会话累计时长（分钟）
    - current_streak: 连续打卡天数（取自 user_game_profile）
    - vocab_mastered: 当前用户已掌握词汇数
    - last_login_at: 最近登录时间

    P1-4.10: total_study_days 修正为真实学习天数，而非"注册至今天数"
    """
    user_id = current.id

    # P1-4.10: 实际学习天数 = 用户至少有 1 次作答 或 1 次游戏会话的不同日期数
    # 优先作答日期（粒度最细，最贴近"真实学习"），并 union 游戏会话日期
    attempt_dates_stmt = select(
        func.distinct(cast(UserQuestionAttempt.created_at, Date))
    ).where(UserQuestionAttempt.user_id == user_id)
    game_dates_stmt = select(
        func.distinct(cast(GameSession.started_at, Date))
    ).where(GameSession.user_id == user_id)

    attempt_dates = {
        row[0] for row in (await db.execute(attempt_dates_stmt)).all() if row[0]
    }
    game_dates = {
        row[0] for row in (await db.execute(game_dates_stmt)).all() if row[0]
    }
    study_dates = attempt_dates | game_dates
    total_study_days = len(study_dates)

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


# ─── 管理后台统计图表端点 ────────────────────────────────────


@router.get("/user-activity", summary="用户活跃趋势（管理端）")
async def get_user_activity_trend(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """返回近 N 天每日活跃/新增用户数。

    - dates: 日期字符串列表 (YYYY-MM-DD)
    - activeUsers: 每日活跃用户数（按 last_login_at 日期分组）
    - newUsers: 每日新增用户数
    - logins: 每日登录次数（P1-4.10: 由于当前未建立登录事件表，
      仍以 last_login_at 去重的活跃用户数近似，并标注 estimated=true）

    P1-4.10: 统计口径修正 — 明确 estimated 标志，避免与真实登录次数混淆
    """
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).replace(tzinfo=None)

    date_expr = cast(User.created_at, Date)
    new_stmt = (
        select(date_expr.label("date"), func.count().label("count"))
        .where(User.created_at >= cutoff)
        .group_by(date_expr)
        .order_by(date_expr)
    )
    new_rows = (await db.execute(new_stmt)).all()
    new_map = {row.date: int(row.count) for row in new_rows if row.date}

    active_date_expr = cast(User.last_login_at, Date)
    active_stmt = (
        select(active_date_expr.label("date"), func.count().label("count"))
        .where(User.last_login_at.is_not(None))
        .where(User.last_login_at >= cutoff)
        .group_by(active_date_expr)
        .order_by(active_date_expr)
    )
    active_rows = (await db.execute(active_stmt)).all()
    active_map = {row.date: int(row.count) for row in active_rows if row.date}

    dates: list[str] = []
    active_users: list[int] = []
    new_users: list[int] = []
    logins: list[int] = []
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).date()
        ds = d.strftime("%Y-%m-%d")
        dates.append(ds)
        au = active_map.get(d, 0)
        nu = new_map.get(d, 0)
        active_users.append(au)
        new_users.append(nu)
        # P1-4.10: logins 字段语义修正为"登录次数估算值"，避免与真实登录次数混淆
        # 当前以"该日有登录行为的用户数"近似；建立 login_events 表后可改为真实登录次数
        logins.append(au)

    return {
        "dates": dates,
        "activeUsers": active_users,
        "newUsers": new_users,
        "logins": logins,
        # P1-4.10: 显式标注估算口径，UI 应显示"估算"
        "estimated": {"logins": True},
        "metric_definitions": {
            "logins": "以该日有 last_login_at 记录的用户数近似，未捕获重复登录",
        },
    }


@router.get("/question-completion", summary="题目完成趋势（管理端）")
async def get_question_completion_trend(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """返回近 N 天每日答题数与正确数。

    - dates: 日期列表
    - completed: 每日完成题目数
    - correct: 每日答对题目数
    """
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).replace(tzinfo=None)

    date_expr = cast(UserQuestionAttempt.created_at, Date)
    total_stmt = (
        select(date_expr.label("date"), func.count().label("count"))
        .where(UserQuestionAttempt.created_at >= cutoff)
        .group_by(date_expr)
        .order_by(date_expr)
    )
    total_rows = (await db.execute(total_stmt)).all()
    total_map = {row.date: int(row.count) for row in total_rows if row.date}

    correct_stmt = (
        select(date_expr.label("date"), func.count().label("count"))
        .where(UserQuestionAttempt.created_at >= cutoff)
        .where(UserQuestionAttempt.correct == True)  # noqa: E712
        .group_by(date_expr)
        .order_by(date_expr)
    )
    correct_rows = (await db.execute(correct_stmt)).all()
    correct_map = {row.date: int(row.count) for row in correct_rows if row.date}

    dates: list[str] = []
    completed: list[int] = []
    correct: list[int] = []
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).date()
        dates.append(d.strftime("%Y-%m-%d"))
        completed.append(total_map.get(d, 0))
        correct.append(correct_map.get(d, 0))

    return {"dates": dates, "completed": completed, "correct": correct}


@router.get("/subject-distribution", summary="学科分布（管理端）")
async def get_subject_distribution(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> list:
    """返回题目按学科分布统计。"""
    stmt = (
        select(Question.subject, func.count().label("count"))
        .group_by(Question.subject)
        .order_by(func.count().desc())
    )
    rows = (await db.execute(stmt)).all()
    total = sum(int(r[1]) for r in rows) or 1
    return [
        {
            "subject": str(row[0]),
            "count": int(row[1]),
            "percentage": round(int(row[1]) / total * 100, 2),
        }
        for row in rows
    ]


@router.get("/knowledge-mastery", summary="知识点掌握分布（管理端）")
async def get_knowledge_mastery(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> list:
    """返回用户词汇掌握分布（按 mastery_level 分桶）。

    桶定义：未学习(new)、入门(0<mastery<=0.3)、进阶(0.3-0.6)、掌握(0.6-0.9)、精通(>=0.9)
    """
    # 统计各掌握等级的词汇数
    beginner = await _count(
        db,
        select(func.count())
        .select_from(UserWordProgress)
        .where(UserWordProgress.mastery_level > 0)
        .where(UserWordProgress.mastery_level <= 0.3),
    )
    intermediate = await _count(
        db,
        select(func.count())
        .select_from(UserWordProgress)
        .where(UserWordProgress.mastery_level > 0.3)
        .where(UserWordProgress.mastery_level <= 0.6),
    )
    mastered = await _count(
        db,
        select(func.count())
        .select_from(UserWordProgress)
        .where(UserWordProgress.mastery_level > 0.6)
        .where(UserWordProgress.mastery_level <= 0.9),
    )
    expert = await _count(
        db,
        select(func.count())
        .select_from(UserWordProgress)
        .where(UserWordProgress.mastery_level > 0.9),
    )
    total_vocab_progress = await _count(
        db, select(func.count()).select_from(UserWordProgress)
    )
    new_count = total_vocab_progress - (beginner + intermediate + mastered + expert)
    new_count = max(0, new_count)

    return [
        {"level": "未学习", "count": new_count},
        {"level": "入门", "count": beginner},
        {"level": "进阶", "count": intermediate},
        {"level": "掌握", "count": mastered},
        {"level": "精通", "count": expert},
    ]


@router.get("/user-ranking", summary="用户学习排行（管理端）")
async def get_user_ranking(
    type: str = Query("study_time", description="排行类型: study_time | questions | accuracy"),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> list:
    """返回用户学习排行。

    - study_time: 按游戏会话累计时长排序（秒）
    - questions: 按答题总数排序
    - accuracy: 按正确率排序
    """
    if type == "study_time":
        stmt = (
            select(
                GameSession.user_id,
                func.sum(GameSession.duration).label("value"),
            )
            .group_by(GameSession.user_id)
            .order_by(func.sum(GameSession.duration).desc())
            .limit(limit)
        )
        rows = (await db.execute(stmt)).all()
    elif type == "questions":
        stmt = (
            select(
                UserQuestionAttempt.user_id,
                func.count().label("value"),
            )
            .group_by(UserQuestionAttempt.user_id)
            .order_by(func.count().desc())
            .limit(limit)
        )
        rows = (await db.execute(stmt)).all()
    elif type == "accuracy":
        stmt = (
            select(
                UserQuestionAttempt.user_id,
                func.avg(UserQuestionAttempt.correct.cast(Integer)).label("value"),
            )
            .group_by(UserQuestionAttempt.user_id)
            .order_by(func.avg(UserQuestionAttempt.correct.cast(Integer)).desc())
            .limit(limit)
        )
        rows = (await db.execute(stmt)).all()
    else:
        return []

    if not rows:
        return []

    user_ids = [int(r[0]) for r in rows]
    user_stmt = select(User.id, User.nickname).where(User.id.in_(user_ids))
    user_rows = (await db.execute(user_stmt)).all()
    user_map = {row[0]: row[1] or f"用户{row[0]}" for row in user_rows}

    result = []
    for r in rows:
        uid = int(r[0])
        result.append(
            {
                "user": {
                    "id": str(uid),
                    "nickname": user_map.get(uid, f"用户{uid}"),
                    "avatar": "",
                },
                "value": float(r[1] or 0),
            }
        )
    return result
