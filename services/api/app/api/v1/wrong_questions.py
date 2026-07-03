"""错题相关 API 路由"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.schemas.questions import QuestionResponse

router = APIRouter()


@router.get(
    "",
    response_model=list[dict],
    summary="获取错题列表",
)
async def list_wrong_questions(
    subject: Optional[str] = Query(None, description="学科筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """获取当前用户的错题列表。

    - 按最近错误时间排序
    - 支持按学科筛选
    """
    from sqlalchemy import Table, Column, Integer, String, Text, DateTime, MetaData, func
    from sqlalchemy.dialects.postgresql import JSONB

    metadata = MetaData()
    wq = Table(
        "wrong_questions",
        metadata,
        Column("user_id", Integer),
        Column("question_id", Integer),
        Column("wrong_count", Integer),
        Column("last_wrong_at", DateTime),
        Column("next_review_at", DateTime),
    )
    q = Table(
        "questions",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("subject", String(50)),
        Column("knowledge_points", JSONB),
        Column("type", String(50)),
        Column("difficulty", Integer),
        Column("title", String(500)),
        Column("content", Text),
        Column("options", JSONB),
        Column("answer", Text),
        Column("solution", Text),
        Column("created_at", DateTime),
    )

    conditions = [wq.c.user_id == user_id]
    if subject:
        conditions.append(q.c.subject == subject)

    offset = (page - 1) * page_size
    result = await db.execute(
        select(
            wq.c.question_id,
            wq.c.wrong_count,
            wq.c.last_wrong_at,
            wq.c.next_review_at,
            q.c.id,
            q.c.subject,
            q.c.type,
            q.c.difficulty,
            q.c.title,
            q.c.content,
            q.c.options,
            q.c.answer,
            q.c.solution,
            q.c.created_at,
        )
        .select_from(wq.join(q, wq.c.question_id == q.c.id))
        .where(*conditions)
        .order_by(wq.c.last_wrong_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = result.fetchall()

    return [
        {
            "question_id": row.question_id,
            "wrong_count": row.wrong_count,
            "last_wrong_at": row.last_wrong_at.isoformat() if row.last_wrong_at else None,
            "next_review_at": row.next_review_at.isoformat() if row.next_review_at else None,
            "question": {
                "id": row.id,
                "subject": row.subject,
                "type": row.type,
                "difficulty": row.difficulty,
                "title": row.title,
                "content": row.content,
                "options": row.options,
                "answer": row.answer,
                "solution": row.solution,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            },
        }
        for row in rows
    ]


@router.post(
    "/{question_id}/review",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="标记错题已复习",
)
async def mark_wrong_question_reviewed(
    question_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """将错题标记为已复习，更新下次复习时间。

    - 采用间隔重复算法延长复习间隔
    - 复习间隔随复习次数递增
    """
    from sqlalchemy import Table, Column, Integer, DateTime, MetaData, func

    metadata = MetaData()
    wq = Table(
        "wrong_questions",
        metadata,
        Column("user_id", Integer),
        Column("question_id", Integer),
        Column("wrong_count", Integer),
        Column("last_wrong_at", DateTime),
        Column("next_review_at", DateTime),
    )

    # 检查错题是否存在
    result = await db.execute(
        select(wq).where(
            wq.c.user_id == user_id,
            wq.c.question_id == question_id,
        )
    )
    existing = result.first()

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"错题记录不存在: question_id={question_id}",
        )

    # 更新下次复习时间（间隔递增）
    # 第1次复习: 3天后, 第2次: 7天后, 第3次: 14天后, 以此类推
    intervals = [3, 7, 14, 30, 60]
    review_count = existing.wrong_count
    interval_days = intervals[min(review_count - 1, len(intervals) - 1)]

    await db.execute(
        text(
            """
            UPDATE wrong_questions SET
                next_review_at = NOW() + (:interval || ' days')::INTERVAL
            WHERE user_id = :user_id AND question_id = :question_id
            """
        ),
        {
            "interval": str(interval_days),
            "user_id": user_id,
            "question_id": question_id,
        },
    )

    await db.commit()