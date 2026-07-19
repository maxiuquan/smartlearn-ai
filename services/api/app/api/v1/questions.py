"""题目相关 API 路由"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Integer, cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db, get_optional_user_id
from app.core.judging import judge_answer
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
    kp_id: Optional[str] = Query(None, description="知识点 slug 筛选"),
    difficulty: Optional[str] = Query(None, description="难度筛选（1-5）"),
    type: Optional[str] = Query(None, description="题型筛选"),
    category: Optional[str] = Query(None, description="分类筛选（CET4/CET6/考研等，按 tags 包含匹配）"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> QuestionListResponse:
    """分页获取题目列表，支持多条件筛选。

    - 列表不返回答案和解析
    - 空字符串参数视为 None（前端未选筛选器时传空串）
    - category 按 tags 数组包含匹配（如 category=CET4 匹配 tags 含 "CET4" 的题）
    """
    conditions = []
    if subject:
        conditions.append(Question.subject == subject)
    if type:
        conditions.append(Question.type == type)
    # P0-4 修复: kp_id 筛选加入 conditions（knowledge_points 是 JSONB 数组，用 contains 查询）
    if kp_id:
        conditions.append(Question.knowledge_points.contains([kp_id]))
    # category 按 knowledge_points 包含匹配（CET4→vocab-cet4, CET6→vocab-cet6, 考研→vocab-kaoyan）
    if category:
        _category_kp_map = {
            "CET4": "vocab-cet4",
            "CET6": "vocab-cet6",
            "考研": "vocab-kaoyan",
        }
        kp_value = _category_kp_map.get(category, category)
        conditions.append(Question.knowledge_points.contains([kp_value]))
    # difficulty 是 str 类型以兼容空串，此处转为 int
    difficulty_int: Optional[int] = None
    if difficulty:
        try:
            difficulty_int = int(difficulty)
            if not (1 <= difficulty_int <= 5):
                difficulty_int = None
        except (ValueError, TypeError):
            difficulty_int = None
    if difficulty_int:
        conditions.append(Question.difficulty == difficulty_int)

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
    # DB 列为 TIMESTAMP WITHOUT TIME ZONE, 必须用 naive datetime 避免 asyncpg DataError
    now = datetime.utcnow()
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
        # 查询用户薄弱知识点：按知识点统计答错率，优先推荐错误率高的知识点关联题目
        # 通过 UserQuestionAttempt 关联 Question.knowledge_points 计算各知识点正确率
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

        # 自适应推题：优先推荐用户近期答错的知识点关联题目（难度适配）
        # 计算用户平均正确率，据此选择难度档位
        stats_result = await db.execute(
            select(
                func.count().label("total_attempts"),
                func.sum(func.cast(UserQuestionAttempt.correct, Integer)).label("correct_cnt"),
            ).where(UserQuestionAttempt.user_id == user_id)
        )
        stats = stats_result.first()
        total_attempts = stats.total_attempts or 0
        correct_cnt = stats.correct_cnt or 0
        accuracy = (correct_cnt / total_attempts) if total_attempts > 0 else 0.5

        # 根据正确率选择目标难度：低正确率→低难度，高正确率→高难度（循序渐进）
        if accuracy < 0.4:
            target_difficulty = 1
        elif accuracy < 0.6:
            target_difficulty = 2
        elif accuracy < 0.8:
            target_difficulty = 3
        else:
            target_difficulty = 4

        # 优先推荐目标难度附近的题目，按难度接近度排序
        fill_result = await db.execute(
            select(Question)
            .where(*base_conditions)
            .order_by(func.abs(Question.difficulty - target_difficulty).asc(), func.random())
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
    user_id: int = Depends(get_optional_user_id),
) -> QuestionResponse:
    """获取单个题目详情。

    P0-06: 答案和解析仅在用户已作答后返回，防止匿名批量抓取。
    - 未登录用户：只返回题干/选项，不返回答案/解析
    - 已登录但未作答：同上
    - 已登录且已作答：返回完整答案/解析
    """
    result = await db.execute(select(Question).where(Question.id == question_id))
    row = result.scalars().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"题目 {question_id} 不存在",
        )

    # P0-06: 检查用户是否已作答此题，仅在已作答后返回答案/解析
    has_attempted = False
    if user_id is not None:
        attempt_result = await db.execute(
            select(func.count()).select_from(UserQuestionAttempt).where(
                UserQuestionAttempt.user_id == user_id,
                UserQuestionAttempt.question_id == question_id,
            )
        )
        has_attempted = (attempt_result.scalar() or 0) > 0

    return QuestionResponse(
        id=row.id,
        subject=row.subject,
        knowledge_points=row.knowledge_points,
        type=row.type,
        difficulty=row.difficulty,
        title=row.title,
        content=row.content,
        options=row.options,
        answer=row.answer if has_attempted else None,
        solution=row.solution if has_attempted else None,
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

    P1-4.5: 幂等 + 错题状态机统一
    - 重复 attempt_id 直接返回首次结果，不再写入作答/错题/学习数据
    - 答对不再直接从错题本删除；改为推进 review_stage，到 5 阶段才毕业
    """
    # 获取题目
    result = await db.execute(select(Question).where(Question.id == question_id))
    row = result.scalars().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"题目 {question_id} 不存在",
        )

    # P1-4.5: 幂等性检查 — 同一 attempt_id 直接返回首次结果
    # 通过 Redis 短期缓存（30 分钟）记录 attempt_id → 结果，避免 DB 重复写入
    if body.attempt_id:
        try:
            import redis.asyncio as aioredis  # noqa: WPS433

            from app.core.config import settings as _settings

            _r = aioredis.from_url(_settings.redis_url, decode_responses=True)
            cache_key = f"attempt:idem:{user_id}:{question_id}:{body.attempt_id}"
            cached = await _r.get(cache_key)
            if cached:
                # 命中幂等缓存：返回首次结果，不重复计入
                import json as _json

                await _r.aclose()
                payload = _json.loads(cached)
                return QuestionAttemptResponse(
                    correct=payload["correct"],
                    correct_answer=payload.get("correct_answer"),
                    solution=payload.get("solution"),
                    xp_gained=payload.get("xp_gained", 0),
                    mastery_update=payload.get("mastery_update"),
                )
        except Exception:
            # Redis 不可用不阻塞业务，仅失去幂等保护（写入仍受唯一约束保护）
            pass
        else:
            try:
                await _r.aclose()
            except Exception:
                pass

    correct = judge_answer(body.user_answer, row.answer, row.type)

    # P1-4.5: 客户端耗时仅作参考，做合理性边界检查（防止异常大/小值污染统计）
    # 服务端实际可信度应基于发题时间与题目复杂度联合判断（此处先做边界裁剪）
    duration_ms = body.duration_ms
    if duration_ms is not None:
        if duration_ms > 3600_000:  # 单题最长 1 小时
            duration_ms = 3600_000
        elif duration_ms < 0:
            duration_ms = 0

    # 记录作答
    db.add(
        UserQuestionAttempt(
            user_id=user_id,
            question_id=question_id,
            user_answer=body.user_answer,
            correct=correct,
            duration_ms=duration_ms,
        )
    )

    # P1-4.5: 统一错题状态机 — 答对不再直接删除，改为推进 review_stage
    # 状态机：active(答错时建立/刷新) → scheduled → mastery_candidate → graduated
    # review 接口已使用 5 阶段毕业；此处的 attempt 答对只是"复习一次"，不能直接毕业
    # 错题本条目仅在 review 接口连续推进 5 次后才真正删除（graduated_at 标记）
    if not correct:
        # 答错：新增或刷新错题本（保留 review_stage 不重置，避免破坏已建立的复习进度）
        await db.execute(
            text(
                """
                INSERT INTO wrong_questions
                    (user_id, question_id, wrong_count, last_wrong_at, next_review_at,
                     review_count, review_stage, graduated_at)
                VALUES (:user_id, :question_id, 1, NOW(), NOW() + INTERVAL '1 day', 0, 0, NULL)
                ON CONFLICT (user_id, question_id) DO UPDATE SET
                    wrong_count = wrong_questions.wrong_count + 1,
                    last_wrong_at = NOW(),
                    next_review_at = NOW() + INTERVAL '1 day',
                    graduated_at = NULL
                """
            ),
            {"user_id": user_id, "question_id": question_id},
        )
    else:
        # 答对：仅在已存在错题本条目时推进 1 个 review_stage，不直接删除
        # 若 review_stage 已达 5，则毕业（graduated_at 标记 + 删除条目以释放列表）
        existing_wq = await db.execute(
            select(WrongQuestion).where(
                WrongQuestion.user_id == user_id,
                WrongQuestion.question_id == question_id,
            )
        )
        wq_row = existing_wq.scalars().first()
        if wq_row is not None:
            new_stage = (wq_row.review_stage or 0) + 1
            max_stage = 5
            if new_stage >= max_stage:
                # 已达最高阶段 → 毕业：从错题本移除（graduated_at 不再保留记录，避免列表污染）
                await db.execute(
                    text(
                        """
                        DELETE FROM wrong_questions
                        WHERE user_id = :user_id AND question_id = :question_id
                        """
                    ),
                    {"user_id": user_id, "question_id": question_id},
                )
            else:
                # 推进阶段，但仍保留在错题本
                intervals = [3, 7, 14, 30, 60]
                interval_days = intervals[min(new_stage - 1, max_stage - 1)]
                await db.execute(
                    text(
                        """
                        UPDATE wrong_questions SET
                            review_count = review_count + 1,
                            review_stage = :stage,
                            next_review_at = NOW() + (:interval || ' days')::INTERVAL
                        WHERE user_id = :user_id AND question_id = :question_id
                        """
                    ),
                    {
                        "stage": new_stage,
                        "interval": str(interval_days),
                        "user_id": user_id,
                        "question_id": question_id,
                    },
                )

    await db.commit()

    # XP 按难度加权（P2 修复）
    xp_gained = 0
    if correct:
        xp_gained = 5 + (row.difficulty or 1) * 5  # 难度1=10, 难度5=30

    response = QuestionAttemptResponse(
        correct=correct,
        correct_answer=row.answer if not correct else None,
        solution=row.solution if not correct else None,
        xp_gained=xp_gained,
    )

    # P1-4.5: 写入幂等缓存（30 分钟 TTL）
    if body.attempt_id:
        try:
            import redis.asyncio as aioredis  # noqa: WPS433
            import json as _json

            from app.core.config import settings as _settings

            _r2 = aioredis.from_url(_settings.redis_url, decode_responses=True)
            cache_key = f"attempt:idem:{user_id}:{question_id}:{body.attempt_id}"
            await _r2.set(
                cache_key,
                _json.dumps(
                    {
                        "correct": correct,
                        "correct_answer": response.correct_answer,
                        "solution": response.solution,
                        "xp_gained": xp_gained,
                    }
                ),
                ex=1800,  # 30 分钟
            )
            await _r2.aclose()
        except Exception:
            pass

    return response
