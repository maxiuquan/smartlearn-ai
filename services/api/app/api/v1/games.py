"""游戏相关 API 路由"""
import json
import logging
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
import hashlib
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.models.business import (
    GameAnswerEvent,
    GameQuestion,
    GameRewardsLedger,
    GameSession,
    UserGameProfile,
)
from app.models.user import User
from app.schemas.games import (
    GameAnswerSubmitRequest,
    GameAnswerSubmitResponse,
    GameConfigResponse,
    GameDetailResponse,
    GameLeaderboardConfig,
    GameListResponse,
    GameRewards,
    GameSessionConfig,
    GameSessionFinishRequest,
    GameSessionFinishResponse,
    GameSessionRequest,
    GameSessionResponse,
    GameSessionStartRequest,
    GameSessionStartResponse,
    LeaderboardEntry,
    LeaderboardResponse,
)

router = APIRouter()

# JSON 配置文件路径：项目根目录 / data / games / games-config.json
# 开发环境 parents[5]=项目根; Docker 环境 parents[3]=/app
_parents = Path(__file__).resolve().parents
_GAMES_CONFIG_PATH = (
    (_parents[5] if len(_parents) > 5 else _parents[3])
    / "data" / "games" / "games-config.json"
)

# P0-08: 已提交的 session nonce 集合（Redis 故障降级用）
_USED_NONCES: set[str] = set()

# P0-02 (R3): 单 worker 兜底的答题幂等键集合（Redis 故障时使用）
_USED_ANSWER_KEYS: set[str] = set()

# P0-02 (R3): 默认题目数量与反作弊阈值
_DEFAULT_QUESTION_COUNT = 10
_ANSWER_MIN_INTERVAL_MS = 500
_SUSPICIOUS_ACCURACY = 0.95
_SUSPICIOUS_MIN_DURATION_SEC = 3

logger = logging.getLogger(__name__)


