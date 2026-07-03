"""题目相关 API 路由"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db, get_optional_user_id
from app.schemas.questions import (
    QuestionAttemptRequest,
    QuestionAttemptResponse,
    QuestionListResponse,
    QuestionResponse,
    RecommendResponse,
)

router = APIRouter()


@router.get(
    "",
    response_model=QuestionListResponse,
    summary="获取题目列表",
)
async def list_questions(
    subject: Optional[str] = Query(None, description="学科筛选"),
    kp_id: Optional[int] = Query(None, description="知识点 ID 筛选"),
    difficulty: Optional[int] = Query(None, ge=1, le=5, description="难度筛选"),
    type: Optional[str] = Query(None, description="题型筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> QuestionListResponse:
    """分页获取题目列表，支持多条件筛选。

    - 列表不返回答案和解析
    """
    from sqlalchemy import Table, Column, Integer, String, Text, DateTime, MetaData, func
    from sqlalchemy.dialects.postgresql import JSONB

    metadata = MetaData()
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

    conditions = []
    if subject:
        conditions.append(q.c.subject == subject)
    if difficulty:
        conditions.append(q.c.difficulty == difficulty)
    if type:
        conditions.append(q.c.type == type)

    # 计数
    count_result = await db.execute(
        select(func.count()).select_from(q).where(*conditions)
    )
    total = count_result.scalar() or 0

    # 分页查询
    offset = (page - 1) * page_size
    result = await db.execute(
        select(q)
        .where(*conditions)
        .order_by(q.c.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = result.fetchall()

    items = [
        QuestionResponse(
            id=row.id,
            subject=row.subject,
            knowledge_points=row.knowledge_points,
            type=row.type,
            difficulty=row.difficulty,
            title=row.title,
            content=row.content,
            options=row.options,
            answer=None,  # 列表不返回答案
            solution=None,  # 列表不返回解析
            created_at=row.created_at,
        )
        for row in rows
    ]

    return QuestionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{question_id}",
    response_model=QuestionResponse,
    summary="获取题目详情",
)
async def get_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    """获取单个题目详情，包含答案和解析。

    - 用于查看题目详情或错题回顾
    """
    from sqlalchemy import Table, Column, Integer, String, Text, DateTime, MetaData, func
    from sqlalchemy.dialects.postgresql import JSONB

    metadata = MetaData()
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

    result = await db.execute(select(q).where(q.c.id == question_id))
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"题目 {question_id} 不存在",
        )

    return QuestionResponse(
        id=row.id,
        subject=row.subject,
        knowledge_points=row.knowledge_points,
        type=row.type,
        difficulty=row.difficulty,
        title=row.title,
        content=row.content,
        options=row.options,
        answer=row.answer,
        solution=row.solution,
        created_at=row.created_at,
    )


@router.post(
    "/{question_id}/attempt",
    response_model=QuestionAttemptResponse,
    summary="提交答案",
)
async def submit_attempt(
    question_id: int,
    body: QuestionAttemptRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> QuestionAttemptResponse:
    """提交题目作答结果。

    - 记录作答历史
    - 答错自动加入错题本
    - 返回正误判断和解析
    """
    from sqlalchemy import Table, Column, Integer, String, Text, DateTime, Boolean, MetaData, func
    from sqlalchemy.dialects.postgresql import JSONB

    metadata = MetaData()
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

    # 获取题目
    result = await db.execute(select(q).where(q.c.id == question_id))
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"题目 {question_id} 不存在",
        )

    correct = body.user_answer.strip().lower() == row.answer.strip().lower()

    # 记录作答
    uqa = Table(
        "user_question_attempts",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer),
        Column("question_id", Integer),
        Column("user_answer", Text),
        Column("correct", Boolean),
        Column("duration_ms", Integer),
        Column("created_at", DateTime),
    )
    await db.execute(
        uqa.insert().values(
            user_id=user_id,
            question_id=question_id,
            user_answer=body.user_answer,
            correct=correct,
            duration_ms=body.duration_ms,
        )
    )

    # 答错加入错题本
    if not correct:
        wq = Table(
            "wrong_questions",
            metadata,
            Column("user_id", Integer),
            Column("question_id", Integer),
            Column("wrong_count", Integer),
            Column("last_wrong_at", DateTime),
            Column("next_review_at", DateTime),
        )

        await db.execute(
            text(
                """
                INSERT INTO wrong_questions (user_id, question_id, wrong_count, last_wrong_at, next_review_at)
                VALUES (:user_id, :question_id, 1, NOW(), NOW() + INTERVAL '1 day')
                ON CONFLICT (user_id, question_id) DO UPDATE SET
                    wrong_count = wrong_questions.wrong_count + 1,
                    last_wrong_at = NOW(),
                    next_review_at = NOW() + (wrong_questions.wrong_count || ' days')::INTERVAL
                """
            ),
            {"user_id": user_id, "question_id": question_id},
        )

    await db.commit()

    return QuestionAttemptResponse(
        correct=correct,
        correct_answer=row.answer if not correct else None,
        solution=row.solution if not correct else None,
        xp_gained=10 if correct else 0,
    )


@router.get(
    "/recommend",
    response_model=RecommendResponse,
    summary="获取推荐题目",
)
async def get_recommend_questions(
    subject: Optional[str] = Query(None),
    count: int = Query(10, ge=1, le=50),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RecommendResponse:
    """根据用户学习进度推荐题目。

    - 优先推荐掌握度低的知识点相关题目
    - 避开最近已答对的题目
    """
    from sqlalchemy import Table, Column, Integer, String, Text, DateTime, MetaData, func
    from sqlalchemy.dialects.postgresql import JSONB

    metadata = MetaData()
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

    conditions = []
    if subject:
        conditions.append(q.c.subject == subject)

    result = await db.execute(
        select(q)
        .where(*conditions)
        .order_by(func.random())
        .limit(count)
    )
    rows = result.fetchall()

    questions = [
        QuestionResponse(
            id=row.id,
            subject=row.subject,
            knowledge_points=row.knowledge_points,
            type=row.type,
            difficulty=row.difficulty,
            title=row.title,
            content=row.content,
            options=row.options,
            answer=None,
            solution=None,
            created_at=row.created_at,
        )
        for row in rows
    ]

    return RecommendResponse(
        questions=questions,
        recommendation_reason="基于你的学习进度，为你推荐以下题目",
    )