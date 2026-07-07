"""题目相关 API 路由"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db, get_optional_user_id
from app.models.business import (
    Question,
    UserQuestionAttempt,
    WrongQuestion,
)
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
    conditions = []
    if subject:
        conditions.append(Question.subject == subject)
    if difficulty:
        conditions.append(Question.difficulty == difficulty)
    if type:
        conditions.append(Question.type == type)

    # 计数
    count_result = await db.execute(
        select(func.count()).select_from(Question).where(*conditions)
    )
    total = count_result.scalar() or 0

    # 分页查询
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Question)
        .where(*conditions)
        .order_by(Question.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = result.scalars().all()

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

    推荐策略（按优先级）：
    1. 用户错题本中的题目 — 高优先级复习
    2. 用户低掌握度知识点关联的题目
    3. 排除最近 N 天内已答对的题目
    4. 若无足够个性化数据，回退到按难度匹配 + 随机
    """
    now = datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(days=7)  # 排除最近 7 天答对的题目

    recommendation_reason = "基于你的学习进度，为你推荐以下题目"
    collected_ids: set[int] = set()
    questions: list[QuestionResponse] = []

    # ── Step 1: 错题本关联题目优先推荐 ──
    wrong_q_result = await db.execute(
        select(WrongQuestion.question_id)
        .where(WrongQuestion.user_id == user_id)
        .order_by(WrongQuestion.last_wrong_at.desc())
        .limit(count * 2)
    )
    wrong_question_ids = [row[0] for row in wrong_q_result.fetchall()]

    if wrong_question_ids:
        wrong_conditions = [Question.id.in_(wrong_question_ids)]
        if subject:
            wrong_conditions.append(Question.subject == subject)

        # 排除最近答对的题目
        recently_correct_result = await db.execute(
            select(UserQuestionAttempt.question_id).where(
                UserQuestionAttempt.user_id == user_id,
                UserQuestionAttempt.correct == True,  # noqa: E712
                UserQuestionAttempt.created_at >= recent_cutoff,
            )
        )
        recently_correct_ids = {row[0] for row in recently_correct_result.fetchall()}

        wrong_conditions.append(Question.id.notin_(recently_correct_ids)) if recently_correct_ids else None

        wrong_result = await db.execute(
            select(Question)
            .where(*wrong_conditions)
            .limit(count)
        )
        wrong_rows = wrong_result.scalars().all()

        for row in wrong_rows:
            if row.id not in collected_ids:
                collected_ids.add(row.id)
                questions.append(
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
                )

        if questions:
            recommendation_reason = "根据你的错题本，优先推荐以下需要复习的题目"

    # ── Step 2: 不足时补充低掌握度知识点关联题目 ──
    if len(questions) < count:
        # 查询用户低掌握度词汇关联的题目（通过 knowledge_points JSON 字段）
        # 这里用难度匹配作为补充策略
        remaining = count - len(questions)
        base_conditions = []
        if subject:
            base_conditions.append(Question.subject == subject)
        if collected_ids:
            base_conditions.append(Question.id.notin_(collected_ids))

        # 排除最近答对的题目
        if not wrong_question_ids:
            recently_correct_result = await db.execute(
                select(UserQuestionAttempt.question_id).where(
                    UserQuestionAttempt.user_id == user_id,
                    UserQuestionAttempt.correct == True,  # noqa: E712
                    UserQuestionAttempt.created_at >= recent_cutoff,
                )
            )
            recently_correct_ids = {row[0] for row in recently_correct_result.fetchall()}
        if recently_correct_ids:
            base_conditions.append(Question.id.notin_(recently_correct_ids))

        # 按难度升序 + 随机排序，优先推荐中等难度题目
        fill_result = await db.execute(
            select(Question)
            .where(*base_conditions)
            .order_by(Question.difficulty.asc(), func.random())
            .limit(remaining)
        )
        fill_rows = fill_result.scalars().all()

        for row in fill_rows:
            questions.append(
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
            )

        if len(questions) > 0 and "错题本" in recommendation_reason:
            recommendation_reason = "根据你的错题本和学习进度，为你推荐以下题目"

    # ── Step 3: 仍无数据时回退到按难度匹配 + 随机 ──
    if not questions:
        fallback_conditions = []
        if subject:
            fallback_conditions.append(Question.subject == subject)

        fallback_result = await db.execute(
            select(Question)
            .where(*fallback_conditions)
            .order_by(Question.difficulty.asc(), func.random())
            .limit(count)
        )
        fallback_rows = fallback_result.scalars().all()

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
            for row in fallback_rows
        ]
        recommendation_reason = "暂无足够学习数据，为你推荐以下基础题目"

    return RecommendResponse(
        questions=questions,
        recommendation_reason=recommendation_reason,
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
    result = await db.execute(select(Question).where(Question.id == question_id))
    row = result.scalars().first()

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
    # 获取题目
    result = await db.execute(select(Question).where(Question.id == question_id))
    row = result.scalars().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"题目 {question_id} 不存在",
        )

    correct = body.user_answer.strip().lower() == row.answer.strip().lower()

    # 记录作答
    db.add(
        UserQuestionAttempt(
            user_id=user_id,
            question_id=question_id,
            user_answer=body.user_answer,
            correct=correct,
            duration_ms=body.duration_ms,
        )
    )

    # 答错加入错题本
    if not correct:
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