def _load_games_config() -> list[dict]:
    """从 JSON 文件加载全部游戏配置。

    Returns:
        游戏配置字典列表，若文件不存在或解析失败则返回空列表。
    """
    try:
        with open(_GAMES_CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("games", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _build_game_config(game: dict, *, include_internal: bool = False) -> GameConfigResponse:
    """将 JSON 字典转换为 GameConfigResponse 模型。

    P1-06: 默认只返回公开字段；include_internal=True 时返回 GameConfigAdminResponse（含内部字段）。

    Args:
        game: 从 JSON 配置中解析出的单个游戏字典。
        include_internal: 是否包含 tech_notes/business_value/config 等内部字段（仅管理员）。

    Returns:
        GameConfigResponse 或 GameConfigAdminResponse 实例。
    """
    session_raw = game.get("session") or {}
    rewards_raw = game.get("rewards") or {}
    leaderboard_raw = game.get("leaderboard") or {}

    # P1-06: 公开端点的基础字段
    common_kwargs = dict(
        game_id=game["game_id"],
        name=game["name"],
        name_en=game.get("name_en"),
        description=game.get("description", ""),
        category=game.get("category"),
        type=game.get("type"),
        icon=game.get("icon"),
        min_level=game.get("min_level", 1),
        subject=game.get("subject", "english"),
        subjects=game.get("subjects"),
        learning_goal=game.get("learning_goal"),
        core_mechanisms=game.get("core_mechanisms"),
        difficulty_levels=game.get("difficulty_levels"),
        session=GameSessionConfig(
            time_limit_sec=session_raw.get("time_limit_sec", 0),
            lives=session_raw.get("lives", 0),
            combo_enabled=session_raw.get("combo_enabled", False),
        ),
        rewards=GameRewards(
            base_xp=rewards_raw.get("base_xp", 0),
            base_coin=rewards_raw.get("base_coin", 0),
            combo_multiplier=rewards_raw.get("combo_multiplier", 1.0),
        ),
        props=game.get("props"),
        leaderboard=GameLeaderboardConfig(
            enabled=leaderboard_raw.get("enabled", False),
            scopes=leaderboard_raw.get("scopes", []),
        ),
    )

    if include_internal:
        # P1-06: 管理端响应包含内部字段
        from app.schemas.games import GameConfigAdminResponse
        return GameConfigAdminResponse(
            **common_kwargs,
            data_sources=game.get("data_sources"),
            stage=game.get("stage"),
            tech_notes=game.get("tech_notes"),
            business_value=game.get("business_value"),
            config=game.get("config"),
        )

    return GameConfigResponse(**common_kwargs)


@router.get(
    "",
    response_model=GameListResponse,
    summary="获取所有游戏配置",
)
async def list_games(
    db: AsyncSession = Depends(get_db),
) -> GameListResponse:
    """获取所有可用游戏的配置列表。

    - 从 games-config.json 加载全部游戏配置
    - 包含游戏名称、描述、分类、学习目标、核心机制等信息
    """
    games_raw = _load_games_config()
    games = [_build_game_config(g) for g in games_raw]
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
    """获取指定游戏的详细配置和用户最佳成绩。

    - 从 games-config.json 加载游戏详情
    """
    games_raw = _load_games_config()
    game_data = next((g for g in games_raw if g["game_id"] == game_id), None)

    if not game_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"游戏 '{game_id}' 不存在",
        )

    base = _build_game_config(game_data)

    # 查询用户该游戏的最佳成绩
    best_score_result = await db.execute(
        select(func.max(GameSession.score)).where(
            GameSession.user_id == user_id,
            GameSession.game_id == game_id,
        )
    )
    user_best_score = best_score_result.scalar()

    return GameDetailResponse(
        game_id=base.game_id,
        name=base.name,
        name_en=base.name_en,
        description=base.description,
        category=base.category,
        type=base.type,
        icon=base.icon,
        min_level=base.min_level,
        subject=base.subject,
        subjects=base.subjects,
        learning_goal=base.learning_goal,
        core_mechanisms=base.core_mechanisms,
        # P1-06: data_sources/stage/tech_notes/business_value/config 不再对客户端暴露
        difficulty_levels=base.difficulty_levels,
        session=base.session,
        rewards=base.rewards,
        props=base.props,
        leaderboard=base.leaderboard,
        user_best_score=user_best_score,
    )


# ── P0-02 (R3): 服务端逐题作答会话架构 ──


def _load_data_file(rel_path: str) -> Optional[dict]:
    """从项目根目录 / data / <rel_path> 加载 JSON 文件。

    失败时返回 None（调用方负责降级处理）。
    """
    try:
        full_path = (
            (_parents[5] if len(_parents) > 5 else _parents[3])
            / "data"
            / rel_path
        )
        with open(full_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None


def _normalize_answer(value: str) -> str:
    """标准化答案文本以进行对比（去除前后空白与换行、统一小写）。"""
    return (value or "").strip().lower()


def _build_questions_for_game(
    game_cfg: dict, difficulty: Optional[str]
) -> list[dict[str, Any]]:
    """根据游戏配置生成题目集（含 correct_answer）。

    优先级：
    1. 词汇类游戏：从 data_sources 中找到的 vocabulary/*.json 抽取单词
    2. 数学/题库类游戏：从 questions/*.json 抽取题目
    3. 兜底：使用游戏 props 字段合成简易题目

    返回题目列表，每项包含 question_id / 题面字段 / correct_answer。
    """
    data_sources = game_cfg.get("data_sources") or []
    game_id = game_cfg.get("game_id", "unknown")
    target_count = _DEFAULT_QUESTION_COUNT
    questions: list[dict[str, Any]] = []

    # 1) 词汇类数据源
    vocab_source = next(
        (s for s in data_sources if s.startswith("vocabulary/")), None
    )
    if vocab_source:
        data = _load_data_file(vocab_source)
        if data and isinstance(data, dict):
            words = data.get("words") or []
            if words:
                random.shuffle(words)
                for w in words[:target_count]:
                    word_text = w.get("word") or ""
                    meaning = w.get("meaning") or ""
                    if not word_text or not meaning:
                        continue
                    questions.append(
                        {
                            "question_id": f"{game_id}:vocab:{w.get('id', word_text)}",
                            "prompt": word_text,
                            "meaning": meaning,
                            "phonetic": w.get("phonetic"),
                            "example": w.get("example"),
                            "type": "vocabulary_meaning",
                            "correct_answer": meaning,
                        }
                    )
        if questions:
            return questions

    # 2) 题库类数据源（questions/*.json）
    question_source = next(
        (s for s in data_sources if s.startswith("questions/")), None
    )
    if question_source:
        data = _load_data_file(question_source)
        if data and isinstance(data, dict):
            q_list = data.get("questions") or []
            if q_list:
                random.shuffle(q_list)
                for q in q_list[:target_count]:
                    answer = q.get("answer") or ""
                    if not answer:
                        continue
                    questions.append(
                        {
                            "question_id": f"{game_id}:q:{q.get('id', '')}",
                            "prompt": q.get("content") or "",
                            "title": q.get("title"),
                            "chapter": q.get("chapter"),
                            "section": q.get("section"),
                            "hints": q.get("hints"),
                            "type": q.get("type", "calculation"),
                            "correct_answer": answer,
                        }
                    )
        if questions:
            return questions

    # 3) 同义词数据源（vocabulary/synonyms.json）
    syn_source = next(
        (s for s in data_sources if "synonyms" in s), None
    )
    if syn_source:
        data = _load_data_file(syn_source)
        if data and isinstance(data, dict):
            entries = data.get("synonyms") or data.get("words") or []
            if entries and isinstance(entries, list):
                random.shuffle(entries)
                for entry in entries[:target_count]:
                    word = entry.get("word") or ""
                    syns = entry.get("synonyms") or []
                    if not word or not syns:
                        continue
                    correct = syns[0] if isinstance(syns, list) else str(syns)
                    questions.append(
                        {
                            "question_id": f"{game_id}:syn:{word}",
                            "prompt": word,
                            "type": "synonym",
                            "correct_answer": correct,
                        }
                    )
        if questions:
            return questions

    # 4) 兜底：使用游戏 props 合成简易题目
    props = game_cfg.get("props") or []
    fallback_items = props or ["hint", "skip", "freeze_time", "bomb"]
    for i, prop in enumerate(fallback_items[:target_count]):
        questions.append(
            {
                "question_id": f"{game_id}:fallback:{i}",
                "prompt": f"游戏 {game_cfg.get('name', game_id)} 的第 {i + 1} 题",
                "type": "fallback",
                "correct_answer": str(prop),
            }
        )
    return questions


async def _acquire_answer_idempotency(
    user_id: int, session_id: int, idempotency_key: str
) -> bool:
    """通过 Redis SETNX 抢占答题幂等键；Redis 故障时回退到内存集合。

    返回 True 表示首次获取（可继续处理），False 表示重复提交。
    """
    redis_key = f"game:answer:{user_id}:{session_id}:{idempotency_key}"
    redis_client = None
    try:
        from app.core.security import get_redis_client
        redis_client = await get_redis_client()
        if redis_client:
            set_result = await redis_client.set(redis_key, "1", ex=86400, nx=True)
            return bool(set_result)
    except Exception as e:
        logger.warning("answer idempotency redis failed, fallback to memory: %s", e)
    finally:
        if redis_client:
            try:
                await redis_client.aclose()
            except Exception:
                pass

    # Redis 故障兜底
    memory_key = f"{user_id}:{session_id}:{idempotency_key}"
    if memory_key in _USED_ANSWER_KEYS:
        return False
    _USED_ANSWER_KEYS.add(memory_key)
    if len(_USED_ANSWER_KEYS) > 50000:
        _USED_ANSWER_KEYS.clear()
        _USED_ANSWER_KEYS.add(memory_key)
    return True


@router.post(
    "/{game_id}/sessions/start",
    response_model=GameSessionStartResponse,
    summary="开始游戏会话（服务端生成题目集）",
)
async def start_game_session(
    game_id: str,
    body: GameSessionStartRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GameSessionStartResponse:
    """P0-02 (R3): 服务端生成 session_id、题目集、nonce、expires_at。

    - 校验 URL game_id 与 body.game_id 一致
    - 加载游戏配置；按 data_sources 生成题目集
    - 服务端生成 server_nonce（uuid4）与 expires_at（now + time_limit * 2）
    - GameQuestion 表存储 correct_answer（客户端不可见）
    - 返回题目集时剥离 correct_answer 字段
    """
    if body.game_id != game_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"game_id 不一致: URL={game_id}, body={body.game_id}",
        )

    games_raw = _load_games_config()
    game_cfg = next((g for g in games_raw if g["game_id"] == game_id), None)
    if not game_cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"游戏 '{game_id}' 不存在",
        )

    session_cfg = game_cfg.get("session") or {}
    time_limit_sec = int(session_cfg.get("time_limit_sec", 0) or 0)

    # 生成题目集（含 correct_answer）
    raw_questions = _build_questions_for_game(game_cfg, body.difficulty)
    if not raw_questions:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="题目集生成失败，请稍后重试",
        )

    server_nonce = str(uuid.uuid4())
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # expires_at = now + max(time_limit * 2, 600s)（无时限时默认 10 分钟）
    expires_delta = max(time_limit_sec * 2, 600)
    expires_at = now + timedelta(seconds=expires_delta)

    # 写入 GameSession（status=active, server_nonce, expires_at）
    new_session = GameSession(
        user_id=user_id,
        game_id=game_id,
        score=0,
        xp_gained=0,
        coins_gained=0,
        accuracy=None,
        duration=None,
        started_at=now,
        finished_at=now,  # 占位：未 finish 时与 started_at 一致
        server_nonce=server_nonce,
        expires_at=expires_at,
        status="active",
    )
    db.add(new_session)
    await db.flush()  # 获取自增 ID
    session_id = new_session.id

    # 写入 GameQuestion 表
    for seq, q in enumerate(raw_questions):
        db.add(
            GameQuestion(
                session_id=session_id,
                question_id=q["question_id"],
                sequence=seq,
                correct_answer=q["correct_answer"],
                user_answer=None,
                is_correct=None,
                answered_at=None,
            )
        )

    await db.commit()

    # 构造返回给客户端的题目集（剥离 correct_answer）
    client_questions: list[dict[str, Any]] = []
    for seq, q in enumerate(raw_questions):
        client_q = {k: v for k, v in q.items() if k != "correct_answer"}
        client_q["sequence"] = seq
        client_questions.append(client_q)

    return GameSessionStartResponse(
        session_id=session_id,
        server_nonce=server_nonce,
        questions=client_questions,
        expires_at=expires_at,
        time_limit_sec=time_limit_sec,
    )


