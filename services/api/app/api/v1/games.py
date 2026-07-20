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
    GameSessionSummaryResponse,
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


# ── P1-3 改进 (2026-07-21): SymPy 数学答案等价判断 ──
# 项目内存约束:
#   - SymPy 1.13.3 + implicit_multiplication_application 已启用
#   - LaTeX wrapping 必须剥离,^ 转换为 **
#   - 方程等价判定: 差值为零即等价 (2x+y-z=1 ≡ 2x+y-z-1=0)

_MATH_SYMBOLS_CACHE: dict = {}


def _strip_latex(expr: str) -> str:
    """剥离 LaTeX 包装 (如 $...$ / \(...\) / \[...\]) 并将 ^ 转为 **。"""
    s = expr.strip()
    # 剥离 LaTeX 包装
    if s.startswith("\\(") and s.endswith("\\)"):
        s = s[2:-2]
    elif s.startswith("\\[") and s.endswith("\\]"):
        s = s[2:-2]
    elif s.startswith("$") and s.endswith("$"):
        s = s[1:-1]
    elif s.startswith("$$") and s.endswith("$$"):
        s = s[2:-2]
    # ^ → ** (Python 幂运算符)
    s = s.replace("^", "**")
    # 去除 LaTeX 命令前缀 \mathrm \text 等
    import re
    s = re.sub(r"\\mathrm\{([^}]*)\}", r"\1", s)
    s = re.sub(r"\\text\{([^}]*)\}", r"\1", s)
    s = re.sub(r"\\frac\{([^}]*)\}\{([^}]*)\}", r"(\1)/(\2)", s)
    s = re.sub(r"\\sqrt\{([^}]*)\}", r"sqrt(\1)", s)
    s = re.sub(r"\\cdot", "*", s)
    s = re.sub(r"\\times", "*", s)
    s = re.sub(r"\\pi", "pi", s)
    return s.strip()


def _is_math_equal(user_answer: str, correct_answer: str) -> bool:
    """使用 SymPy 判断两个数学表达式是否等价。

    支持分数/小数/根号/三角函数等多种形式。
    方程等价: f(x)=g(x) ≡ f(x)-g(x)=0

    Returns:
        True 表示等价, False 表示不等价或解析失败。
    """
    if not user_answer or not correct_answer:
        return False
    if _normalize_answer(user_answer) == _normalize_answer(correct_answer):
        return True

    try:
        from sympy import simplify, sympify, Eq
        from sympy.parsing.sympy_parser import (
            parse_expr,
            standard_transformations,
            implicit_multiplication_application,
            convert_xor,
        )

        transformations = standard_transformations + (
            implicit_multiplication_application,
            convert_xor,
        )

        u = _strip_latex(user_answer)
        c = _strip_latex(correct_answer)

        # 处理方程形式: 含 = 号
        if "=" in u and "=" in c:
            # 将 f=g 转为 f-g,判定差值是否为零
            u_parts = u.split("=", 1)
            c_parts = c.split("=", 1)
            try:
                u_expr = parse_expr(u_parts[0], transformations=transformations) - parse_expr(
                    u_parts[1], transformations=transformations
                )
                c_expr = parse_expr(c_parts[0], transformations=transformations) - parse_expr(
                    c_parts[1], transformations=transformations
                )
                diff = simplify(u_expr - c_expr)
                return diff == 0
            except Exception:
                return False

        # 表达式形式: 直接比较差值
        u_expr = parse_expr(u, transformations=transformations)
        c_expr = parse_expr(c, transformations=transformations)
        diff = simplify(u_expr - c_expr)
        return diff == 0
    except Exception:
        # 解析失败,回退到字符串比较
        return _normalize_answer(user_answer) == _normalize_answer(correct_answer)


