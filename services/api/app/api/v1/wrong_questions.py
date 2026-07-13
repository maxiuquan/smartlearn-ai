"""错题相关 API 路由"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.models.business import Question, WrongQuestion
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
    conditions = [WrongQuestion.user_id == user_id]
    # P1-03: 软毕业的错题不再展示在错题列表（graduated_at 为空的才显示）
    conditions.append(WrongQuestion.graduated_at.is_(None))
    if subject:
        conditions.append(Question.subject == subject)

    offset = (page - 1) * page_size
    # 注意: ORM 模型类没有 .join() 方法, 必须用 select(...).join() 链式调用
    result = await db.execute(
        select(
            WrongQuestion.question_id,
            WrongQuestion.wrong_count,
            WrongQuestion.last_wrong_at,
            WrongQuestion.next_review_at,
            Question.id,
            Question.subject,
            Question.type,
            Question.difficulty,
            Question.title,
            Question.content,
            Question.options,
            Question.answer,
            Question.solution,
            Question.created_at,
        )
        .select_from(WrongQuestion)
        .join(
            Question,
            WrongQuestion.question_id == Question.id,
        )
        .where(*conditions)
        .order_by(WrongQuestion.last_wrong_at.desc())
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
    # 检查错题是否存在
    result = await db.execute(
        select(WrongQuestion).where(
            WrongQuestion.user_id == user_id,
            WrongQuestion.question_id == question_id,
        )
    )
    existing = result.scalars().first()

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"错题记录不存在: question_id={question_id}",
        )

    # 更新复习状态（独立 review_count，修复原用 wrong_count 做索引的缺陷）
    # 间隔序列：第1次复习3天, 第2次7天, 第3次14天, 第4次30天, 第5次60天
    # P1-03: 统一错题状态机：active → scheduled → mastery_candidate → graduated
    # 答对一次只推进阶段，不直接删除；第 5 阶段后毕业（保留行 + graduated_at 标记）
    intervals = [3, 7, 14, 30, 60]
    max_stage = len(intervals)  # 5
    new_stage = existing.review_stage + 1

    if new_stage > max_stage:
        # 已达最高阶段，软毕业：保留行 + graduated_at 时间戳
        # 这样既能统计"已毕业题数"，也保留历史错题记录供回放审计
        existing.review_count = existing.review_count + 1
        existing.review_stage = max_stage
        existing.graduated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        existing.next_review_at = None
        await db.commit()
        return

    interval_days = intervals[min(new_stage - 1, max_stage - 1)]

    existing.review_count = existing.review_count + 1
    existing.review_stage = new_stage
    # P1-03: last_wrong_at 更新为最近复习时间，next_review_at 按 SRS 间隔计算
    existing.last_wrong_at = datetime.now(timezone.utc).replace(tzinfo=None)
    next_review = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=interval_days)
    existing.next_review_at = next_review

    await db.commit()