@router.post(
    "/{game_id}/sessions/{session_id}/answers",
    response_model=GameAnswerSubmitResponse,
    summary="提交单题答案",
)
async def submit_answer(
    game_id: str,
    session_id: int,
    body: GameAnswerSubmitRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GameAnswerSubmitResponse:
    """P0-02 (R3): 服务端逐题判定 + 不可变事件流。

    - 校验 session 归属用户、game_id 匹配、未过期、status=active
    - Redis SETNX 抢占 idempotency_key（重复提交返回 409）
    - 服务端判定正误（标准化文本对比）
    - 写入 GameAnswerEvent（不可变）
    - 更新 GameQuestion.user_answer + is_correct + answered_at
    - 返回判定结果（不返回 correct_answer，避免反推）
    """
    # 加载 session
    session_result = await db.execute(
        select(GameSession).where(
            GameSession.id == session_id,
            GameSession.user_id == user_id,
        )
    )
    session = session_result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="游戏会话不存在或不属于当前用户",
        )
    if session.game_id != game_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"game_id 不一致: URL={game_id}, session={session.game_id}",
        )
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"会话状态为 {session.status}，无法继续答题",
        )
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if session.expires_at is not None and session.expires_at < now:
        # 自动转 expired 状态
        session.status = "expired"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="会话已过期",
        )

    # 查找对应的 GameQuestion（按 session_id + sequence）
    gq_result = await db.execute(
        select(GameQuestion).where(
            GameQuestion.session_id == session_id,
            GameQuestion.sequence == body.sequence,
        )
    )
    game_question = gq_result.scalar_one_or_none()
    if game_question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"题目序号 {body.sequence} 不存在于当前会话",
        )
    if game_question.question_id != body.question_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"question_id 不匹配: body={body.question_id}, expected={game_question.question_id}",
        )

    # 幂等性检查：Redis SETNX
    acquired = await _acquire_answer_idempotency(
        user_id, session_id, body.idempotency_key
    )
    if not acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="重复提交被拒绝（idempotency_key 已使用）",
        )

    # 服务端判定正误（标准化文本对比）
    is_correct = _normalize_answer(body.answer) == _normalize_answer(
        game_question.correct_answer
    )

    # 写入 GameAnswerEvent（不可变事件流）
    db.add(
        GameAnswerEvent(
            session_id=session_id,
            user_id=user_id,
            question_id=body.question_id,
            sequence=body.sequence,
            user_answer=body.answer,
            is_correct=is_correct,
            idempotency_key=body.idempotency_key,
        )
    )

    # 更新 GameQuestion
    game_question.user_answer = body.answer
    game_question.is_correct = is_correct
    game_question.answered_at = now

    await db.commit()

    # 统计已答数与总题数
    total_result = await db.execute(
        select(func.count()).select_from(GameQuestion).where(
            GameQuestion.session_id == session_id
        )
    )
    total_questions = int(total_result.scalar() or 0)
    answered_result = await db.execute(
        select(func.count()).select_from(GameQuestion).where(
            GameQuestion.session_id == session_id,
            GameQuestion.answered_at.is_not(None),
        )
    )
    answered_count = int(answered_result.scalar() or 0)

    return GameAnswerSubmitResponse(
        is_correct=is_correct,
        correct_answer=None,  # 仅在 finish 阶段返回
        answered_count=answered_count,
        total_questions=total_questions,
    )