# P0-03 (R8): 交互类型映射（与 games-config.json 的 type 字段保持一致）
_INTERACTION_TYPE_MAP: dict[str, str] = {
    # multiple_choice
    "vocabulary-duel": "multiple_choice",
    "high-frequency-challenge": "multiple_choice",
    "wrong-question-boss": "multiple_choice",
    "daily-quiz-arena": "multiple_choice",
    "knowledge-combo-streak": "multiple_choice",
    "memory-maze": "multiple_choice",
    "study-team-raid": "multiple_choice",
    "problem-quest-map": "multiple_choice",
    # tap_match
    "word-match-blast": "tap_match",
    "synonym-antonym-match": "tap_match",
    "picture-word-match": "tap_match",
    "memory-flip-match": "tap_match",
    "formula-link": "tap_match",
    # listen_select
    "listening-dash": "listen_select",
    # spelling
    "spelling-bee": "spelling",
    "word-bubble-pop": "spelling",
    "word-chain": "spelling",
    # drag_sort
    "sentence-untangle": "drag_sort",
    "root-affix-tree": "drag_sort",
    "proof-step-sort": "drag_sort",
    # word_bank
    "cloze-sprint": "word_bank",
    "word-form-master": "word_bank",
    "crossword-quest": "word_bank",
    "flashcard-rush": "word_bank",
    # fill_blank
    "limit-blitz": "fill_blank",
}


def _get_interaction_type(game_id: str) -> str:
    """获取游戏的交互类型。优先从 games-config.json 的 type 字段读取，回退到硬编码映射。"""
    games_raw = _load_games_config()
    game_cfg = next((g for g in games_raw if g.get("game_id") == game_id), None)
    if game_cfg and game_cfg.get("type"):
        return game_cfg["type"]
    return _INTERACTION_TYPE_MAP.get(game_id, "multiple_choice")


def _judge_structured_answer(
    interaction_type: str,
    correct_answer: str,
    body_answer: Optional[str],
    body_structured: Optional[dict[str, Any]],
) -> bool:
    """P0-03 (R8): 判定复杂交互题型的答案。

    - tap_match: 比较 pairs 配对集合
    - drag_sort: 比较 ordered_item_ids 顺序
    - word_bank: 比较 blanks 多空选择
    - 其他: 回退到字符串等值比较
    """
    if body_structured is None:
        # 回退到字符串比较
        return _normalize_answer(body_answer or "") == _normalize_answer(correct_answer)

    if interaction_type == "tap_match":
        # correct_answer 格式: JSON {"pairs": [[left, right], ...]}
        # structured_answer 格式: {"pairs": [[left_id, right_id], ...]}
        try:
            import json as _json
            correct_pairs = _json.loads(correct_answer).get("pairs", [])
            user_pairs = body_structured.get("pairs", [])
            # 比较配对集合（忽略顺序）
            correct_set = {tuple(sorted(p)) for p in correct_pairs}
            user_set = {tuple(sorted(p)) for p in user_pairs}
            return correct_set == user_set
        except (ValueError, TypeError, KeyError):
            return False

    elif interaction_type == "drag_sort":
        # correct_answer 格式: JSON {"ordered": [item1, item2, ...]}
        # structured_answer 格式: {"ordered_item_ids": [id1, id2, ...]}
        try:
            import json as _json
            correct_order = _json.loads(correct_answer).get("ordered", [])
            user_order = body_structured.get("ordered_item_ids", [])
            if len(correct_order) != len(user_order):
                return False
            return all(
                _normalize_answer(str(a)) == _normalize_answer(str(b))
                for a, b in zip(correct_order, user_order)
            )
        except (ValueError, TypeError, KeyError):
            return False

    elif interaction_type == "word_bank":
        # correct_answer 格式: JSON {"blanks": {"b1": "word1", "b2": "word2"}}
        # structured_answer 格式: {"blanks": {"b1": "word1", "b2": "word2"}}
        try:
            import json as _json
            correct_blanks = _json.loads(correct_answer).get("blanks", {})
            user_blanks = body_structured.get("blanks", {})
            if set(correct_blanks.keys()) != set(user_blanks.keys()):
                return False
            return all(
                _normalize_answer(str(correct_blanks[k])) == _normalize_answer(str(user_blanks.get(k, "")))
                for k in correct_blanks
            )
        except (ValueError, TypeError, KeyError):
            return False

    # 回退到字符串比较
    # P1-3 改进: fill_blank 类型使用 SymPy 数学等价判断(支持分数/小数/根号/三角函数)
    if interaction_type == "fill_blank":
        return _is_math_equal(body_answer or "", correct_answer)
    return _normalize_answer(body_answer or "") == _normalize_answer(correct_answer)


