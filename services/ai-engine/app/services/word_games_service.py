"""
单词游戏服务
趣味单词游戏逻辑

G02: 动态取词 — 从 data/vocabulary/*.json 或 DB vocabulary_words 表加载
G03: session/leaderboard 持久化到 DB（asyncpg）

第五轮复审 6.1/6.2/6.3 修复：
- 6.1① 数学/跨科游戏后端：从 data/questions/*.json 加载数学题，按 subject 分流出题
- 6.1② user_id 外键违约：JWT 优先（require_auth 透传），删除 user_id=0 兜底
- 6.2④ 错词本假数据：session.answered 逐题记录，summary 按真实记录分类
- 6.2⑤ 25 款游戏差异化：按 game_id 差异化出题（数学/英语/跨科分流）
- 6.2⑥ 排行榜串榜：持久化真实 game_id，按 game_id 分榜
- 6.3 重复出词：采样去重，避免 fallback 重复

第七轮后待修复项（P0/P1/P2）：
- P0-1：JWT sub 已确认为 str(users.id) 数字，_finalize_session 加防御性日志
- P1-2：数学题正确答案持久化到 Word.correct_answer，submit_answer 直接读取，
        不再线性遍历 _all_math 反查；数学题优先 MULTIPLE_CHOICE 提升判分可靠性
- P1-3：跨科游戏（CROSS_SUBJECT）混合词汇+数学题，不再全出数学题
- P1-4：按 game_id 差异化出题机制（题型分流 + 主题文案）
"""
import json
import os
import logging
import random
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

from config import settings
from app.models.word_games import (
    WordGameRequest,
    WordGameResponse,
    WordGameSession,
    WordGameQuestion,
    WordGameAnswer,
    WordGameResult,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    GameSummary,
    GameType,
    GameDifficulty,
    SubjectType,
    Word,
    AnswerRecord,
    LeaderboardRequest,
    LeaderboardResponse,
    LeaderboardEntry,
)

logger = logging.getLogger("ai_engine.word_games")

# 项目根目录（ai-engine/app/services/word_games_service.py → 上四级为项目根）
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
_VOCAB_DIR = os.path.join(_PROJECT_ROOT, "data", "vocabulary")
_QUESTIONS_DIR = os.path.join(_PROJECT_ROOT, "data", "questions")

# difficulty → frequency 区间映射（词汇）
_DIFFICULTY_FREQ_MAP: Dict[GameDifficulty, tuple] = {
    GameDifficulty.EASY: (4, 5),    # freq >= 4
    GameDifficulty.MEDIUM: (2, 3),  # freq 2-3
    GameDifficulty.HARD: (1, 1),    # freq 1
}

# difficulty → 数学题难度区间映射
_DIFFICULTY_MATH_MAP: Dict[GameDifficulty, tuple] = {
    GameDifficulty.EASY: (1, 2),
    GameDifficulty.MEDIUM: (2, 3),
    GameDifficulty.HARD: (3, 5),
}