@router.post(
    "/{game_id}/sessions/{session_id}/finish",
    response_model=GameSessionFinishResponse,
    summary="结束游戏会话（服务端一次性结算）",
)
async def finish_game_session(
    game_id: str,
    session_id: int,
    body: GameSessionFinishRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GameSessionFinishResponse:
    """P0-02 (R3): 服务端一次性结算 + 反作弊 + 不可变账本。

    - 校验 session
    - 服务端基于 GameAnswerEvent 计算 score / accuracy / xp / coins
    - 反作弊：min 500ms 答题间隔、accuracy > 0.95 且总时长 < 3s 视为异常
    - 写入 GameRewardsLedger（不可变，uq_game_rewards_session 兜底）
    - 更新 GameSession.status = finished + 各字段
    - 更新 UserGameProfile（XP / coins 累加）
    - 返回最终结算结果
    """
    session_result = await db.execute(
        select(GameSession).where(
            GameSession.id == session_id,
            GameSession.user_id == user_id,
        )
    )
    session = session_result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="游戏会话不存在或不属于当前用户",
        )
    if session.game_id != game_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"game_id 不一致: URL={game_id}, session={session.game_id}",
        )
    if session.status == "finished":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="会话已结算，请勿重复结算",
        )
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if session.status == "expired" or (
        session.expires_at is not None and session.expires_at < now
    ):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="会话已过期，无法结算",
        )

    # 加载游戏配置（用于奖励规则）
    games_raw = _load_games_config()
    game_cfg = next((g for g in games_raw if g["game_id"] == game_id), None)
    if not game_cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"游戏 '{game_id}' 不存在",
        )
    rewards_cfg = game_cfg.get("rewards") or {}
    base_xp = int(rewards_cfg.get("base_xp", 10) or 10)
    base_coin = int(rewards_cfg.get("base_coin", 5) or 5)
    combo_multiplier = float(rewards_cfg.get("combo_multiplier", 1.0) or 1.0)

    # 查询所有题目与答题事件
    questions_result = await db.execute(
        select(GameQuestion).where(GameQuestion.session_id == session_id)
    )
    questions = questions_result.scalars().all()
    total_questions = len(questions)
    if total_questions == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="当前会话无题目，无法结算",
        )

    events_result = await db.execute(
        select(GameAnswerEvent)
        .where(GameAnswerEvent.session_id == session_id)
        .order_by(GameAnswerEvent.created_at.asc())
    )
    events = events_result.scalars().all()
    correct_count = sum(1 for e in events if e.is_correct)
    answered_count = len(events)
    accuracy = (correct_count / total_questions) if total_questions > 0 else 0.0

    # ── 反作弊检查 ──
    # 1. 答题间隔过短（< 500ms）视为异常
    suspicious_interval = False
    if len(events) >= 2:
        for i in range(1, len(events)):
            prev_ts = events[i - 1].created_at
            curr_ts = events[i].created_at
            if prev_ts and curr_ts:
                delta_ms = (curr_ts - prev_ts).total_seconds() * 1000.0
                if delta_ms < _ANSWER_MIN_INTERVAL_MS:
                    suspicious_interval = True
                    break

    # 2. 总时长过短且正确率过高
    total_duration_sec = 0.0
    if events:
        first_ts = events[0].created_at
        last_ts = events[-1].created_at
        if first_ts and last_ts:
            total_duration_sec = (last_ts - first_ts).total_seconds()
    suspicious_accuracy = (
        accuracy > _SUSPICIOUS_ACCURACY
        and total_duration_sec < _SUSPICIOUS_MIN_DURATION_SEC
    )

    if suspicious_interval or suspicious_accuracy:
        logger.warning(
            "game_session_anticheat user_id=%s session_id=%s "
            "suspicious_interval=%s suspicious_accuracy=%s accuracy=%.2f duration=%.2fs",
            user_id, session_id, suspicious_interval, suspicious_accuracy,
            accuracy, total_duration_sec,
        )
        # 反作弊触发：清零奖励，但仍记录账本
        final_score = 0
        xp_gained = 0
        coins_gained = 0
    else:
        # 正常结算：score = base_xp * accuracy * 100 * combo_multiplier
        raw_score = int(base_xp * accuracy * 100 * combo_multiplier)
        score_cap = max(base_xp * 100, 5000)
        final_score = min(raw_score, score_cap)
        xp_gained = max(1, final_score // 10)
        coins_gained = max(1, final_score // 20)

    # 写入 GameRewardsLedger（不可变，uq_game_rewards_session 兜底）
    db.add(
        GameRewardsLedger(
            session_id=session_id,
            user_id=user_id,
            game_id=game_id,
            xp_gained=xp_gained,
            coins_gained=coins_gained,
            score=final_score,
            accuracy=accuracy,
        )
    )

    # 更新 GameSession
    session.status = "finished"
    session.score = final_score
    session.xp_gained = xp_gained
    session.coins_gained = coins_gained
    session.accuracy = accuracy
    session.duration = int(total_duration_sec) if total_duration_sec > 0 else None
    session.finished_at = now

    # 更新 UserGameProfile
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

    return GameSessionFinishResponse(
        session_id=session_id,
        score=final_score,
        xp_gained=xp_gained,
        coins_gained=coins_gained,
        accuracy=accuracy,
        correct_count=correct_count,
        total_questions=total_questions,
    )


@router.post(
    "/{game_id}/sessions",
    response_model=GameSessionResponse,
    summary="提交游戏会话（已弃用，请使用 /start + /answers + /finish）",
    deprecated=True,
)
async def submit_game_session(
    game_id: str,
    body: GameSessionRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GameSessionResponse:
    """提交完成的游戏会话（已弃用，不发奖励）。

    **Deprecated (P0-01 R4)**：此端点已弃用，不再发放任何 XP/金币奖励。
    客户端必须使用三段式逐题作答流程才能获得奖励：
    1. POST /{game_id}/sessions/start — 服务端生成题目集
    2. POST /{game_id}/sessions/{session_id}/answers — 逐题提交
    3. POST /{game_id}/sessions/{session_id}/finish — 服务端结算

    P0-01 (R4) 安全整改：
    - 旧接口仅记录会话历史（score=0, xp=0, coins=0），不发放任何奖励
    - 客户端 accuracy 不再驱动任何奖励计算
    - 防止用户通过伪造 accuracy 刷 XP/金币/排行榜
    """
    # P0-08: 校验 URL game_id 与 body.game_id 一致
    if body.game_id != game_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"game_id 不一致: URL={game_id}, body={body.game_id}",
        )

    # 服务端校验：加载游戏配置，验证游戏存在
    games_raw = _load_games_config()
    game_cfg = next((g for g in games_raw if g["game_id"] == body.game_id), None)
    if not game_cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"游戏 '{body.game_id}' 不存在",
        )

    # P0-01 (R4): nonce 去重仍保留，防止重复提交
    nonce_key = f"game:nonce:{user_id}:{body.game_id}:{body.nonce}"
    redis_client = None
    try:
        from app.core.security import get_redis_client
        redis_client = await get_redis_client()
        if redis_client:
            set_result = await redis_client.set(nonce_key, "1", ex=86400, nx=True)
            if not set_result:
                await redis_client.aclose()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="重复提交被拒绝（nonce 已使用）",
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("nonce redis failed, fallback to memory: %s", e)
        if body.nonce in _USED_NONCES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="重复提交被拒绝（nonce 已使用）",
            )
        _USED_NONCES.add(body.nonce)
        if len(_USED_NONCES) > 10000:
            _USED_NONCES.clear()
    finally:
        if redis_client:
            try:
                await redis_client.aclose()
            except Exception:
                pass

    # P0-01 (R4): 旧接口不发放任何奖励 — score/xp/coins 全部为 0
    final_score = 0
    xp_gained = 0
    coins_gained = 0

    # DB 列为 TIMESTAMP WITHOUT TIME ZONE, 必须剥离 tzinfo 避免 asyncpg DataError
    started = body.started_at.replace(tzinfo=None) if body.started_at else datetime.utcnow()
    finished = body.finished_at or datetime.now(timezone.utc)
    finished = finished.replace(tzinfo=None) if finished.tzinfo else finished

    # 仅记录会话历史（不发奖励）
    new_session = GameSession(
        user_id=user_id,
        game_id=body.game_id,
        score=final_score,
        xp_gained=xp_gained,
        coins_gained=coins_gained,
        accuracy=body.accuracy,
        duration=body.duration,
        started_at=started,
        finished_at=finished,
    )
    db.add(new_session)
    await db.commit()

    # P0-01 (R4): 不更新 user_game_profile — 旧接口不发放任何 XP/金币

    return GameSessionResponse(
        session_id=new_session.id,
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

    P1-03: 排行榜隐私改造
    - 移除裸 user_id，改用 display_hash（SHA256 截断，不可逆）
    - friends scope 未实现好友关系，返回 501 Not Implemented（不再伪装为 global）
    - 当前用户匹配通过服务端计算 is_current_user 标志
    """
    if scope not in ("friends", "global", "daily", "weekly"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的排行榜范围: {scope}，可选值: global, daily, weekly, friends",
        )

    # P1-03: friends 未实现好友关系表，直接返回 501，不再伪装为 global
    if scope == "friends":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="好友排行榜暂未实现（需要好友关系表支持）",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    entries: list[LeaderboardEntry] = []

    def _make_display_hash(uid: int) -> str:
        """P1-03: 生成不可逆用户展示 ID（SHA256 截断前 12 位）."""
        return hashlib.sha256(f"sl_user_{uid}".encode()).hexdigest()[:12]

    if scope == "global":
        # 全局：用户游戏档案总 XP
        result = await db.execute(
            select(UserGameProfile, User.nickname, User.avatar)
            .join(User, UserGameProfile.user_id == User.id)
            .order_by(UserGameProfile.total_xp.desc())
            .limit(50)
        )
        rows = result.all()
        for i, (profile, nickname, avatar) in enumerate(rows):
            entries.append(
                LeaderboardEntry(
                    rank=i + 1,
                    display_hash=_make_display_hash(profile.user_id),
                    score=profile.total_xp,
                    level=profile.level,
                    nickname=nickname or f"用户{profile.user_id}",
                    avatar=avatar,
                    is_current_user=(profile.user_id == user_id),
                )
            )
    elif scope in ("daily", "weekly"):
        # 按时间窗口查询游戏会话 XP
        if scope == "daily":
            # 当天 00:00 UTC
            cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            # 最近 7 天
            cutoff = now - timedelta(days=7)

        result = await db.execute(
            select(
                GameSession.user_id,
                func.sum(GameSession.xp_gained).label("total_xp"),
                User.nickname,
                User.avatar,
            )
            .join(User, GameSession.user_id == User.id)
            .where(GameSession.finished_at >= cutoff)
            .group_by(GameSession.user_id, User.nickname, User.avatar)
            .order_by(func.sum(GameSession.xp_gained).desc())
            .limit(50)
        )
        rows = result.all()
        for i, (uid, total_xp, nickname, avatar) in enumerate(rows):
            entries.append(
                LeaderboardEntry(
                    rank=i + 1,
                    display_hash=_make_display_hash(uid),
                    score=int(total_xp or 0),
                    level=1,  # 窗口排行不返回 level
                    nickname=nickname or f"用户{uid}",
                    avatar=avatar,
                    is_current_user=(uid == user_id),
                )
            )

    # P1-03: user_rank 由服务端通过 is_current_user 计算，不依赖暴露的 user_id
    user_rank: Optional[int] = None
    for entry in entries:
        if entry.is_current_user:
            user_rank = entry.rank
            break

    return LeaderboardResponse(
        scope=scope,
        entries=entries,
        user_rank=user_rank,
        updated_at=datetime.now(timezone.utc),
    )