def _serialize_answer_for_storage(
    body_answer: Optional[str],
    body_structured: Optional[dict[str, Any]],
) -> str:
    """将答案序列化为字符串用于存储到 GameAnswerEvent.user_answer。"""
    if body_structured is not None:
        import json as _json
        return _json.dumps(body_structured, ensure_ascii=False)
    return body_answer or ""


def _enrich_for_interaction(
    questions: list[dict[str, Any]], interaction_type: str
) -> list[dict[str, Any]]:
    """P0-03 (R8) + P1 改进 (2026-07-21): 根据交互类型为题目添加结构化字段。

    P1 改进 (对标 Quizlet Match / NYT Spelling Bee / Kahoot Jumble):
    - tap_match: 多对配对(每 4 题合并为 1 道多对配对题),对标 Quizlet Match 12 卡片网格
    - drag_sort: 每题独立排序(不再整 session 合并),对标 Kahoot Jumble 排序题
    - word_bank: 题面语义化(优先使用 example 例句挖空,而非"释义+空格")
    - listen_select/multiple_choice: 生成 options 选项,干扰项从全局抽取避免占位
    - spelling/fill_blank: 仅设置 type,前端用 prompt + 输入框
    """
    import json as _json
    import re as _re

    if not questions:
        return questions

    # 统一设置 type 为交互类型
    for q in questions:
        q["type"] = interaction_type

    if interaction_type == "tap_match":
        # P1 改进: 每 4 题合并为 1 道多对配对题(对标 Quizlet Match)
        # session 题量从 10 减为 ~3,但每题需 6-8 次点击完成,挑战性更高
        enriched = []
        batch_size = 4
        batch_idx = 0
        for batch_start in range(0, len(questions), batch_size):
            batch = questions[batch_start:batch_start + batch_size]
            if len(batch) < 2:
                # 不足 2 对的批次作为单题处理(保持原 1 对配对)
                for q in batch:
                    prompt = q.get("prompt", "")
                    meaning = q.get("meaning") or q.get("correct_answer", "")
                    enriched.append({
                        **q,
                        "pairs": [{"left": prompt, "right": meaning}],
                        "left_items": [prompt],
                        "right_options": [meaning],
                        "correct_answer": _json.dumps(
                            {"pairs": [[prompt, meaning]]}, ensure_ascii=False
                        ),
                    })
                continue

            # 合并为多对配对题
            pairs = []
            for q in batch:
                prompt = q.get("prompt", "")
                meaning = q.get("meaning") or q.get("correct_answer", "")
                if prompt and meaning:
                    pairs.append({"left": prompt, "right": meaning})

            if not pairs:
                continue

            left_items = [p["left"] for p in pairs]
            right_options = [p["right"] for p in pairs]
            random.shuffle(right_options)

            correct_pairs = [[p["left"], p["right"]] for p in pairs]
            base_qid = batch[0].get("question_id", f"tap:{batch_idx}")
            # 提取 question_id 前缀(game_id:source)
            qid_prefix = base_qid.rsplit(":", 1)[0] if ":" in base_qid else f"{base_qid}"

            enriched.append({
                "question_id": f"{qid_prefix}:tap_match_batch_{batch_idx}",
                "prompt": f"请将左右两列进行配对({len(pairs)} 对)",
                "pairs": pairs,
                "left_items": left_items,
                "right_options": right_options,
                "correct_answer": _json.dumps(
                    {"pairs": correct_pairs}, ensure_ascii=False
                ),
                "type": "tap_match",
                "sequence": batch_idx,
                # 保留原 batch 的 meaning 用于提示
                "meaning": f"配对 {len(pairs)} 组单词与释义",
            })
            batch_idx += 1
        return enriched

    elif interaction_type == "drag_sort":
        # P1 改进: 每题独立生成排序步骤(不再整 session 合并为 1 题)
        # 优先从 hints/solution 字段获取排序步骤
        enriched = []
        for q_idx, q in enumerate(questions):
            prompt = q.get("prompt", "")
            correct_answer = q.get("correct_answer", "")

            # 尝试从 hints/solution/example 字段获取排序步骤
            solution = q.get("hints") or q.get("example") or q.get("solution") or ""

            steps: list[str] = []
            if isinstance(solution, str) and solution:
                # 优先按换行分割
                lines = [s.strip() for s in solution.replace("\\n", "\n").split("\n") if s.strip()]
                if len(lines) >= 2:
                    steps = lines
                else:
                    # 按句号分割
                    sentences = [s.strip() for s in _re.split(r"[。.]", solution) if s.strip()]
                    if len(sentences) >= 2:
                        steps = sentences
            elif isinstance(solution, list) and len(solution) >= 2:
                steps = [str(s).strip() for s in solution if str(s).strip()]

            # 如果没有 solution,从 prompt 按空格/标点分词
            if len(steps) < 2 and prompt:
                # 数学题/句子: 按空格分词(至少 3 个词)
                words = [w for w in _re.split(r"\s+", prompt) if w]
                if len(words) >= 3:
                    steps = words
                else:
                    # 按字符分词(中文句子)
                    chars = [c for c in prompt if not c.isspace()]
                    if len(chars) >= 4:
                        # 每 2-3 个字符一组
                        step_size = max(2, len(chars) // 4)
                        steps = ["".join(chars[i:i+step_size]) for i in range(0, len(chars), step_size)]

            if len(steps) < 2:
                # 实在无法生成排序步骤,跳过此题
                continue

            # 限制排序项数量(3-6 项最佳)
            if len(steps) > 6:
                steps = steps[:6]

            correct_order = steps.copy()
            shuffled = steps.copy()
            random.shuffle(shuffled)
            # 确保打乱后与原顺序不同
            attempt_count = 0
            while shuffled == correct_order and len(steps) > 1 and attempt_count < 5:
                random.shuffle(shuffled)
                attempt_count += 1

            base_qid = q.get("question_id", f"drag:{q_idx}")
            enriched.append({
                **q,
                "question_id": base_qid,
                "prompt": f"请按正确顺序排列以下内容",
                "sort_items": shuffled,
                "correct_answer": _json.dumps(
                    {"ordered": correct_order}, ensure_ascii=False
                ),
                "type": "drag_sort",
                "sequence": q_idx,
            })
        return enriched if enriched else questions

    elif interaction_type == "word_bank":
        # P1 改进: 题面语义化(优先使用 example 例句挖空)
        # cloze-sprint: 例句挖空(对标完形填空)
        # word-form-master: 词形变化(如果有 example)
        # crossword-quest: 释义+空格(暂时保持,网格待实现)
        # flashcard-rush: 释义+空格(保持简单)
        enriched = []
        all_words = [q.get("prompt", "") for q in questions]
        for i, q in enumerate(questions):
            prompt = q.get("prompt", "")  # 目标词
            meaning = q.get("meaning") or q.get("correct_answer", "")  # 释义
            example = q.get("example")  # 例句

            blank_id = f"b{i + 1}"
            distractors = [w for w in all_words if w != prompt][:3]
            # 干扰项不足时从词库补充
            while len(distractors) < 3:
                distractors.append(f"(干扰{len(distractors)+1})")
            word_bank = [prompt] + distractors[:3]
            random.shuffle(word_bank)

            # P1 改进: 优先使用 example 例句挖空,而非"释义+空格"
            prompt_with_blanks = ""
            if example and isinstance(example, str) and prompt and prompt.lower() in example.lower():
                # 将例句中的目标词替换为 ______
                try:
                    # 大小写不敏感替换
                    pattern = _re.compile(_re.escape(prompt), _re.IGNORECASE)
                    prompt_with_blanks = pattern.sub("______", example, count=1)
                except Exception:
                    prompt_with_blanks = f"{meaning} ______"
            else:
                # 没有例句,使用"释义 + 空格"
                prompt_with_blanks = f"{meaning} ______"

            enriched.append({
                **q,
                "blanks": [{"id": blank_id, "answer": prompt}],
                "word_bank": word_bank,
                "prompt_with_blanks": prompt_with_blanks,
                "correct_answer": _json.dumps(
                    {"blanks": {blank_id: prompt}}, ensure_ascii=False
                ),
            })
        return enriched

    elif interaction_type == "listen_select":
        # 听音选词: 从词汇题生成选择题
        enriched = []
        # P1 改进: 干扰项从全局抽取(避免重复)
        all_meanings = [
            other.get("meaning") or other.get("correct_answer", "")
            for other in questions
        ]
        for q in questions:
            prompt = q.get("prompt", "")
            meaning = q.get("meaning") or q.get("correct_answer", "")
            # 去重干扰项
            distractor_pool = [m for m in all_meanings if m and m != meaning]
            random.shuffle(distractor_pool)
            distractors = distractor_pool[:3]
            # 干扰项不足时用占位
            while len(distractors) < 3:
                distractors.append(f"(选项{len(distractors)+1})")
            options = [meaning] + distractors[:3]
            random.shuffle(options)
            enriched.append({
                **q,
                "options": options,
                "correct_answer": meaning,
            })
        return enriched

    elif interaction_type == "multiple_choice":
        # P1 改进: 选择题干扰项从全局抽取,避免占位"(无)"
        enriched = []
        all_meanings = [
            other.get("meaning") or other.get("correct_answer", "")
            for other in questions
        ]
        for q in questions:
            prompt = q.get("prompt", "")
            correct = q.get("meaning") or q.get("correct_answer", "")
            # 去重干扰项
            distractor_pool = [m for m in all_meanings if m and m != correct]
            random.shuffle(distractor_pool)
            distractors = distractor_pool[:3]
            # 干扰项不足时用占位
            while len(distractors) < 3:
                distractors.append(f"(选项{len(distractors)+1})")
            options = [correct] + distractors[:3]
            random.shuffle(options)
            enriched.append({
                **q,
                "options": options,
                "correct_answer": correct,
            })
        return enriched

    # spelling / fill_blank: 仅设置 type 即可,前端用 prompt + 输入框
    return questions


def _build_questions_for_game(
    game_cfg: dict, difficulty: Optional[str]
) -> list[dict[str, Any]]:
    """根据游戏配置生成题目集（含 correct_answer）。

    P1 改进 (2026-07-21):
    - 新增 "all" 数据源: 聚合 vocabulary + questions 数据源(跨科目游戏可玩)
    - 新增 "user_wrong_questions" 数据源: 暂回退到 all(错题本 API 后续接入)
    - 新增 "user_word_progress" 数据源: 暂回退到 vocabulary(用户单词进度后续接入)
    - 新增 difficulty 参数生效: easy=8题/medium=10题/hard=15题

    优先级：
    1. "all" 数据源: 聚合词汇 + 数学题库
    2. "user_wrong_questions" / "user_word_progress": 暂回退到 all
    3. 词汇类数据源: vocabulary/*.json
    4. 题库类数据源: questions/*.json
    5. 同义词数据源: synonyms.json
    6. 词频数据源: word-frequency.json
    7. 兜底: 使用游戏 props 合成简易题目
    """
    data_sources = game_cfg.get("data_sources") or []
    game_id = game_cfg.get("game_id", "unknown")
    interaction_type = _get_interaction_type(game_id)

    # P1 改进: difficulty 参数生效
    if difficulty == "easy":
        target_count = 8
    elif difficulty == "hard":
        target_count = 15
    else:
        target_count = _DEFAULT_QUESTION_COUNT

    questions: list[dict[str, Any]] = []

    # P1 改进: 处理 "all" / "user_wrong_questions" / "user_word_progress" 数据源
    # 跨科目游戏使用这些数据源,之前走 fallback 生成假题,现在聚合真实题库
    has_all_source = "all" in data_sources
    has_wrong_source = "user_wrong_questions" in data_sources
    has_progress_source = "user_word_progress" in data_sources

    if has_all_source or has_wrong_source or has_progress_source:
        # 聚合词汇库(5 题) + 数学题库(5 题),难度调整题量
        vocab_count = target_count // 2
        math_count = target_count - vocab_count

        # 词汇部分
        vocab_data = _load_data_file("vocabulary/kaoyan-words.json")
        if vocab_data and isinstance(vocab_data, dict):
            words = vocab_data.get("words") or []
            if words:
                # P1 改进: difficulty 影响词汇筛选
                # easy: 短词(<=6 字母); medium: 中等(7-9 字母); hard: 长词(>=10 字母)
                if difficulty == "easy":
                    filtered = [w for w in words if len(w.get("word", "")) <= 6]
                elif difficulty == "hard":
                    filtered = [w for w in words if len(w.get("word", "")) >= 7]
                else:
                    filtered = words
                if not filtered:
                    filtered = words  # 难度筛选无结果,回退到全部
                random.shuffle(filtered)
                for w in filtered[:vocab_count]:
                    word_text = w.get("word") or ""
                    meaning = w.get("meaning") or ""
                    if not word_text or not meaning:
                        continue
                    questions.append({
                        "question_id": f"{game_id}:vocab:{w.get('id', word_text)}",
                        "prompt": word_text,
                        "meaning": meaning,
                        "phonetic": w.get("phonetic"),
                        "example": w.get("example"),
                        "type": "vocabulary_meaning",
                        "correct_answer": meaning,
                    })

        # 数学部分
        math_data = _load_data_file("questions/math-examples.json")
        if math_data and isinstance(math_data, dict):
            q_list = math_data.get("questions") or []
            if q_list:
                random.shuffle(q_list)
                for q in q_list[:math_count]:
                    answer = q.get("answer") or ""
                    if not answer:
                        continue
                    questions.append({
                        "question_id": f"{game_id}:q:{q.get('id', '')}",
                        "prompt": q.get("content") or "",
                        "title": q.get("title"),
                        "chapter": q.get("chapter"),
                        "section": q.get("section"),
                        "hints": q.get("hints"),
                        "type": q.get("type", "calculation"),
                        "correct_answer": answer,
                    })

        if questions:
            return _enrich_for_interaction(questions, interaction_type)

    # 1) 词汇类数据源
    vocab_source = next(
        (s for s in data_sources if s.startswith("vocabulary/")), None
    )
    if vocab_source:
        data = _load_data_file(vocab_source)
        if data and isinstance(data, dict):
            words = data.get("words") or []
            if words:
                # P1 改进: difficulty 影响词汇筛选
                if difficulty == "easy":
                    filtered = [w for w in words if len(w.get("word", "")) <= 6]
                elif difficulty == "hard":
                    filtered = [w for w in words if len(w.get("word", "")) >= 7]
                else:
                    filtered = words
                if not filtered:
                    filtered = words
                random.shuffle(filtered)
                for w in filtered[:target_count]:
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
            return _enrich_for_interaction(questions, interaction_type)

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
            return _enrich_for_interaction(questions, interaction_type)

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
            return _enrich_for_interaction(questions, interaction_type)

    # 4) 词频数据源（vocabulary/word-frequency.json）
    freq_source = next(
        (s for s in data_sources if "word-frequency" in s or "frequency" in s), None
    )
    if freq_source:
        data = _load_data_file(freq_source)
        if data and isinstance(data, dict):
            entries = data.get("words") or data.get("entries") or []
            if entries and isinstance(entries, list):
                # P1 改进: difficulty 影响词频筛选
                # easy: 高频词(前 30%); hard: 低频词(后 30%); medium: 中频
                sorted_entries = sorted(
                    entries,
                    key=lambda e: -(e.get("frequency", 0) if isinstance(e, dict) else 0)
                )
                if difficulty == "easy":
                    cutoff = int(len(sorted_entries) * 0.3)
                    filtered = sorted_entries[:max(cutoff, 10)]
                elif difficulty == "hard":
                    cutoff = int(len(sorted_entries) * 0.7)
                    filtered = sorted_entries[cutoff:]
                else:
                    filtered = sorted_entries
                if not filtered:
                    filtered = sorted_entries
                random.shuffle(filtered)
                for entry in filtered[:target_count]:
                    word_text = entry.get("word") or entry.get("term") or ""
                    meaning = entry.get("meaning") or entry.get("definition") or ""
                    if not word_text or not meaning:
                        continue
                    questions.append({
                        "question_id": f"{game_id}:freq:{word_text}",
                        "prompt": word_text,
                        "meaning": meaning,
                        "type": "vocabulary_meaning",
                        "correct_answer": meaning,
                    })
        if questions:
            return _enrich_for_interaction(questions, interaction_type)

    # 5) 兜底：使用游戏 props 合成简易题目
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
    return _enrich_for_interaction(questions, interaction_type)


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
        interaction_type=_get_interaction_type(game_id),
        game_name=game_cfg.get("name", game_id),
        # P1 改进: 返回 lives 让前端 HeartsDisplay 生效
        lives=int(session_cfg.get("lives", 0) or 0),
        # P1 改进: 返回 rewards 让前端 score/combo 计算与服务端一致
        rewards={
            "base_xp": int((game_cfg.get("rewards") or {}).get("base_xp", 10) or 10),
            "base_coin": int((game_cfg.get("rewards") or {}).get("base_coin", 5) or 5),
            "combo_multiplier": float((game_cfg.get("rewards") or {}).get("combo_multiplier", 1.0) or 1.0),
        },
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

    # P0-03 (R8): 校验 answer 和 structured_answer 至少传一个
    if not body.answer and not body.structured_answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="answer 和 structured_answer 至少需要传一个",
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

    # P0-03 (R8): 根据交互类型判定正误（支持结构化答案）
    interaction_type = _get_interaction_type(game_id)
    is_correct = _judge_structured_answer(
        interaction_type,
        game_question.correct_answer,
        body.answer,
        body.structured_answer,
    )

    # 序列化答案用于存储
    stored_answer = _serialize_answer_for_storage(body.answer, body.structured_answer)

    # 写入 GameAnswerEvent（不可变事件流）
    db.add(
        GameAnswerEvent(
            session_id=session_id,
            user_id=user_id,
            question_id=body.question_id,
            sequence=body.sequence,
            user_answer=stored_answer,
            is_correct=is_correct,
            idempotency_key=body.idempotency_key,
        )
    )

    # 更新 GameQuestion
    game_question.user_answer = stored_answer
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

    P0-01 (R7): 数据库行锁 + IntegrityError 处理
    - 使用 SELECT FOR UPDATE 锁定 session 行，防止并发 finish
    - 捕获 IntegrityError（uq_game_rewards_session 唯一约束冲突）
    - 冲突时 rollback 并返回首次结算结果，绝不二次发奖

    - 校验 session
    - 服务端基于 GameAnswerEvent 计算 score / accuracy / xp / coins
    - 反作弊：min 500ms 答题间隔、accuracy > 0.95 且总时长 < 3s 视为异常
    - 写入 GameRewardsLedger（不可变，uq_game_rewards_session 兜底）
    - 更新 GameSession.status = finished + 各字段
    - 更新 UserGameProfile（XP / coins 累加）
    - 返回最终结算结果
    """
    # P0-01 (R7): 使用 SELECT FOR UPDATE 锁定 session 行，防止并发 finish
    session_result = await db.execute(
        select(GameSession)
        .where(
            GameSession.id == session_id,
            GameSession.user_id == user_id,
        )
        .with_for_update()
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
        # P0-01 (R7): 已结算的 session，返回首次结算结果而非 409
        # 查询既有 ledger 返回首次结果
        existing_ledger_result = await db.execute(
            select(GameRewardsLedger).where(
                GameRewardsLedger.session_id == session_id
            )
        )
        existing_ledger = existing_ledger_result.scalar_one_or_none()
        if existing_ledger:
            # 返回首次结算结果
            return GameSessionFinishResponse(
                session_id=session_id,
                score=existing_ledger.score,
                xp_gained=existing_ledger.xp_gained,
                coins_gained=existing_ledger.coins_gained,
                accuracy=existing_ledger.accuracy,
                correct_count=0,  # 不重新计算，避免侧信道
                total_questions=0,
                max_combo=0,  # P1-4: 已有 ledger 不重新计算 combo
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="会话已结算但未找到账本记录",
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

    # P0-01 (R7): 写入 GameRewardsLedger + commit 包裹在 try/except IntegrityError 中
    # 唯一约束 uq_game_rewards_session 冲突时 rollback，返回首次结算结果
    from sqlalchemy.exc import IntegrityError as SAIntegrityError

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

    try:
        await db.commit()
    except SAIntegrityError:
        # P0-01 (R7): 并发 finish 导致唯一约束冲突
        # rollback 并返回首次结算结果，绝不二次发奖
        await db.rollback()
        existing_ledger_result = await db.execute(
            select(GameRewardsLedger).where(
                GameRewardsLedger.session_id == session_id
            )
        )
        existing_ledger = existing_ledger_result.scalar_one_or_none()
        if existing_ledger:
            return GameSessionFinishResponse(
                session_id=session_id,
                score=existing_ledger.score,
                xp_gained=existing_ledger.xp_gained,
                coins_gained=existing_ledger.coins_gained,
                accuracy=existing_ledger.accuracy,
                correct_count=0,
                total_questions=0,
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="并发结算冲突，请重试",
        )

    return GameSessionFinishResponse(
        session_id=session_id,
        score=final_score,
        xp_gained=xp_gained,
        coins_gained=coins_gained,
        accuracy=accuracy,
        correct_count=correct_count,
        total_questions=total_questions,
        # P1-4 改进: 返回 max_combo 供前端 GameResult 展示连击纪录
        max_combo=max_combo,
    )


@router.get(
    "/{game_id}/sessions/{session_id}/summary",
    response_model=GameSessionSummaryResponse,
    summary="获取游戏会话总结",
)
async def get_game_session_summary(
    game_id: str,
    session_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GameSessionSummaryResponse:
    """P0-01 (R8): 获取已结束会话的完整统计。

    前端在 GameResult 页面调用，返回正确/错误题目列表与改进建议。
    不含 correct_answer（仅在 finish 响应中可选返回）。
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

    # 查询题目与答题事件
    questions_result = await db.execute(
        select(GameQuestion).where(GameQuestion.session_id == session_id)
    )
    questions = questions_result.scalars().all()

    events_result = await db.execute(
        select(GameAnswerEvent)
        .where(GameAnswerEvent.session_id == session_id)
        .order_by(GameAnswerEvent.created_at.asc())
    )
    events = events_result.scalars().all()

    correct_items: list[str] = []
    wrong_items: list[str] = []
    for q in questions:
        prompt = q.question_id.split(":")[-1] if ":" in q.question_id else q.question_id
        if q.is_correct:
            correct_items.append(prompt)
        elif q.answered_at is not None:
            wrong_items.append(prompt)

    improvement_items = wrong_items[:5]

    # 加载游戏名称
    games_raw = _load_games_config()
    game_cfg = next((g for g in games_raw if g["game_id"] == game_id), None)
    game_name = game_cfg.get("name", game_id) if game_cfg else game_id

    return GameSessionSummaryResponse(
        session_id=session_id,
        game_id=game_id,
        game_name=game_name,
        score=session.score,
        xp_gained=session.xp_gained,
        coins_gained=session.coins_gained,
        accuracy=session.accuracy or 0.0,
        correct_count=sum(1 for e in events if e.is_correct),
        total_questions=len(questions),
        duration=session.duration,
        correct_items=correct_items,
        wrong_items=wrong_items,
        improvement_items=improvement_items,
        completed_at=session.finished_at,
    )


@router.post(
    "/{game_id}/sessions",
    summary="提交游戏会话（已废弃，请使用 /start + /answers + /finish）",
    deprecated=True,
)
async def submit_game_session(
    game_id: str,
    body: GameSessionRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """提交完成的游戏会话（已废弃）。

    **P0-1 (R5): 此端点已废弃，返回 410 Gone。**

    客户端必须使用三段式逐题作答流程才能获得奖励：
    1. POST /{game_id}/sessions/start — 服务端生成题目集
    2. POST /{game_id}/sessions/{session_id}/answers — 逐题提交
    3. POST /{game_id}/sessions/{session_id}/finish — 服务端结算

    R4 过渡期仅返回 0 奖励；R5 正式下线，返回 410 Gone 阻止旧客户端继续调用。
    客户端 accuracy 不再驱动任何奖励计算。
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="此接口已废弃（410 Gone）。请使用三段式接口：POST /{game_id}/sessions/start → /answers → /finish",
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