class WordGamesService:
    """单词游戏服务（动态取词 + DB 持久化）"""

    def __init__(self):
        self.time_limit = settings.WORD_GAME_TIME_LIMIT
        self.batch_size = settings.WORD_GAME_BATCH_SIZE
        # 词库缓存：{difficulty: [Word, ...]}
        self._word_bank: Optional[Dict[GameDifficulty, List[Word]]] = None
        # 全量词库（用于选择题干扰项）
        self._all_words: List[Word] = []
        # 数学题库缓存：{difficulty: [MathQuestion, ...]}
        self._math_bank: Optional[Dict[GameDifficulty, List[Dict]]] = None
        # 全量数学题库（用于选择题干扰项）
        self._all_math: List[Dict] = []

    # ──────────────────────────────────────────────
    #  词汇加载（G02）
    # ──────────────────────────────────────────────

    async def _load_word_bank(self) -> Dict[GameDifficulty, List[Word]]:
        """从 data/vocabulary/*.json 加载词汇，按 difficulty 映射 frequency 区间。

        优先从 JSON 文件加载；若文件不可用则尝试从 DB 查询。
        结果缓存到 ``self._word_bank``。
        """
        if self._word_bank is not None:
            return self._word_bank

        # 尝试从 JSON 文件加载
        try:
            bank = self._load_from_json()
            if bank and any(len(v) > 0 for v in bank.values()):
                self._word_bank = bank
                self._all_words = [w for words in bank.values() for w in words]
                logger.info(
                    "Word bank loaded from JSON: %d words total",
                    len(self._all_words),
                )
                return self._word_bank
        except Exception as e:
            logger.warning("Failed to load word bank from JSON: %s", e)

        # 回退到 DB 查询
        try:
            bank = await self._load_from_db()
            if bank and any(len(v) > 0 for v in bank.values()):
                self._word_bank = bank
                self._all_words = [w for words in bank.values() for w in words]
                logger.info(
                    "Word bank loaded from DB: %d words total",
                    len(self._all_words),
                )
                return self._word_bank
        except Exception as e:
            logger.error("Failed to load word bank from DB: %s", e)

        # 最终回退：极少量内置词（仅防止服务完全不可用）
        logger.warning("Using fallback minimal word bank")
        fallback = self._fallback_word_bank()
        self._word_bank = fallback
        self._all_words = [w for words in fallback.values() for w in words]
        return self._word_bank

    def _load_from_json(self) -> Dict[GameDifficulty, List[Word]]:
        """从 data/vocabulary/*.json 文件加载词汇。"""
        bank: Dict[GameDifficulty, List[Word]] = {
            GameDifficulty.EASY: [],
            GameDifficulty.MEDIUM: [],
            GameDifficulty.HARD: [],
        }

        if not os.path.isdir(_VOCAB_DIR):
            logger.warning("Vocabulary directory not found: %s", _VOCAB_DIR)
            return bank

        json_files = [
            f for f in os.listdir(_VOCAB_DIR)
            if f.endswith(".json") and f != "word-books.json"
        ]

        for filename in json_files:
            filepath = os.path.join(_VOCAB_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)

                words = data if isinstance(data, list) else data.get("words", [])
                for w in words:
                    if not isinstance(w, dict):
                        continue
                    headword = w.get("headword", w.get("word", ""))
                    if not headword:
                        continue

                    freq = int(w.get("frequency", 3) or 3)
                    word_obj = Word(
                        word_id=w.get("word_id", w.get("id", "")),
                        word=headword,
                        meaning=w.get("meaning", w.get("definition", "")),
                        pronunciation=w.get("phonetic", ""),
                        example_sentence=(
                            w.get("examples", [{}])[0].get("en", "")
                            if w.get("examples")
                            else w.get("example", "")
                        ),
                        part_of_speech=None,
                        difficulty=min(max(freq / 5.0, 0.1), 1.0),
                        category=(
                            w.get("tags", [None])[0]
                            if w.get("tags") else w.get("category")
                        ),
                    )

                    # 按 frequency 映射到 difficulty
                    for diff, (lo, hi) in _DIFFICULTY_FREQ_MAP.items():
                        if lo <= freq <= hi:
                            bank[diff].append(word_obj)
                            break
                    else:
                        # 默认归入 MEDIUM
                        bank[GameDifficulty.MEDIUM].append(word_obj)

            except (json.JSONDecodeError, IOError) as e:
                logger.warning("Failed to load %s: %s", filename, e)

        return bank

    async def _load_from_db(self) -> Dict[GameDifficulty, List[Word]]:
        """从 DB vocabulary_words 表加载词汇（回退方案）。"""
        from app.db import get_pool

        pool = await get_pool()
        bank: Dict[GameDifficulty, List[Word]] = {
            GameDifficulty.EASY: [],
            GameDifficulty.MEDIUM: [],
            GameDifficulty.HARD: [],
        }

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT word_id, headword, meaning, phonetic, tags, frequency,
                       synonyms, antonyms, examples
                FROM vocabulary_words
                ORDER BY frequency DESC
                LIMIT 3000
                """
            )

        for r in rows:
            freq = int(r["frequency"] or 3)
            examples = r["examples"]
            if isinstance(examples, str):
                examples = json.loads(examples)
            ex_en = ""
            if examples and isinstance(examples, list) and len(examples) > 0:
                ex = examples[0]
                if isinstance(ex, dict):
                    ex_en = ex.get("en", "")
                elif isinstance(ex, str):
                    ex_en = ex

            tags = r["tags"]
            if isinstance(tags, str):
                tags = json.loads(tags)

            word_obj = Word(
                word_id=r["word_id"],
                word=r["headword"],
                meaning=r["meaning"],
                pronunciation=r["phonetic"] or "",
                example_sentence=ex_en,
                part_of_speech=None,
                difficulty=min(max(freq / 5.0, 0.1), 1.0),
                category=tags[0] if tags else None,
            )

            for diff, (lo, hi) in _DIFFICULTY_FREQ_MAP.items():
                if lo <= freq <= hi:
                    bank[diff].append(word_obj)
                    break
            else:
                bank[GameDifficulty.MEDIUM].append(word_obj)

        return bank

    def _fallback_word_bank(self) -> Dict[GameDifficulty, List[Word]]:
        """最终回退：极少量内置词（防止 JSON/DB 都不可用时服务完全不可用）。"""
        return {
            GameDifficulty.EASY: [
                Word(word_id="fb1", word="apple", meaning="苹果",
                     pronunciation="ˈæpl", difficulty=0.2, category="fruit"),
                Word(word_id="fb2", word="water", meaning="水",
                     pronunciation="ˈwɔːtə", difficulty=0.2, category="nature"),
                Word(word_id="fb3", word="book", meaning="书",
                     pronunciation="bʊk", difficulty=0.2, category="object"),
            ],
            GameDifficulty.MEDIUM: [
                Word(word_id="fb4", word="important", meaning="重要的",
                     pronunciation="ɪmˈpɔːrtnt", difficulty=0.5, category="adj"),
                Word(word_id="fb5", word="develop", meaning="发展",
                     pronunciation="dɪˈveləp", difficulty=0.5, category="verb"),
            ],
            GameDifficulty.HARD: [
                Word(word_id="fb6", word="phenomenon", meaning="现象",
                     pronunciation="fəˈnɒmɪnən", difficulty=0.8, category="noun"),
                Word(word_id="fb7", word="sophisticated", meaning="复杂的",
                     pronunciation="səˈfɪstɪkeɪtɪd", difficulty=0.8, category="adj"),
            ],
        }

    # ──────────────────────────────────────────────
    #  数学题库加载（6.1①）
    # ──────────────────────────────────────────────

    async def _load_math_bank(self) -> Dict[GameDifficulty, List[Dict]]:
        """从 data/questions/math-*.json 加载数学题，按 difficulty 分桶。

        兼容两种 JSON 结构：
        - 顶层数组：math-full.json → [{...}, ...]
        - 包裹对象：math-examples.json → {"questions": [{...}, ...]}
        """
        if self._math_bank is not None:
            return self._math_bank

        bank: Dict[GameDifficulty, List[Dict]] = {
            GameDifficulty.EASY: [],
            GameDifficulty.MEDIUM: [],
            GameDifficulty.HARD: [],
        }

        if not os.path.isdir(_QUESTIONS_DIR):
            logger.warning("Questions directory not found: %s", _QUESTIONS_DIR)
            self._math_bank = bank
            self._all_math = []
            return bank

        # 加载所有 math-*.json 文件
        math_files = [
            f for f in os.listdir(_QUESTIONS_DIR)
            if f.startswith("math-") and f.endswith(".json")
        ]

        for filename in math_files:
            filepath = os.path.join(_QUESTIONS_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # 兼容两种结构
                if isinstance(data, list):
                    questions = data
                elif isinstance(data, dict):
                    questions = data.get("questions", [])
                else:
                    continue

                for q in questions:
                    if not isinstance(q, dict):
                        continue
                    content = q.get("content", "")
                    if not content:
                        continue

                    diff_val = int(q.get("difficulty", 2) or 2)
                    for diff, (lo, hi) in _DIFFICULTY_MATH_MAP.items():
                        if lo <= diff_val <= hi:
                            bank[diff].append(q)
                            break
                    else:
                        bank[GameDifficulty.MEDIUM].append(q)

            except (json.JSONDecodeError, IOError) as e:
                logger.warning("Failed to load %s: %s", filename, e)

        self._math_bank = bank
        self._all_math = [q for qs in bank.values() for q in qs]
        logger.info(
            "Math bank loaded: %d questions total (easy=%d, medium=%d, hard=%d)",
            len(self._all_math),
            len(bank[GameDifficulty.EASY]),
            len(bank[GameDifficulty.MEDIUM]),
            len(bank[GameDifficulty.HARD]),
        )
        return self._math_bank

    async def _select_math_questions(
        self,
        count: int,
        difficulty: GameDifficulty,
        exclude_ids: List[str] = None,
    ) -> List[Dict]:
        """从数学题库随机选择题目（去重，6.3）。"""
        bank = await self._load_math_bank()
        pool = list(bank.get(difficulty, bank[GameDifficulty.MEDIUM]))

        exclude_ids = exclude_ids or []
        pool = [q for q in pool if q.get("id", "") not in exclude_ids]

        # 不够时从其他难度补充
        if len(pool) < count:
            for diff in [GameDifficulty.EASY, GameDifficulty.MEDIUM, GameDifficulty.HARD]:
                if diff != difficulty:
                    additional = [
                        q for q in bank.get(diff, [])
                        if q.get("id", "") not in exclude_ids
                        and q not in pool
                    ]
                    pool.extend(additional)

        if not pool:
            pool = self._all_math[:count] if self._all_math else []

        # 6.3 修复：random.sample 自带去重（基于 list 元素），避免重复出词
        selected = random.sample(pool, min(count, len(pool)))
        return selected[:count]

    # ──────────────────────────────────────────────
    #  游戏 API（G02 + G03）
    # ──────────────────────────────────────────────

    async def start_game(
        self,
        request: WordGameRequest,
        auth: Optional[dict] = None,
        auth_token: Optional[str] = None,
    ) -> WordGameResponse:
        """开始游戏

        6.1①：按 subject 分流——数学/跨科从 questions/math-*.json 取题，
              词汇从 vocabulary/*.json 取词。
        6.1②：auth 透传——JWT 优先用 sub 作为 user_id，避免 student_001 → 0 外键违约。
        6.2⑤：记录 game_id，按 game_id 差异化出题。
        词汇联动：优先使用今日学过的词汇，不足时从词库扩展。
        """
        # 6.1② user_id 解析：JWT sub 优先，request.user_id 兜底
        user_id = request.user_id
        if auth and auth.get("auth_type") == "jwt":
            jwt_sub = auth.get("sub")
            if jwt_sub:
                user_id = str(jwt_sub)
                # P0-1 防御性日志：JWT sub 应为数字 users.id，非数字时成绩会静默不入库
                if not str(jwt_sub).lstrip("-").isdigit():
                    logger.warning(
                        "JWT sub=%r 非数字，game progress will not persist (foreign key constraint). "
                        "Ensure api signs JWT sub=str(users.id).",
                        jwt_sub,
                    )

        # 词汇联动：尝试获取今日学过的词汇（优先使用）
        today_words = await self._fetch_today_vocab_words(auth_token)

        # 6.1①/P1-3 按 subject 分流取题
        # - MATH：纯数学题
        # - CROSS_SUBJECT：词汇 + 数学混合（P1-3 修复：不再全出数学题）
        # - VOCABULARY：纯词汇
        math_questions: List[Dict] = []
        words: List[Word] = []

        if request.subject == SubjectType.MATH:
            # 纯数学题
            math_questions = await self._select_math_questions(
                count=request.word_count,
                difficulty=request.difficulty,
            )
            words = self._math_questions_to_words(math_questions)
        elif request.subject == SubjectType.CROSS_SUBJECT:
            # P1-3 跨科混合：一半词汇 + 一半数学
            half = max(1, request.word_count // 2)
            math_count = request.word_count - half
            math_questions = await self._select_math_questions(
                count=math_count,
                difficulty=request.difficulty,
            )
            await self._load_word_bank()
            vocab_words = await self._select_words_with_today(
                count=half,
                difficulty=request.difficulty,
                categories=request.categories,
                exclude_words=request.exclude_words or [],
                today_words=today_words,
            )
            words = self._math_questions_to_words(math_questions) + vocab_words
            # 打乱顺序，避免前半数学后半词汇
            combined = list(zip(words, [True] * len(math_questions) + [False] * len(vocab_words)))
            random.shuffle(combined)
            words = [w for w, _ in combined]
            # 重新整理 math_questions 顺序以匹配 words
            math_q_by_id = {q.get("id"): q for q in math_questions}
            math_questions = [
                math_q_by_id[w.word_id]
                for w in words
                if w.word_id in math_q_by_id
            ]
        else:
            # 词汇题：优先今日学过的，不足时从词库扩展
            await self._load_word_bank()
            words = await self._select_words_with_today(
                count=request.word_count,
                difficulty=request.difficulty,
                categories=request.categories,
                exclude_words=request.exclude_words or [],
                today_words=today_words,
            )

        # word-chain 特殊处理：交替制需要较大 word_count 防止提前结束
        if request.game_id == "word-chain" and request.word_count < 20:
            words = words * 3  # 复制词库扩展，实际使用时动态替换

        # 确定时间限制
        time_limit = request.time_limit_seconds or self._calculate_time_limit(
            request.game_type,
            request.word_count
        )

        # 创建会话
        session = WordGameSession(
            session_id=f"session_{uuid.uuid4().hex[:8]}",
            user_id=user_id,
            game_type=request.game_type,
            game_id=request.game_id,
            subject=request.subject,
            difficulty=request.difficulty,
            words=words,
            current_index=0,
            score=0,
            correct_count=0,
            wrong_count=0,
            time_limit_seconds=time_limit,
            started_at=datetime.now(),
            is_active=True,
            answered=[],
        )

        # 把数学题原始数据挂到 session 的 words 元信息里（通过 meaning 字段已存）
        # 持久化会话到 DB
        await self._persist_session(session)

        # 生成第一个问题
        first_question = await self._generate_question(
            session=session,
            index=0,
            math_questions=math_questions,
        )

        # 游戏说明
        instructions = self._get_game_instructions(request.game_type)

        return WordGameResponse(
            session=session,
            first_question=first_question,
            total_questions=len(words),
            instructions=instructions,
            generated_at=datetime.now()
        )

    async def submit_answer(
        self,
        request: SubmitAnswerRequest,
        auth: Optional[dict] = None,
        auth_token: Optional[str] = None,
    ) -> SubmitAnswerResponse:
        """提交答案

        6.1②：auth 透传校验 session 归属。
        6.2④：每题作答记录到 session.answered，summary 按真实记录分类。
        6.1①：数学题用题目 answer 字段校验，词汇题用 word 校验。
        词汇联动：答完每题后向 api 提交 word event（correct/wrong），
                  扩展词会自动进入下次词汇学习。
        """
        # 从 DB 恢复会话（跨 worker 可恢复）
        session = await self._restore_session(request.session_id)
        if not session:
            raise ValueError(f"Session {request.session_id} not found")

        # 6.1② 鉴权校验：JWT 用户只能提交自己的 session
        if auth and auth.get("auth_type") == "jwt":
            jwt_sub = str(auth.get("sub") or "")
            if jwt_sub and session.user_id != jwt_sub:
                raise ValueError(
                    f"Session {request.session_id} 不属于当前用户"
                )

        answer = request.answer

        # 获取当前题目
        current_word = session.words[session.current_index]
        is_math = session.subject in (SubjectType.MATH, SubjectType.CROSS_SUBJECT)

        # P1-2 答案判定：优先从 Word.correct_answer 读取（已随 session 持久化），
        #         避免线性遍历 _all_math（5026 题）反查；回退才用 _get_math_correct_answer
        if is_math:
            # DRAG_SORT 数学题（proof-step-sort）：正确答案是排序后的步骤序列，需从 solution 重新生成
            if session.game_type == GameType.DRAG_SORT:
                math_q = await self._get_math_question_by_id(current_word.word_id)
                if math_q:
                    solution = math_q.get("solution", "")
                    content = math_q.get("content", "")
                    if solution:
                        steps = [s.strip() for s in solution.replace('。', '\n').replace('.', '\n').split('\n') if s.strip()]
                    else:
                        steps = content.split() if content else [current_word.correct_answer or "无步骤"]
                    if len(steps) < 2:
                        steps = [f"步骤1: {content[:30]}", f"步骤2: 求解得 {current_word.correct_answer}"]
                    correct_answer = " | ".join(steps)
                else:
                    correct_answer = current_word.correct_answer or ""
            # TAP_MATCH 数学题（formula-link）：正确答案是数学题答案，与 word.correct_answer 一致
            else:
                correct_answer = current_word.correct_answer or ""
                if not correct_answer:
                    # 回退：从题库反查（兼容旧 session，未存 correct_answer 字段）
                    correct_answer = await self._get_math_correct_answer(current_word.word_id)
                if not correct_answer:
                    # 最终回退：用 solution 第一行
                    correct_answer = (current_word.example_sentence or "").split("\n")[0]
        else:
            # 词汇题：按 game_id 推导正确答案（与 _generate_vocab_question 题型路由一致）
            correct_answer = self._get_vocab_correct_answer(session, current_word)

        # 判断答案是否正确
        # word-chain 特殊判分：用户输入的单词必须以正确首字母开头，且是有效英文单词
        if session.game_id == "word-chain":
            # 使用 chain_used_words 防重复
            is_correct = self._check_word_chain_answer(
                user_answer=answer.user_answer,
                expected_letter=correct_answer,
                used_words=session.chain_used_words,
            )
        else:
            is_correct = self._check_answer(
                user_answer=answer.user_answer,
                correct_answer=correct_answer,
                game_type=session.game_type
            )

        # 计算得分
        points_earned = 0
        if is_correct:
            base_points = 10
            time_bonus = max(0, 5 - answer.time_spent_seconds // 10)
            hint_bonus = 3 if not answer.used_hint else 0
            points_earned = base_points + time_bonus + hint_bonus
            session.correct_count += 1
        else:
            session.wrong_count += 1

        session.score += points_earned

        # 6.2④ 记录作答明细
        session.answered.append(AnswerRecord(
            question_id=answer.question_id,
            word_id=current_word.word_id,
            word=current_word.word,
            is_correct=is_correct,
            user_answer=answer.user_answer,
            correct_answer=correct_answer,
        ))

        # 词汇联动：向 api 提交 word event，同步词汇进度
        # correct → SRS 推进，wrong → SRS 重置，扩展词自动进入下次词汇学习
        if not is_math and current_word.word_id:
            try:
                await self._submit_word_event(
                    auth_token=auth_token,
                    word_id=current_word.word_id,
                    event_type="correct" if is_correct else "wrong",
                    game_id=session.game_id,
                    duration_ms=answer.time_spent_seconds * 1000,
                )
            except Exception as e:
                logger.debug("Vocab event submission failed (non-critical): %s", e)

        # 生成反馈
        feedback = self._generate_feedback(
            is_correct=is_correct,
            word=current_word,
            user_answer=answer.user_answer,
            game_id=session.game_id or "",
        )

        # 创建结果
        result = WordGameResult(
            question_id=answer.question_id,
            is_correct=is_correct,
            user_answer=answer.user_answer,
            correct_answer=correct_answer,
            points_earned=points_earned,
            time_spent_seconds=answer.time_spent_seconds,
            feedback=feedback
        )

        # 移动到下一个
        # word-chain 交替回合制：用户答错时不推进，让用户重试同一个词
        if session.game_id == "word-chain" and not is_correct:
            pass  # 不推进 current_index，用户重试
        else:
            session.current_index += 1

        # word-chain 交替回合制：用户答对后，系统接用户的词
        # 系统接词逻辑在 _system_pick_chain_word 中实现
        system_chain_word = None
        if session.game_id == "word-chain" and is_correct:
            user_word = answer.user_answer.strip()
            # 把用户词加入已用列表
            if user_word and user_word.lower() not in [w.lower() for w in session.chain_used_words]:
                session.chain_used_words.append(user_word)
            # 系统接用户词的尾字母
            system_chain_word = self._system_pick_chain_word(
                last_letter=user_word[-1].lower() if user_word else "a",
                used_words=session.chain_used_words,
            )
            if system_chain_word:
                # 系统接上词，更新链状态，下一题显示系统接的词
                session.chain_current_word = system_chain_word
                session.chain_turn = "system"
                if system_chain_word.lower() not in [w.lower() for w in session.chain_used_words]:
                    session.chain_used_words.append(system_chain_word)
                # 附加系统接词信息到反馈
                feedback += f"\n🤖 系统接词：'{system_chain_word}'（尾字母 '{system_chain_word[-1].lower()}'）"
            else:
                # 系统接不上 → 用户胜利，游戏结束
                feedback += "\n🎉 系统接不上！你赢了本回合！"
                # 仍继续游戏，但下一题从新词重新开始
                session.chain_current_word = ""
                session.chain_turn = "user"
        elif session.game_id == "word-chain" and not is_correct:
            # 用户接错：保留当前链状态，下题重试同一词
            # 不清空 chain_current_word，让用户继续接同一个词
            pass

        # 检查游戏是否结束
        is_game_over = session.current_index >= len(session.words)

        if is_game_over:
            session.is_active = False

        # 更新 DB 中的会话状态
        await self._update_session(session)

        # 如果游戏结束，写入最终成绩
        if is_game_over:
            await self._finalize_session(session)

        # 获取下一题
        next_question = None
        if not is_game_over:
            if session.game_id == "word-chain":
                # word-chain 交替回合制下一题生成
                # session.chain_current_word 已在上方更新为系统接的词
                # session.chain_turn 已设为 "system"
                next_word = session.words[session.current_index] if session.current_index < len(session.words) else session.words[-1]
                next_question = self._generate_spelling_question(
                    session=session,
                    word=next_word,
                    index=session.current_index,
                )
            else:
                # 其他游戏：原有逻辑
                # P1-2/P1-3 判断下一题是否为数学题：
                # 跨科游戏的混合题库里，只有 word_id 在数学题库里的才是数学题
                next_word = session.words[session.current_index]
                math_next: List[Dict] = []
                if is_math:
                    # MATH 或 CROSS_SUBJECT：尝试反查数学题库
                    math_q = await self._get_math_question_by_id(next_word.word_id)
                    if math_q:
                        math_next = [math_q]
                # 若 math_next 为空（词汇题或跨科中的词汇题），_generate_question 自动走词汇分支
                next_question = await self._generate_question(
                    session=session,
                    index=session.current_index,
                    math_questions=math_next,
                )

        # 计算进度
        progress = session.current_index / len(session.words)

        return SubmitAnswerResponse(
            session_id=session.session_id,
            result=result,
            next_question=next_question,
            current_score=session.score,
            progress=progress,
            is_game_over=is_game_over
        )

    async def get_game_summary(
        self,
        session_id: str,
        auth: Optional[dict] = None,
    ) -> GameSummary:
        """获取游戏总结

        6.2④：按 session.answered 真实记录分类正确/错误词，不再用"前 N 个正确"假设。
        6.1②：JWT 用户只能查自己的 session。
        6.2⑥：排名按真实 game_id 查询。
        """

        session = await self._restore_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # 6.1② 鉴权校验
        if auth and auth.get("auth_type") == "jwt":
            jwt_sub = str(auth.get("sub") or "")
            if jwt_sub and session.user_id != jwt_sub:
                raise ValueError(
                    f"Session {session_id} 不属于当前用户"
                )

        # 计算统计数据
        total_questions = len(session.words)
        accuracy = session.correct_count / total_questions if total_questions > 0 else 0

        # 计算总用时
        elapsed = datetime.now() - session.started_at
        total_time = int(elapsed.total_seconds())
        avg_time = total_time / total_questions if total_questions > 0 else 0

        # 6.2④ 按 answered 真实记录分类（修复"前 N 个正确"的假数据 bug）
        correct_words = []
        wrong_words = []
        if session.answered:
            # 有真实作答记录
            for rec in session.answered:
                if rec.is_correct:
                    correct_words.append(rec.word)
                else:
                    wrong_words.append(rec.word)
        else:
            # 兼容旧 session（无 answered 字段）：回退到原逻辑，但标记为估算
            for i, word in enumerate(session.words):
                if i < session.correct_count:
                    correct_words.append(word.word)
                else:
                    wrong_words.append(word.word)

        improvement_words = wrong_words[:5]

        # 6.2⑥ 计算排名（按真实 game_id 查询）
        rank = await self._get_user_rank(
            session.user_id, session.game_type, session.game_id
        )

        # 确定徽章
        badge = self._award_badge(session, accuracy)

        return GameSummary(
            session_id=session_id,
            user_id=session.user_id,
            game_type=session.game_type,
            game_id=session.game_id,
            subject=session.subject,
            total_score=session.score,
            max_score=total_questions * 18,
            accuracy=round(accuracy, 3),
            total_time_seconds=total_time,
            average_time_per_question=round(avg_time, 2),
            correct_words=correct_words,
            wrong_words=wrong_words,
            improvement_words=improvement_words,
            rank=rank,
            badge=badge,
            completed_at=datetime.now()
        )

    async def get_leaderboard(
        self,
        request: LeaderboardRequest,
        auth: Optional[dict] = None,
    ) -> LeaderboardResponse:
        """获取排行榜（从 DB 聚合查询）

        6.2⑥：优先按 game_id 分榜，无 game_id 时回退到 game_type。
        """

        entries = await self._query_leaderboard(
            game_type=request.game_type,
            game_id=request.game_id,
            limit=request.limit
        )

        return LeaderboardResponse(
            entries=entries,
            total_players=len(entries),
            generated_at=datetime.now()
        )

    # ──────────────────────────────────────────────
    #  DB 持久化（G03）
    # ──────────────────────────────────────────────

    async def _persist_session(self, session: WordGameSession) -> None:
        """将新会话写入 word_game_sessions 表。

        6.2⑤/⑥：新增 game_id/subject/answered 列（迁移 004）。
        6.1②：user_id 直接用 JWT 解析后的真实值，不再兜底为 0。
        """
        try:
            from app.db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO word_game_sessions
                        (session_id, user_id, game_type, game_id, subject, difficulty,
                         words, current_index, score, correct_count, wrong_count,
                         time_limit_seconds, started_at, is_active, answered)
                    VALUES
                        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    ON CONFLICT (session_id) DO UPDATE SET
                        words = EXCLUDED.words,
                        current_index = EXCLUDED.current_index,
                        score = EXCLUDED.score,
                        is_active = EXCLUDED.is_active,
                        answered = EXCLUDED.answered
                    """,
                    session.session_id,
                    session.user_id,
                    session.game_type.value,
                    session.game_id,
                    session.subject.value,
                    session.difficulty.value,
                    json.dumps(
                        [w.model_dump() for w in session.words],
                        ensure_ascii=False
                    ),
                    session.current_index,
                    session.score,
                    session.correct_count,
                    session.wrong_count,
                    session.time_limit_seconds,
                    session.started_at,
                    session.is_active,
                    json.dumps(
                        [a.model_dump() for a in session.answered],
                        ensure_ascii=False
                    ),
                )
        except Exception as e:
            logger.warning("Failed to persist session %s: %s", session.session_id, e)

    async def _restore_session(self, session_id: str) -> Optional[WordGameSession]:
        """从 DB 恢复会话状态（跨 worker 可恢复）。

        6.2⑤/⑥：读取 game_id/subject/answered 字段，兼容旧数据（字段缺失时用默认值）。
        """
        try:
            from app.db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT session_id, user_id, game_type, game_id, subject, difficulty,
                           words, current_index, score, correct_count, wrong_count,
                           time_limit_seconds, started_at, is_active, answered
                    FROM word_game_sessions
                    WHERE session_id = $1
                    """,
                    session_id,
                )
            if not row:
                logger.warning("Session %s not found in DB", session_id)
                return None

            words_data = row["words"]
            if isinstance(words_data, str):
                words_data = json.loads(words_data)

            words = [Word(**w) for w in words_data]

            # 6.2④ 兼容旧数据：answered 字段可能为空
            answered_data = row["answered"] if "answered" in row.keys() else None
            if isinstance(answered_data, str):
                answered_data = json.loads(answered_data)
            answered = [AnswerRecord(**a) for a in (answered_data or [])]

            # 6.2⑤/⑥ 兼容旧数据：game_id/subject 字段可能缺失
            game_id = row["game_id"] if "game_id" in row.keys() else ""
            subject_val = row["subject"] if "subject" in row.keys() else "vocabulary"
            try:
                subject = SubjectType(subject_val)
            except ValueError:
                subject = SubjectType.VOCABULARY

            return WordGameSession(
                session_id=row["session_id"],
                user_id=row["user_id"],
                game_type=GameType(row["game_type"]),
                game_id=game_id,
                subject=subject,
                difficulty=GameDifficulty(row["difficulty"]),
                words=words,
                current_index=row["current_index"],
                score=row["score"],
                correct_count=row["correct_count"],
                wrong_count=row["wrong_count"],
                time_limit_seconds=row["time_limit_seconds"],
                started_at=row["started_at"],
                is_active=row["is_active"],
                answered=answered,
            )
        except Exception as e:
            logger.error("Failed to restore session %s: %s", session_id, e)
            return None

    async def _update_session(self, session: WordGameSession) -> None:
        """更新 DB 中的会话状态（含 answered 记录，6.2④）。"""
        try:
            from app.db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE word_game_sessions SET
                        current_index = $2,
                        score = $3,
                        correct_count = $4,
                        wrong_count = $5,
                        is_active = $6,
                        answered = $7,
                        updated_at = NOW()
                    WHERE session_id = $1
                    """,
                    session.session_id,
                    session.current_index,
                    session.score,
                    session.correct_count,
                    session.wrong_count,
                    session.is_active,
                    json.dumps(
                        [a.model_dump() for a in session.answered],
                        ensure_ascii=False
                    ),
                )
        except Exception as e:
            logger.warning("Failed to update session %s: %s", session.session_id, e)

    async def _finalize_session(self, session: WordGameSession) -> None:
        """游戏结束：写入 game_sessions 最终成绩 + 更新 user_game_profile。

        6.1②：删除 user_id=0 兜底——JWT 已保证 user_id 是真实数字，
              非数字时记录 warning 并跳过入库（不再写 user_id=0 触发外键违约）。
        6.2⑥：game_id 用 session.game_id（真实 25 款游戏标识），回退到 game_type。
        """
        try:
            from app.db import get_pool
            pool = await get_pool()

            # 6.1② user_id 必须是有效数字（JWT sub 通常是用户 id 的字符串形式）
            if not session.user_id or not session.user_id.lstrip("-").isdigit():
                logger.warning(
                    "Skip finalize session %s: user_id=%r 非数字，无法入库（外键约束）",
                    session.session_id, session.user_id,
                )
                return
            user_id_int = int(session.user_id)

            # 6.2⑥ game_id 优先用真实标识，回退到 game_type
            game_id_for_rank = session.game_id or session.game_type.value

            async with pool.acquire() as conn:
                # 写入 game_sessions 最终成绩
                total_questions = len(session.words)
                accuracy = (
                    session.correct_count / total_questions
                    if total_questions > 0 else 0.0
                )
                elapsed = datetime.now() - session.started_at
                duration = int(elapsed.total_seconds())

                # XP 和金币：每正确 1 题 10 XP + 5 金币
                xp_gained = session.correct_count * 10
                coins_gained = session.correct_count * 5

                await conn.execute(
                    """
                    INSERT INTO game_sessions
                        (user_id, game_id, score, xp_gained, coins_gained,
                         accuracy, duration, started_at, finished_at)
                    VALUES
                        ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    """,
                    user_id_int,
                    game_id_for_rank,
                    session.score,
                    xp_gained,
                    coins_gained,
                    accuracy,
                    duration,
                    session.started_at,
                )

                # 更新 user_game_profile（upsert）
                await conn.execute(
                    """
                    INSERT INTO user_game_profile
                        (user_id, level, total_xp, coins, streak_days, badges, rank)
                    VALUES
                        ($1, 1, $2, $3, 0, '[]'::jsonb, NULL)
                    ON CONFLICT (user_id) DO UPDATE SET
                        total_xp = user_game_profile.total_xp + EXCLUDED.total_xp,
                        coins = user_game_profile.coins + EXCLUDED.coins,
                        updated_at = NOW()
                    """,
                    user_id_int,
                    xp_gained,
                    coins_gained,
                )

                # 标记 word_game_sessions 为 inactive
                await conn.execute(
                    "UPDATE word_game_sessions SET is_active = false WHERE session_id = $1",
                    session.session_id,
                )

                logger.info(
                    "Finalized session %s: user_id=%d, game_id=%s, score=%d, xp=%d, coins=%d",
                    session.session_id, user_id_int, game_id_for_rank,
                    session.score, xp_gained, coins_gained,
                )
        except Exception as e:
            logger.error("Failed to finalize session %s: %s", session.session_id, e)

    async def _query_leaderboard(
        self,
        game_type: Optional[GameType] = None,
        game_id: Optional[str] = None,
        limit: int = 10,
    ) -> List[LeaderboardEntry]:
        """从 game_sessions 表聚合查询排行榜。

        6.2⑥：优先按 game_id 分榜（25 款游戏独立榜），无 game_id 时回退到 game_type。
        """
        try:
            from app.db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                # 6.2⑥ game_id 优先
                filter_value = game_id or (game_type.value if game_type else None)
                if filter_value:
                    rows = await conn.fetch(
                        """
                        SELECT user_id, MAX(score) as best_score, MAX(finished_at) as achieved_at
                        FROM game_sessions
                        WHERE game_id = $1
                        GROUP BY user_id
                        ORDER BY best_score DESC
                        LIMIT $2
                        """,
                        filter_value,
                        limit,
                    )
                else:
                    rows = await conn.fetch(
                        """
                        SELECT user_id, MAX(score) as best_score, MAX(finished_at) as achieved_at
                        FROM game_sessions
                        GROUP BY user_id
                        ORDER BY best_score DESC
                        LIMIT $1
                        """,
                        limit,
                    )

            entries = []
            for i, r in enumerate(rows):
                entries.append(LeaderboardEntry(
                    rank=i + 1,
                    user_id=str(r["user_id"]),
                    username=f"用户{str(r['user_id'])[:6]}",
                    score=r["best_score"] or 0,
                    game_type=game_type,
                    game_id=game_id or "",
                    achieved_at=r["achieved_at"] or datetime.now(),
                ))
            return entries
        except Exception as e:
            logger.error("Failed to query leaderboard: %s", e)
            return []

    async def _get_user_rank(
        self,
        user_id: str,
        game_type: GameType,
        game_id: str = "",
    ) -> Optional[int]:
        """获取用户在排行榜中的排名。

        6.2⑥：优先按 game_id 查排名。
        6.1②：user_id 非数字时返回 None（不再用 0 兜底触发外键问题）。
        """
        try:
            if not user_id or not user_id.lstrip("-").isdigit():
                return None
            user_id_int = int(user_id)

            from app.db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                # 6.2⑥ game_id 优先
                filter_value = game_id or game_type.value
                row = await conn.fetchrow(
                    """
                    SELECT rank FROM (
                        SELECT user_id, MAX(score) as best_score,
                               RANK() OVER (ORDER BY MAX(score) DESC) as rank
                        FROM game_sessions
                        WHERE game_id = $1
                        GROUP BY user_id
                    ) ranked
                    WHERE user_id = $2
                    """,
                    filter_value,
                    user_id_int,
                )
                return row["rank"] if row else None
        except Exception as e:
            logger.warning("Failed to get user rank: %s", e)
            return None

    # ──────────────────────────────────────────────
    #  词汇联动（与 api 服务的 /vocab 接口对接）
    # ──────────────────────────────────────────────

    async def _fetch_today_vocab_words(self, auth_token: Optional[str]) -> List[Dict]:
        """从 api 服务获取今日学过/复习过的词汇列表。

        返回原始 dict 列表（含 word_id/headword/meaning/phonetic/tags 等），
        供 _select_words_with_today 转换为 Word 对象并优先使用。
        失败时返回空列表（非关键路径，游戏继续从词库取词）。
        """
        if not auth_token:
            return []
        try:
            import httpx
            api_url = settings.API_BASE_URL.rstrip("/")
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(
                    f"{api_url}/api/v1/vocab/learned-today",
                    params={"limit": 50},
                    headers={"Authorization": auth_token},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    words = data.get("words", [])
                    logger.info("Fetched %d today-learned words from api", len(words))
                    return words
        except Exception as e:
            logger.debug("Failed to fetch today vocab words: %s", e)
        return []

    async def _submit_word_event(
        self,
        auth_token: Optional[str],
        word_id: str,
        event_type: str,
        game_id: str = "",
        duration_ms: int = 0,
    ) -> None:
        """向 api 服务提交单词学习事件，同步词汇进度。

        - correct/wrong 事件推进 SRS 算法
        - 扩展词（不在用户进度中的词）会自动创建新记录，进入下次词汇学习
        """
        if not auth_token or not word_id:
            return
        import httpx
        api_url = settings.API_BASE_URL.rstrip("/")
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{api_url}/api/v1/vocab/events",
                json={
                    "word_id": word_id,
                    "event_type": event_type,
                    "game_id": game_id or None,
                    "duration_ms": duration_ms or None,
                },
                headers={"Authorization": auth_token},
            )

    async def _select_words_with_today(
        self,
        count: int,
        difficulty: GameDifficulty,
        categories: Optional[List[str]],
        exclude_words: List[str],
        today_words: List[Dict],
    ) -> List[Word]:
        """选词：优先使用今日学过的词汇，不足时从词库扩展。

        - today_words: 从 api /vocab/learned-today 获取的今日词汇 dict 列表
        - 扩展词（来自词库但不在今日学习列表中的）会自动通过 submit_answer 的
          _submit_word_event 提交 "correct"/"wrong" 事件，进入下次词汇学习
        """
        selected: List[Word] = []
        used_words: set = set()

        # 1. 优先从今日学过的词汇中选
        for w in today_words:
            if len(selected) >= count:
                break
            headword = w.get("headword", "")
            meaning = w.get("meaning", "")
            if not headword or not meaning or headword in exclude_words:
                continue
            if headword in used_words:
                continue
            freq = int(w.get("frequency", 3) or 3)
            examples = w.get("examples", [])
            example_en = ""
            if examples and isinstance(examples, list):
                first = examples[0]
                if isinstance(first, dict):
                    example_en = first.get("en", "")
                elif isinstance(first, str):
                    example_en = first
            word_obj = Word(
                word_id=w.get("word_id", ""),
                word=headword,
                meaning=meaning,
                pronunciation=w.get("phonetic", ""),
                example_sentence=example_en,
                part_of_speech=None,
                difficulty=min(max(freq / 5.0, 0.1), 1.0),
                category=(w.get("tags", [None])[0] if w.get("tags") else None),
            )
            selected.append(word_obj)
            used_words.add(headword)

        logger.info(
            "Word selection: %d from today's learned, %d needed from bank",
            len(selected), max(0, count - len(selected)),
        )

        # 2. 不足部分从词库扩展
        if len(selected) < count:
            remaining = count - len(selected)
            # 排除已选的词
            bank_exclude = list(exclude_words) + list(used_words)
            bank_words = await self._select_words(
                count=remaining,
                difficulty=difficulty,
                categories=categories,
                exclude_words=bank_exclude,
            )
            selected.extend(bank_words)

        return selected[:count]

    # ──────────────────────────────────────────────
    #  选题与题目生成
    # ──────────────────────────────────────────────

    async def _select_words(
        self,
        count: int,
        difficulty: GameDifficulty,
        categories: Optional[List[str]],
        exclude_words: List[str]
    ) -> List[Word]:
        """从词库随机选择单词"""

        bank = await self._load_word_bank()

        # 获取对应难度的单词
        word_pool = list(bank.get(difficulty, bank[GameDifficulty.MEDIUM]))

        # 过滤排除的单词 + 过滤 word/meaning 为空的无效词条
        # （避免 tap_match 等题型出现空白选项）
        word_pool = [
            w for w in word_pool
            if w.word not in exclude_words and w.word and w.meaning
        ]

        # 按类别过滤
        if categories:
            word_pool = [w for w in word_pool if w.category in categories]

        # 如果单词不够，从其他难度补充
        if len(word_pool) < count:
            for diff in [GameDifficulty.EASY, GameDifficulty.MEDIUM, GameDifficulty.HARD]:
                if diff != difficulty:
                    additional = [
                        w for w in bank.get(diff, [])
                        if w.word not in exclude_words and w not in word_pool
                        and w.word and w.meaning
                    ]
                    word_pool.extend(additional)

        # 随机选择
        if not word_pool:
            # 最终回退（同样过滤无效词条）
            word_pool = [
                w for w in self._all_words[:count]
                if w.word and w.meaning
            ] if self._all_words else []

        selected = random.sample(
            word_pool, min(count, len(word_pool))
        )

        # 如果还是不够，重复选择
        while len(selected) < count and word_pool:
            selected.extend(
                random.sample(word_pool, min(count - len(selected), len(word_pool)))
            )

        return selected[:count]

    def _calculate_time_limit(
        self,
        game_type: GameType,
        word_count: int
    ) -> int:
        """计算时间限制"""
        base_time = {
            GameType.WORD_MATCH: 30,
            GameType.SPELLING: 60,
            GameType.WORD_CHAIN: 45,
            GameType.FILL_BLANK: 40,
            GameType.MULTIPLE_CHOICE: 20,
            GameType.LISTEN_WRITE: 60,
            GameType.WORD_SEARCH: 120,
            GameType.CROSSWORD: 180,
            # 扩展题型时间限制
            GameType.TAP_MATCH: 45,        # 点击配对消除
            GameType.LISTEN_SELECT: 30,    # 听音选词
            GameType.DRAG_SORT: 60,        # 拖拽排序
            GameType.WORD_BANK: 40,        # 词库填空
        }

        base = base_time.get(game_type, 30)
        return base * word_count // 10

    async def _generate_question(
        self,
        session: WordGameSession,
        index: int,
        math_questions: Optional[List[Dict]] = None,
    ) -> WordGameQuestion:
        """生成问题

        6.1①：数学/跨科游戏用 math_questions 出题，词汇游戏用 word 出题。
        P1-3：跨科游戏的词汇题（不在 math_questions 里的）自动走词汇分支。
        6.2⑤/P1-4：按 session.game_id 差异化出题文案。
        """
        word = session.words[index]

        # P1-3 数学题分支：仅当传入了 math_questions 且当前题在题库里时走数学分支
        # 跨科游戏的词汇题 math_questions 为空，自动走词汇分支
        if math_questions:
            # 找到当前 word 对应的数学题（按 word_id 匹配，跨科混合时 index 可能不对应）
            for mq in math_questions:
                if mq.get("id") == word.word_id:
                    return self._generate_math_question(
                        session=session, math_q=mq, index=index, word=word
                    )

        # 词汇题分支（P1-4：按 game_id 差异化文案，题型仍基于 game_type）
        return self._generate_vocab_question(session, word, index)

    def _generate_vocab_question(
        self,
        session: WordGameSession,
        word: Word,
        index: int,
    ) -> WordGameQuestion:
        """生成词汇题（P1-4 + 7 题型扩展）

        按 session.game_id 路由到 7 种题型生成方法：
        1. MULTIPLE_CHOICE 选择题（9 款）
        2. TAP_MATCH 点击配对消除（4 款）
        3. LISTEN_SELECT 听音选词（1 款）
        4. SPELLING 拼写输入（3 款）
        5. DRAG_SORT 拖拽排序（2 款）
        6. WORD_BANK 词库填空（4 款）
        7. FILL_BLANK 填空输入（2 款）
        未匹配的 game_id 回退到原有 3 种题型兜底逻辑。
        """
        game_id = session.game_id

        # 1. MULTIPLE_CHOICE 选择题
        if game_id in (
            "vocabulary-duel", "high-frequency-challenge", "wrong-question-boss",
            "daily-quiz-arena", "knowledge-combo-streak", "memory-maze",
            "study-team-raid", "problem-quest-map",
        ):
            return self._generate_multiple_choice_question(session, word, index)

        # 2. TAP_MATCH 点击配对消除
        if game_id in (
            "word-match-blast", "synonym-antonym-match",
            "picture-word-match", "memory-flip-match", "formula-link",
        ):
            return self._generate_tap_match_question(session, word, index)

        # 3. LISTEN_SELECT 听音选词
        if game_id == "listening-dash":
            return self._generate_listen_select_question(session, word, index)

        # 4. SPELLING 拼写输入
        if game_id in ("spelling-bee", "word-bubble-pop", "word-chain"):
            return self._generate_spelling_question(session, word, index)

        # 5. DRAG_SORT 拖拽排序
        if game_id in ("sentence-untangle", "root-affix-tree", "proof-step-sort"):
            return self._generate_drag_sort_question(session, word, index)

        # 6. WORD_BANK 词库填空
        if game_id in (
            "cloze-sprint", "word-form-master",
            "crossword-quest", "flashcard-rush",
        ):
            return self._generate_word_bank_question(session, word, index)

        # 7. FILL_BLANK 填空输入
        if game_id in ("limit-blitz",):
            return self._generate_fill_blank_question(session, word, index)

        # 兜底：默认按 game_type 出题（保持向后兼容）
        if session.game_type == GameType.MULTIPLE_CHOICE:
            return self._generate_multiple_choice_question(session, word, index)
        elif session.game_type == GameType.SPELLING:
            return self._generate_spelling_question(session, word, index)
        else:
            return self._generate_fill_blank_question(session, word, index)

    def _generate_multiple_choice_question(
        self,
        session: WordGameSession,
        word: Word,
        index: int,
    ) -> WordGameQuestion:
        """生成选择题（MULTIPLE_CHOICE）：词义消消乐/词汇PK/记忆翻牌等"""
        options = self._generate_options_sync(word, session.words)
        game_id = session.game_id
        # 按 game_id 微调问法
        if game_id == "picture-word-match":
            question_text = f"看图选词：哪个单词匹配该图片？"
        elif game_id == "memory-flip-match":
            question_text = f"记忆翻牌：请匹配 '{word.word}' 的释义"
        elif game_id == "word-match-blast":
            question_text = f"词义消消乐：'{word.word}' 的含义是？"
        else:
            question_text = f"'{word.word}' 的正确释义是？"
        return WordGameQuestion(
            question_id=f"q_{index}",
            word=word,
            question_type=GameType.MULTIPLE_CHOICE,
            question_text=question_text,
            options=options,
            correct_answer=word.meaning,
            hint=f"首字母是 {word.word[0] if word.word else '?'}",
            points=10
        )

    def _generate_spelling_question(
        self,
        session: WordGameSession,
        word: Word,
        index: int,
    ) -> WordGameQuestion:
        """生成拼写题（SPELLING）：拼写蜂/字母泡泡/单词接龙

        word-chain 交替回合制：
        - 系统先出题（session.chain_current_word 为空时用预设词首发）
        - 用户接词后，系统接用户的词（在 submit_answer 中生成）
        - 系统接完再让用户接，循环交替
        """
        game_id = session.game_id
        if game_id == "word-chain":
            # 交替回合制：使用 session.chain_current_word 作为当前链尾词
            if session.chain_current_word:
                current_word = session.chain_current_word
            else:
                # 首次：系统用预设词首发
                current_word = word.word
                session.chain_current_word = current_word
                if current_word and current_word.lower() not in [w.lower() for w in session.chain_used_words]:
                    session.chain_used_words.append(current_word)

            last_char = current_word[-1].lower() if current_word else "a"
            turn = session.chain_turn
            if turn == "system":
                # 系统刚接完词（在 submit_answer 中生成），现在轮到用户
                sys_word = session.chain_current_word
                sys_last = sys_word[-1].lower() if sys_word else "a"
                question_text = (
                    f"✅ 系统接词：'{sys_word}'\n"
                    f"👉 请输入以 '{sys_last}' 开头的英文单词继续接龙"
                )
                expected = sys_last
            else:
                # 系统首发或用户刚接完词后系统未动（正常应已在 submit_answer 处理）
                question_text = (
                    f"🔢 系统出词：'{current_word}'\n"
                    f"👉 请输入以 '{last_char}' 开头的英文单词接龙"
                )
                expected = last_char

            return WordGameQuestion(
                question_id=f"q_{index}",
                word=word,
                question_type=GameType.SPELLING,
                question_text=question_text,
                options=None,
                correct_answer=expected,
                hint=f"以 '{expected}' 开头的单词（已用 {len(session.chain_used_words)} 词）",
                points=10
            )
        elif game_id == "word-bubble-pop":
            question_text = f"字母泡泡拼词：请拼出含义为 '{word.meaning}' 的单词"
        else:
            question_text = f"听音拼写：请拼写含义为 '{word.meaning}' 的单词"
        return WordGameQuestion(
            question_id=f"q_{index}",
            word=word,
            question_type=GameType.SPELLING,
            question_text=question_text,
            options=None,
            correct_answer=word.word,
            hint=f"有 {len(word.word)} 个字母",
            points=10
        )

    def _generate_fill_blank_question(
        self,
        session: WordGameSession,
        word: Word,
        index: int,
    ) -> WordGameQuestion:
        """生成填空题（FILL_BLANK）：极限冲刺/证明步骤排序"""
        game_id = session.game_id
        if game_id == "limit-blitz":
            sentence = f"极限冲刺：请在句中填入正确单词（释义：{word.meaning}）"
        elif game_id == "proof-step-sort":
            sentence = f"证明填空：请填写关键步骤（释义：{word.meaning}）"
        else:
            sentence = f"请输入 '{word.meaning}' 的英文"
        return WordGameQuestion(
            question_id=f"q_{index}",
            word=word,
            question_type=GameType.FILL_BLANK,
            question_text=sentence,
            options=None,
            correct_answer=word.word,
            hint=f"首字母是 {word.word[0] if word.word else '?'}",
            points=10
        )

    def _generate_tap_match_question(
        self,
        session: WordGameSession,
        word: Word,
        index: int,
    ) -> WordGameQuestion:
        """生成点击配对消除题（TAP_MATCH）：4 对 (word, meaning) 卡片

        - pairs 字段填充 4 对左右列卡片，打乱顺序
        - correct_answer 是当前目标单词的释义（用于判分）
        - 前端点击两张卡片完成配对消除
        """
        all_words = session.words if session.words else self._all_words
        # 当前目标词 + 3 个干扰词
        pairs = [{"left": word.word, "right": word.meaning}]
        others = [
            w for w in all_words
            if w.word_id != word.word_id and w.word and w.meaning
        ]
        # 从全量词库补充干扰词（session.words 可能不足或部分 word/meaning 为空）
        if len(others) < 3 and self._all_words:
            existing_ids = {o.word_id for o in others}
            existing_ids.add(word.word_id)
            fallback = [
                w for w in self._all_words
                if w.word_id not in existing_ids and w.word and w.meaning
            ]
            others.extend(fallback)
        others = random.sample(others, min(3, len(others)))
        for w in others:
            pairs.append({"left": w.word, "right": w.meaning})

        # 返回正确配对的 pairs（left↔right 对应关系正确）
        # 前端 QuestionCard 的 TapMatchGame 会独立 shuffle 左右两列的显示顺序，
        # 用 pairId（pairs 数组索引）判断配对是否正确。
        # 注意：后端不能独立打乱 left/right 再 zip，那样会破坏正确配对关系。

        return WordGameQuestion(
            question_id=f"q_{index}",
            word=word,
            question_type=GameType.TAP_MATCH,
            question_text="点击配对：将单词与正确的释义配对",
            pairs=pairs,
            correct_answer=word.meaning,  # 当前题的正确配对（释义）
            hint=f"当前目标：{word.word}",
            points=10
        )

    def _generate_listen_select_question(
        self,
        session: WordGameSession,
        word: Word,
        index: int,
    ) -> WordGameQuestion:
        """生成听音选词题（LISTEN_SELECT）：TTS 播放发音 + 4 选项选释义

        - 复用 MULTIPLE_CHOICE 的选项生成逻辑
        - question_text 提示用户点击播放按钮听发音
        - question_type 设为 LISTEN_SELECT，前端用 Web Speech API 播放 word
        """
        options = self._generate_options_sync(word, session.words)
        return WordGameQuestion(
            question_id=f"q_{index}",
            word=word,
            question_type=GameType.LISTEN_SELECT,
            question_text="点击播放按钮听发音，然后选择正确的释义",
            options=options,
            correct_answer=word.meaning,
            hint=f"首字母是 {word.word[0] if word.word else '?'}",
            points=10
        )

    def _generate_drag_sort_question(
        self,
        session: WordGameSession,
        word: Word,
        index: int,
    ) -> WordGameQuestion:
        """生成拖拽排序题（DRAG_SORT）：把打乱的单词排成正确顺序

        - sort_items 字段填充打乱的单词列表
        - correct_answer 是正确顺序的句子（空格连接）
        - 前端把 sort_items 渲染为可拖拽卡片
        """
        game_id = session.game_id
        # 用 word 造一个简单句子（简化示例，优先用例句）
        example = (word.example_sentence or "").strip()
        if example:
            # 用真实例句，去除多余标点便于排序
            sentence = example.rstrip(".!?。！？")
        elif game_id == "root-affix-tree":
            # 词根衍生顺序：前缀 + 词根 + 后缀
            sentence = f"re {word.word} tion"
        else:
            # sentence-untangle：用语法通顺的通用造句（适配任意词性）
            sentence = f"I think the word is {word.word} here"

        words = sentence.split()
        correct_order = words.copy()
        # 打乱顺序（保证至少有一处位置变化）
        if len(words) > 1:
            random.shuffle(words)
            # 若打乱后仍与原序相同，交换前两项
            if words == correct_order:
                words[0], words[1] = words[1], words[0]

        return WordGameQuestion(
            question_id=f"q_{index}",
            word=word,
            question_type=GameType.DRAG_SORT,
            question_text=f"拖拽排序：把单词排成正确的句子顺序（释义：{word.meaning}）",
            sort_items=words,
            correct_answer=" ".join(correct_order),
            hint=f"首词是 {correct_order[0]}",
            points=10
        )

    def _generate_word_bank_question(
        self,
        session: WordGameSession,
        word: Word,
        index: int,
    ) -> WordGameQuestion:
        """生成词库填空题（WORD_BANK）：从词库点选词填入空格

        - word_bank 字段填充候选词列表（正确答案 + 3 个干扰词）
        - correct_answer 是正确答案（单词本身）
        - 前端把 word_bank 渲染为可点击的词库按钮
        """
        all_words = session.words if session.words else self._all_words
        # 填空句子（简化示例）
        sentence = f"The ______ means '{word.meaning}'."
        # 词库：正确答案 + 3 个干扰词
        others = [
            w.word for w in all_words
            if w.word_id != word.word_id and w.word
        ]
        others = random.sample(others, min(3, len(others)))
        bank = [word.word] + others
        random.shuffle(bank)

        return WordGameQuestion(
            question_id=f"q_{index}",
            word=word,
            question_type=GameType.WORD_BANK,
            question_text=sentence,
            word_bank=bank,
            correct_answer=word.word,
            hint=f"首字母是 {word.word[0] if word.word else '?'}",
            points=10
        )

    def _generate_options_sync(
        self,
        correct_word: Word,
        all_words: List[Word],
    ) -> List[str]:
        """同步生成选择题选项（P1-4：词汇题选项用释义而非单词，匹配问法）。"""
        options = [correct_word.meaning]
        other_meanings = [w.meaning for w in all_words if w.word_id != correct_word.word_id]
        if len(other_meanings) < 3:
            pool = [w.meaning for w in self._all_words
                    if w.word != correct_word.word
                    and w.meaning not in other_meanings
                    and w.meaning != correct_word.meaning]
            random.shuffle(pool)
            other_meanings.extend(pool[:3 - len(other_meanings)])
        if len(other_meanings) >= 3:
            options.extend(random.sample(other_meanings, 3))
        else:
            options.extend(other_meanings)
        random.shuffle(options)
        return options[:4]

    def _generate_math_question(
        self,
        session: WordGameSession,
        math_q: Dict,
        index: int,
        word: Word,
    ) -> WordGameQuestion:
        """生成数学题（6.1① / P1-2）

        math-full.json 的字段：id/type/difficulty/chapter/content/answer/solution/hints/tags
        P1-2：优先用选择题（MULTIPLE_CHOICE）出题，因为数学填空题的字符串归一化比较
              极易误判（分数/根号/LaTeX 等格式差异）；选择题用选项匹配更可靠。
        - 选择题：用 answer 作正确选项，从同 chapter 题目取干扰项
        - 填空题：仅在显式要求非选择题时使用
        - 配对消除（TAP_MATCH）：formula-link 公式连连看，题目内容↔答案配对
        - 拖拽排序（DRAG_SORT）：proof-step-sort 证明步骤排序，solution 按行分割打乱
        """
        q_id = math_q.get("id", f"q_{index}")
        content = math_q.get("content", "")
        answer = math_q.get("answer", "")
        hints = math_q.get("hints", [])
        hint = hints[0] if hints else "请仔细审题"
        solution = math_q.get("solution", "")

        # formula-link: TAP_MATCH 公式连连看 — 题目内容↔答案配对
        if session.game_type == GameType.TAP_MATCH:
            # 当前题的正确配对：content 摘要 ↔ answer
            content_short = content[:60] if content else answer
            pairs = [{"left": content_short, "right": answer}]
            # 从同 chapter 取 3 个干扰配对
            same_chapter = [
                q for q in self._all_math
                if q.get("chapter") == math_q.get("chapter")
                and q.get("id") != q_id
                and q.get("answer", "") and q.get("content", "")
            ]
            random.shuffle(same_chapter)
            for q in same_chapter[:3]:
                pairs.append({
                    "left": q.get("content", "")[:60],
                    "right": q.get("answer", ""),
                })
            # 干扰项不足时用占位
            while len(pairs) < 4:
                pairs.append({"left": f"题目{len(pairs)+1}", "right": f"答案{len(pairs)+1}"})

            return WordGameQuestion(
                question_id=q_id,
                word=word,
                question_type=GameType.TAP_MATCH,
                question_text="点击配对：将题目与正确答案配对",
                pairs=pairs,
                correct_answer=answer,
                hint=hint,
                points=10
            )

        # proof-step-sort: DRAG_SORT 证明步骤排序 — solution 按行分割打乱
        if session.game_type == GameType.DRAG_SORT:
            # 把 solution 按行/句号分割成步骤
            if solution:
                # 按换行或句号分割
                steps = [s.strip() for s in solution.replace('。', '\n').replace('.', '\n').split('\n') if s.strip()]
            else:
                # 无 solution 时用 content 按词分割
                steps = content.split() if content else [answer, "无步骤"]
            # 至少 2 步才能排序
            if len(steps) < 2:
                steps = [f"步骤1: {content[:30]}", f"步骤2: 求解得 {answer}"]

            correct_order = steps.copy()
            shuffled = steps.copy()
            random.shuffle(shuffled)
            if shuffled == correct_order and len(shuffled) > 1:
                shuffled[0], shuffled[1] = shuffled[1], shuffled[0]

            return WordGameQuestion(
                question_id=q_id,
                word=word,
                question_type=GameType.DRAG_SORT,
                question_text=f"拖拽排序：把证明步骤排成正确顺序（题目：{content[:50]}）",
                sort_items=shuffled,
                correct_answer=" | ".join(correct_order),
                hint=f"首步是 {correct_order[0][:30]}",
                points=10
            )

        # P1-2 数学题优先选择题（判分可靠）
        # 若 session.game_type 是 MULTIPLE_CHOICE 或未指定（默认），都用选择题
        use_choice = session.game_type in (
            GameType.MULTIPLE_CHOICE, GameType.WORD_MATCH, GameType.WORD_CHAIN,
            GameType.LISTEN_WRITE, GameType.WORD_SEARCH, GameType.CROSSWORD,
        )
        if use_choice:
            # 选择题：从同 chapter 题目取 3 个干扰答案
            options = [answer]
            same_chapter = [
                q for q in self._all_math
                if q.get("chapter") == math_q.get("chapter")
                and q.get("id") != q_id
                and q.get("answer", "") not in options
                and q.get("answer", "")  # 排除空答案
            ]
            random.shuffle(same_chapter)
            for q in same_chapter[:3]:
                options.append(q.get("answer", ""))
            # 若干扰项不足 3 个，用占位（避免选项数量异常）
            while len(options) < 4:
                options.append(f"选项{len(options)+1}")
            random.shuffle(options)

            return WordGameQuestion(
                question_id=q_id,
                word=word,
                question_type=GameType.MULTIPLE_CHOICE,
                question_text=content,
                options=options[:4],
                correct_answer=answer,
                hint=hint,
                points=10
            )
        else:
            # 填空题（仅 FILL_BLANK / SPELLING 时使用）
            return WordGameQuestion(
                question_id=q_id,
                word=word,
                question_type=GameType.FILL_BLANK,
                question_text=content,
                options=None,
                correct_answer=answer,
                hint=hint,
                points=10
            )

    async def _get_math_correct_answer(self, question_id: str) -> str:
        """从数学题库按 word_id 反查正确答案（6.1①）。

        P1-2 备注：此方法仅作回退用——主路径已把 answer 存到 Word.correct_answer，
        submit_answer 优先从 session 读取，避免 O(n) 线性扫描 5026 题。
        """
        await self._load_math_bank()
        for q in self._all_math:
            if q.get("id") == question_id:
                return q.get("answer", "")
        return ""

    def _math_questions_to_words(self, math_questions: List[Dict]) -> List[Word]:
        """把数学题转成 Word 占位列表（P1-2：answer 持久化到 Word.correct_answer）。

        math-full.json 的字段：id/type/difficulty/chapter/content/answer/solution/hints/tags
        - word_id ← id
        - word ← title（用于显示和 answered 记录）
        - meaning ← content（题目正文）
        - example_sentence ← solution（解题步骤，summary 时可展示）
        - correct_answer ← answer（P1-2：避免 submit_answer 线性反查题库）
        """
        return [
            Word(
                word_id=q.get("id", f"mq_{i}"),
                word=q.get("title", "数学题")[:50],
                meaning=q.get("content", "")[:200],
                pronunciation=None,
                example_sentence=q.get("solution"),
                part_of_speech=None,
                difficulty=min(max(int(q.get("difficulty", 2)) / 5.0, 0.1), 1.0),
                category=q.get("chapter"),
                correct_answer=q.get("answer", ""),
            )
            for i, q in enumerate(math_questions)
        ]

    async def _get_math_question_by_id(self, question_id: str) -> Optional[Dict]:
        """从数学题库按 id 反查完整题目数据（6.1①，submit_answer 生成下一题用）。"""
        await self._load_math_bank()
        for q in self._all_math:
            if q.get("id") == question_id:
                return q
        return None

    async def _generate_options(
        self,
        correct_word: Word,
        all_words: List[Word]
    ) -> List[str]:
        """生成选择题选项（干扰项从同难度词库取，非假选项）。"""
        options = [correct_word.word]

        # 从会话中的其他单词选取干扰项
        other_words = [w.word for w in all_words if w.word_id != correct_word.word_id]

        # 如果不够 3 个干扰项，从全量词库补充
        if len(other_words) < 3:
            pool = [w.word for w in self._all_words
                    if w.word != correct_word.word
                    and w.word not in other_words]
            random.shuffle(pool)
            other_words.extend(pool[:3 - len(other_words)])

        if len(other_words) >= 3:
            options.extend(random.sample(other_words, 3))
        else:
            options.extend(other_words)

        random.shuffle(options)
        return options[:4]  # 确保最多 4 个选项

    def _get_vocab_correct_answer(
        self,
        session: WordGameSession,
        word: Word,
    ) -> str:
        """根据 game_id 推导词汇题的正确答案

        与 _generate_vocab_question 的题型路由保持一致：
        - MULTIPLE_CHOICE / TAP_MATCH / LISTEN_SELECT：正确答案是 word.meaning
          （用户选择/配对的都是释义）
        - DRAG_SORT：正确答案是原句（用户把打乱的单词排成正确顺序）
        - SPELLING / FILL_BLANK / WORD_BANK：正确答案是 word.word
          （用户拼写/填入的是英文单词）
        """
        game_id = session.game_id

        # MULTIPLE_CHOICE 选择题：用户选释义，答案是 meaning
        if game_id in (
            "vocabulary-duel", "high-frequency-challenge", "wrong-question-boss",
            "daily-quiz-arena", "knowledge-combo-streak", "memory-maze",
            "study-team-raid", "problem-quest-map",
        ):
            return word.meaning

        # TAP_MATCH 点击配对消除：用户配对 word↔meaning，答案是 meaning
        if game_id in (
            "word-match-blast", "synonym-antonym-match",
            "picture-word-match", "memory-flip-match", "formula-link",
        ):
            return word.meaning

        # LISTEN_SELECT 听音选词：用户从选项中选释义，答案是 meaning
        if game_id == "listening-dash":
            return word.meaning

        # DRAG_SORT 拖拽排序：用户排成正确句子，答案是原句（空格连接）
        # 注意：与 _generate_drag_sort_question 的句子构造逻辑保持一致
        if game_id in ("sentence-untangle", "root-affix-tree", "proof-step-sort"):
            example = (word.example_sentence or "").strip()
            if example:
                return example.rstrip(".!?。！？")
            elif game_id == "root-affix-tree":
                return f"re {word.word} tion"
            else:
                return f"I think the word is {word.word} here"

        # SPELLING / FILL_BLANK / WORD_BANK：用户拼写/填入英文单词，答案是 word.word
        # word-chain 例外：正确答案是首字母（用户输入以该字母开头的任意单词）
        if game_id == "word-chain":
            return (word.correct_answer or word.word[-1] or "a").lower()[:1]
        return word.correct_answer or word.word

    def _check_answer(
        self,
        user_answer: str,
        correct_answer: str,
        game_type: GameType
    ) -> bool:
        """检查答案"""
        user_normalized = user_answer.strip().lower()
        correct_normalized = correct_answer.strip().lower()
        return user_normalized == correct_normalized

    def _check_word_chain_answer(
        self,
        user_answer: str,
        expected_letter: str,
        used_words: List[str] = None,
    ) -> bool:
        """单词接龙判分：用户输入的单词必须以指定字母开头，是有效英文单词，且未在本局使用过。

        判定规则：
        1. 用户答案必须以 expected_letter 开头（不区分大小写）
        2. 用户答案必须是有效英文单词（在词库中存在）
        3. 用户答案长度必须 >= 2（不能只输入单字母）
        4. 用户答案未在本局已使用过（避免重复）
        """
        user_word = user_answer.strip().lower()
        letter = expected_letter.strip().lower()[:1] if expected_letter else ""

        # 长度检查
        if len(user_word) < 2:
            return False

        # 首字母检查
        if not letter or not user_word.startswith(letter):
            return False

        # 重复词检查
        used_words = used_words or []
        if user_word in [w.lower() for w in used_words]:
            return False

        # 有效单词检查：在词库中查找
        for w in self._all_words:
            if w.word and w.word.lower() == user_word:
                return True

        # 如果词库为空（极端情况），放宽为仅首字母检查
        if not self._all_words:
            return True

        return False

    def _find_chain_word(
        self,
        start_letter: str,
        used_words: List[str],
    ) -> Optional[Word]:
        """从词库中找一个以指定字母开头且未使用过的单词（用于系统接龙）。"""
        used_lower = {w.lower() for w in used_words if w}
        candidates = [
            w for w in self._all_words
            if w.word
            and w.word[0].lower() == start_letter.lower()
            and w.word.lower() not in used_lower
        ]
        if not candidates:
            return None
        return random.choice(candidates)

    def _system_pick_chain_word(
        self,
        last_letter: str,
        used_words: List[str],
    ) -> str:
        """系统接龙：根据用户词尾字母，从词库挑一个有效词作为系统回应。

        返回空字符串表示系统接不上（用户胜本回合）。
        优先选择长度 ≥3 的常见词，避免太难。
        """
        if not last_letter:
            return ""
        word_obj = self._find_chain_word(last_letter, used_words)
        if word_obj and word_obj.word:
            return word_obj.word
        return ""

    def _generate_feedback(
        self,
        is_correct: bool,
        word: Word,
        user_answer: str,
        game_id: str = "",
    ) -> str:
        """生成反馈"""
        if is_correct:
            if game_id == "word-chain":
                user_last = user_answer[-1] if user_answer else "?"
                return f"✅ 正确！'{user_answer}' 是有效的单词接龙（尾字母 '{user_last}'），系统正在接龙..."
            feedbacks = [
                f"正确！{word.word} = {word.meaning}",
                f"太棒了！{word.word} 记得很牢！",
                f"很好！继续保持！",
            ]
            return random.choice(feedbacks)
        else:
            if game_id == "word-chain":
                # 反馈中提示期望的首字母
                return f"❌ 需要一个以期望字母开头的有效英文单词（至少2个字母，不能重复使用已用过的词）"
            return f"正确答案是 {word.word}，意思是 {word.meaning}"

    def _get_game_instructions(self, game_type: GameType) -> str:
        """获取游戏说明"""
        instructions = {
            GameType.WORD_MATCH: "将单词与正确的中文意思配对",
            GameType.SPELLING: "根据中文意思拼写英文单词",
            GameType.WORD_CHAIN: "用上一个单词的最后一个字母作为下一个单词的首字母",
            GameType.FILL_BLANK: "在句子中填入正确的单词",
            GameType.MULTIPLE_CHOICE: "选择正确的单词",
            GameType.LISTEN_WRITE: "听发音写出单词",
            GameType.WORD_SEARCH: "在字母网格中找出隐藏的单词",
            GameType.CROSSWORD: "完成填字游戏",
            # 扩展题型说明
            GameType.TAP_MATCH: "点击左右两列卡片完成单词-释义配对消除",
            GameType.LISTEN_SELECT: "点击播放按钮听发音，然后选择正确的释义",
            GameType.DRAG_SORT: "拖拽打乱的单词，排成正确的句子顺序",
            GameType.WORD_BANK: "从词库中点选正确的单词填入句子空格",
        }
        return instructions.get(game_type, "完成单词游戏")

    def _award_badge(
        self,
        session: WordGameSession,
        accuracy: float
    ) -> Optional[str]:
        """颁发徽章"""
        if accuracy >= 1.0:
            return "满分达人"
        elif accuracy >= 0.9:
            return "优秀学员"
        elif accuracy >= 0.8:
            return "学习之星"
        elif session.score >= 100:
            return "百分选手"
        else:
            return None
