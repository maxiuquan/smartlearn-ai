"""词汇相关 API 路由"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.schemas.vocab import (
    WordEventRequest,
    WordListResponse,
    WordProgressResponse,
    WordProgressSummaryResponse,
    WordResponse,
)

router = APIRouter()


@router.get(
    "/words",
    response_model=WordListResponse,
    summary="获取词汇列表",
)
async def list_words(
    tag: Optional[str] = Query(None, description="标签筛选"),
    frequency: Optional[int] = Query(None, description="最低词频"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> WordListResponse:
    """分页获取词汇列表，支持按标签和词频筛选。"""
    from sqlalchemy import Table, Column, Integer, String, Text, DateTime, MetaData, func
    from sqlalchemy.dialects.postgresql import JSONB

    metadata = MetaData()
    vw = Table(
        "vocabulary_words",
        metadata,
        Column("word_id", String(100), primary_key=True),
        Column("headword", String(200)),
        Column("meaning", Text),
        Column("phonetic", String(200)),
        Column("tags", JSONB),
        Column("frequency", Integer),
        Column("synonyms", JSONB),
        Column("antonyms", JSONB),
        Column("examples", JSONB),
        Column("created_at", DateTime),
    )

    conditions = []
    if frequency is not None:
        conditions.append(vw.c.frequency >= frequency)

    count_result = await db.execute(
        select(func.count()).select_from(vw).where(*conditions)
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(vw)
        .where(*conditions)
        .order_by(vw.c.frequency.desc(), vw.c.headword)
        .offset(offset)
        .limit(page_size)
    )
    rows = result.fetchall()

    items = [
        WordResponse(
            word_id=row.word_id,
            headword=row.headword,
            meaning=row.meaning,
            phonetic=row.phonetic,
            tags=row.tags,
            frequency=row.frequency,
            synonyms=row.synonyms,
            antonyms=row.antonyms,
            examples=row.examples,
        )
        for row in rows
    ]

    return WordListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/progress",
    response_model=WordProgressSummaryResponse,
    summary="获取用户词汇进度汇总",
)
async def get_progress(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WordProgressSummaryResponse:
    """获取当前用户的词汇学习进度统计。

    - 包含掌握数、学习中、新词、今日待复习等
    """
    from sqlalchemy import Table, Column, Integer, String, Float, DateTime, MetaData, func, text, case

    metadata = MetaData()
    uwp = Table(
        "user_word_progress",
        metadata,
        Column("user_id", Integer),
        Column("word_id", String(100)),
        Column("status", String(20)),
        Column("mastery_level", Float),
        Column("next_review_at", DateTime),
        Column("review_count", Integer),
        Column("correct_count", Integer),
        Column("wrong_count", Integer),
    )

    # 统计各状态数量
    result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(
                case((uwp.c.status == "mastered", 1), else_=0)
            ).label("mastered"),
            func.sum(
                case((uwp.c.status == "learning", 1), else_=0)
            ).label("learning"),
            func.sum(
                case((uwp.c.status == "new", 1), else_=0)
            ).label("new_words"),
            func.avg(uwp.c.mastery_level).label("avg_mastery"),
        ).where(uwp.c.user_id == user_id)
    )
    stats = result.first()

    # 今日待复习
    now = datetime.now(timezone.utc)
    due_result = await db.execute(
        select(func.count())
        .select_from(uwp)
        .where(
            uwp.c.user_id == user_id,
            uwp.c.next_review_at <= now,
        )
    )
    due_today = due_result.scalar() or 0

    return WordProgressSummaryResponse(
        total_words=stats.total or 0,
        mastered=stats.mastered or 0,
        learning=stats.learning or 0,
        new_words=stats.new_words or 0,
        due_today=due_today,
        average_mastery=round(stats.avg_mastery or 0, 2),
    )


@router.get(
    "/due",
    response_model=list[WordProgressResponse],
    summary="获取今日待复习词汇",
)
async def get_due_words(
    limit: int = Query(20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[WordProgressResponse]:
    """获取当前用户今日需要复习的词汇列表。"""
    from sqlalchemy import Table, Column, Integer, String, Text, Float, DateTime, MetaData, func, text

    metadata = MetaData()
    uwp = Table(
        "user_word_progress",
        metadata,
        Column("user_id", Integer),
        Column("word_id", String(100)),
        Column("status", String(20)),
        Column("mastery_level", Float),
        Column("next_review_at", DateTime),
        Column("review_count", Integer),
        Column("correct_count", Integer),
        Column("wrong_count", Integer),
    )
    vw = Table(
        "vocabulary_words",
        metadata,
        Column("word_id", String(100), primary_key=True),
        Column("headword", String(200)),
        Column("meaning", Text),
    )

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(
            uwp.c.word_id,
            uwp.c.status,
            uwp.c.mastery_level,
            uwp.c.next_review_at,
            uwp.c.review_count,
            uwp.c.correct_count,
            uwp.c.wrong_count,
            vw.c.headword,
            vw.c.meaning,
        )
        .select_from(uwp.join(vw, uwp.c.word_id == vw.c.word_id))
        .where(
            uwp.c.user_id == user_id,
            uwp.c.next_review_at <= now,
        )
        .order_by(uwp.c.next_review_at.asc())
        .limit(limit)
    )
    rows = result.fetchall()

    return [
        WordProgressResponse(
            word_id=row.word_id,
            headword=row.headword,
            meaning=row.meaning,
            status=row.status,
            mastery_level=row.mastery_level,
            next_review_at=row.next_review_at,
            review_count=row.review_count,
            correct_count=row.correct_count,
            wrong_count=row.wrong_count,
        )
        for row in rows
    ]


@router.post(
    "/events",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="提交单词学习事件",
)
async def submit_word_event(
    body: WordEventRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """提交单词学习事件，用于更新 SRS 间隔重复算法的状态。

    - 支持的事件类型: learned, reviewed, correct, wrong, mastered, forgotten
    - 所有单词游戏通过此接口提交学习结果
    """
    from sqlalchemy import Table, Column, Integer, String, Float, DateTime, MetaData, func, text

    metadata = MetaData()
    uwp = Table(
        "user_word_progress",
        metadata,
        Column("user_id", Integer),
        Column("word_id", String(100)),
        Column("status", String(20)),
        Column("mastery_level", Float),
        Column("ease_factor", Float),
        Column("interval_days", Integer),
        Column("next_review_at", DateTime),
        Column("review_count", Integer),
        Column("correct_count", Integer),
        Column("wrong_count", Integer),
        Column("updated_at", DateTime),
    )

    event_type = body.event_type
    now = datetime.now(timezone.utc)

    # 查询当前进度
    result = await db.execute(
        select(uwp).where(
            uwp.c.user_id == user_id,
            uwp.c.word_id == body.word_id,
        )
    )
    existing = result.first()

    if existing:
        # 更新现有记录
        new_status = existing.status
        new_mastery = existing.mastery_level
        new_ease = existing.ease_factor
        new_interval = existing.interval_days
        correct_inc = 0
        wrong_inc = 0

        if event_type == "correct":
            correct_inc = 1
            new_mastery = min(1.0, new_mastery + 0.1)
            new_interval = max(1, int(new_interval * new_ease))
            new_ease = min(3.0, new_ease + 0.1)
            if new_mastery >= 0.9:
                new_status = "mastered"
            elif new_status == "new":
                new_status = "learning"
        elif event_type == "wrong":
            wrong_inc = 1
            new_mastery = max(0.0, new_mastery - 0.15)
            new_interval = max(1, int(new_interval * 0.5))
            new_ease = max(1.3, new_ease - 0.2)
            new_status = "learning"
        elif event_type == "mastered":
            new_status = "mastered"
            new_mastery = 1.0
        elif event_type == "forgotten":
            new_status = "learning"
            new_mastery = max(0.0, new_mastery - 0.3)
            new_interval = 1
            new_ease = max(1.3, new_ease - 0.3)
        elif event_type == "learned":
            new_status = "learning"
            new_mastery = max(new_mastery, 0.3)

        next_review = now + timedelta(days=max(1, new_interval))

        await db.execute(
            text(
                """
                UPDATE user_word_progress SET
                    status = :status,
                    mastery_level = :mastery,
                    ease_factor = :ease,
                    interval_days = :interval,
                    next_review_at = :next_review,
                    review_count = review_count + 1,
                    correct_count = correct_count + :correct_inc,
                    wrong_count = wrong_count + :wrong_inc,
                    updated_at = NOW()
                WHERE user_id = :user_id AND word_id = :word_id
                """
            ),
            {
                "status": new_status,
                "mastery": new_mastery,
                "ease": new_ease,
                "interval": new_interval,
                "next_review": next_review,
                "correct_inc": correct_inc,
                "wrong_inc": wrong_inc,
                "user_id": user_id,
                "word_id": body.word_id,
            },
        )
    else:
        # 创建新记录
        initial_status = "learning" if event_type in ("learned", "correct") else "new"
        initial_mastery = 0.3 if event_type in ("learned", "correct") else 0.0
        initial_interval = 1
        next_review = now + timedelta(days=1)

        await db.execute(
            uwp.insert().values(
                user_id=user_id,
                word_id=body.word_id,
                status=initial_status,
                mastery_level=initial_mastery,
                ease_factor=2.5,
                interval_days=initial_interval,
                next_review_at=next_review,
                review_count=1,
                correct_count=1 if event_type == "correct" else 0,
                wrong_count=1 if event_type == "wrong" else 0,
            )
        )

    await db.commit()