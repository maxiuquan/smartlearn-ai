"""
单词游戏服务
趣味单词游戏逻辑

G02: 动态取词 — 从 data/vocabulary/*.json 或 DB vocabulary_words 表加载
G03: session/leaderboard 持久化到 DB（asyncpg）
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
    Word,
    LeaderboardRequest,
    LeaderboardResponse,
    LeaderboardEntry,
)

logger = logging.getLogger("ai_engine.word_games")

# 词汇 JSON 文件目录（相对于 ai-engine 工作目录）
_VOCAB_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "data", "vocabulary",
)

# difficulty → frequency 区间映射
_DIFFICULTY_FREQ_MAP: Dict[GameDifficulty, tuple] = {
    GameDifficulty.EASY: (4, 5),    # freq >= 4
    GameDifficulty.MEDIUM: (2, 3),  # freq 2-3
    GameDifficulty.HARD: (1, 1),    # freq 1
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
    #  游戏 API（G02 + G03）
    # ──────────────────────────────────────────────

    async def start_game(
        self,
        request: WordGameRequest
    ) -> WordGameResponse:
        """开始游戏"""

        # 加载词库并选择单词
        await self._load_word_bank()
        words = await self._select_words(
            count=request.word_count,
            difficulty=request.difficulty,
            categories=request.categories,
            exclude_words=request.exclude_words or []
        )

        # 确定时间限制
        time_limit = request.time_limit_seconds or self._calculate_time_limit(
            request.game_type,
            request.word_count
        )

        # 创建会话
        session = WordGameSession(
            session_id=f"session_{uuid.uuid4().hex[:8]}",
            user_id=request.user_id,
            game_type=request.game_type,
            difficulty=request.difficulty,
            words=words,
            current_index=0,
            score=0,
            correct_count=0,
            wrong_count=0,
            time_limit_seconds=time_limit,
            started_at=datetime.now(),
            is_active=True
        )

        # 持久化会话到 DB
        await self._persist_session(session)

        # 生成第一个问题
        first_question = await self._generate_question(
            session=session,
            index=0
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
        request: SubmitAnswerRequest
    ) -> SubmitAnswerResponse:
        """提交答案"""

        # 从 DB 恢复会话（跨 worker 可恢复）
        session = await self._restore_session(request.session_id)
        if not session:
            raise ValueError(f"Session {request.session_id} not found")

        answer = request.answer

        # 获取当前单词
        current_word = session.words[session.current_index]

        # 判断答案是否正确
        is_correct = self._check_answer(
            user_answer=answer.user_answer,
            correct_answer=current_word.word,
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

        # 生成反馈
        feedback = self._generate_feedback(
            is_correct=is_correct,
            word=current_word,
            user_answer=answer.user_answer
        )

        # 创建结果
        result = WordGameResult(
            question_id=answer.question_id,
            is_correct=is_correct,
            user_answer=answer.user_answer,
            correct_answer=current_word.word,
            points_earned=points_earned,
            time_spent_seconds=answer.time_spent_seconds,
            feedback=feedback
        )

        # 移动到下一个
        session.current_index += 1

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
            next_question = await self._generate_question(
                session=session,
                index=session.current_index
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
        session_id: str
    ) -> GameSummary:
        """获取游戏总结"""

        session = await self._restore_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # 计算统计数据
        total_questions = len(session.words)
        accuracy = session.correct_count / total_questions if total_questions > 0 else 0

        # 计算总用时
        elapsed = datetime.now() - session.started_at
        total_time = int(elapsed.total_seconds())
        avg_time = total_time / total_questions if total_questions > 0 else 0

        # 分类正确和错误的单词
        correct_words = []
        wrong_words = []
        for i, word in enumerate(session.words):
            if i < session.correct_count:
                correct_words.append(word.word)
            else:
                wrong_words.append(word.word)

        improvement_words = wrong_words[:5]

        # 计算排名（从 DB 查询）
        rank = await self._get_user_rank(session.user_id, session.game_type)

        # 确定徽章
        badge = self._award_badge(session, accuracy)

        return GameSummary(
            session_id=session_id,
            user_id=session.user_id,
            game_type=session.game_type,
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
        request: LeaderboardRequest
    ) -> LeaderboardResponse:
        """获取排行榜（从 DB 聚合查询）"""

        entries = await self._query_leaderboard(
            game_type=request.game_type,
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
        """将新会话写入 word_game_sessions 表。"""
        try:
            from app.db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO word_game_sessions
                        (session_id, user_id, game_type, difficulty, words,
                         current_index, score, correct_count, wrong_count,
                         time_limit_seconds, started_at, is_active)
                    VALUES
                        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (session_id) DO UPDATE SET
                        words = EXCLUDED.words,
                        current_index = EXCLUDED.current_index,
                        score = EXCLUDED.score,
                        is_active = EXCLUDED.is_active
                    """,
                    session.session_id,
                    session.user_id,
                    session.game_type.value,
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
                )
        except Exception as e:
            logger.warning("Failed to persist session %s: %s", session.session_id, e)

    async def _restore_session(self, session_id: str) -> Optional[WordGameSession]:
        """从 DB 恢复会话状态（跨 worker 可恢复）。"""
        try:
            from app.db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT session_id, user_id, game_type, difficulty, words,
                           current_index, score, correct_count, wrong_count,
                           time_limit_seconds, started_at, is_active
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

            return WordGameSession(
                session_id=row["session_id"],
                user_id=row["user_id"],
                game_type=GameType(row["game_type"]),
                difficulty=GameDifficulty(row["difficulty"]),
                words=words,
                current_index=row["current_index"],
                score=row["score"],
                correct_count=row["correct_count"],
                wrong_count=row["wrong_count"],
                time_limit_seconds=row["time_limit_seconds"],
                started_at=row["started_at"],
                is_active=row["is_active"],
            )
        except Exception as e:
            logger.error("Failed to restore session %s: %s", session_id, e)
            return None

    async def _update_session(self, session: WordGameSession) -> None:
        """更新 DB 中的会话状态。"""
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
                        updated_at = NOW()
                    WHERE session_id = $1
                    """,
                    session.session_id,
                    session.current_index,
                    session.score,
                    session.correct_count,
                    session.wrong_count,
                    session.is_active,
                )
        except Exception as e:
            logger.warning("Failed to update session %s: %s", session.session_id, e)

    async def _finalize_session(self, session: WordGameSession) -> None:
        """游戏结束：写入 game_sessions 最终成绩 + 更新 user_game_profile。"""
        try:
            from app.db import get_pool
            pool = await get_pool()
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
                    int(session.user_id) if session.user_id.isdigit() else 0,
                    session.game_type.value,
                    session.score,
                    xp_gained,
                    coins_gained,
                    accuracy,
                    duration,
                    session.started_at,
                )

                # 更新 user_game_profile（upsert）
                user_id_int = int(session.user_id) if session.user_id.isdigit() else 0
                if user_id_int > 0:
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
                    "Finalized session %s: score=%d, xp=%d, coins=%d",
                    session.session_id, session.score, xp_gained, coins_gained,
                )
        except Exception as e:
            logger.error("Failed to finalize session %s: %s", session.session_id, e)

    async def _query_leaderboard(
        self,
        game_type: Optional[GameType] = None,
        limit: int = 10,
    ) -> List[LeaderboardEntry]:
        """从 game_sessions 表聚合查询排行榜。"""
        try:
            from app.db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                if game_type:
                    rows = await conn.fetch(
                        """
                        SELECT user_id, MAX(score) as best_score, MAX(finished_at) as achieved_at
                        FROM game_sessions
                        WHERE game_id = $1
                        GROUP BY user_id
                        ORDER BY best_score DESC
                        LIMIT $2
                        """,
                        game_type.value,
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
                    game_type=game_type or GameType.MULTIPLE_CHOICE,
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
    ) -> Optional[int]:
        """获取用户在排行榜中的排名。"""
        try:
            from app.db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                # 查询该用户在指定游戏类型下的最高分排名
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
                    game_type.value,
                    int(user_id) if user_id.isdigit() else 0,
                )
                return row["rank"] if row else None
        except Exception as e:
            logger.warning("Failed to get user rank: %s", e)
            return None

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

        # 过滤排除的单词
        word_pool = [w for w in word_pool if w.word not in exclude_words]

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
                    ]
                    word_pool.extend(additional)

        # 随机选择
        if not word_pool:
            # 最终回退
            word_pool = self._all_words[:count] if self._all_words else []

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
        }

        base = base_time.get(game_type, 30)
        return base * word_count // 10

    async def _generate_question(
        self,
        session: WordGameSession,
        index: int
    ) -> WordGameQuestion:
        """生成问题"""

        word = session.words[index]

        if session.game_type == GameType.MULTIPLE_CHOICE:
            # 选择题：生成选项
            options = await self._generate_options(word, session.words)
            return WordGameQuestion(
                question_id=f"q_{index}",
                word=word,
                question_type=session.game_type,
                question_text=f"'{word.meaning}' 的英文是？",
                options=options,
                correct_answer=word.word,
                hint=f"首字母是 {word.word[0]}",
                points=10
            )

        elif session.game_type == GameType.SPELLING:
            # 拼写题
            return WordGameQuestion(
                question_id=f"q_{index}",
                word=word,
                question_type=session.game_type,
                question_text=f"请拼写: {word.meaning}",
                options=None,
                correct_answer=word.word,
                hint=f"有 {len(word.word)} 个字母",
                points=10
            )

        elif session.game_type == GameType.FILL_BLANK:
            # 填空题
            sentence = f"The ___ is {word.meaning}."
            return WordGameQuestion(
                question_id=f"q_{index}",
                word=word,
                question_type=session.game_type,
                question_text=sentence,
                options=None,
                correct_answer=word.word,
                hint=f"首字母是 {word.word[0]}",
                points=10
            )

        else:
            # 默认问题格式
            return WordGameQuestion(
                question_id=f"q_{index}",
                word=word,
                question_type=session.game_type,
                question_text=f"请输入 '{word.meaning}' 的英文",
                options=None,
                correct_answer=word.word,
                hint=f"首字母是 {word.word[0]}",
                points=10
            )

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

    def _generate_feedback(
        self,
        is_correct: bool,
        word: Word,
        user_answer: str
    ) -> str:
        """生成反馈"""
        if is_correct:
            feedbacks = [
                f"正确！{word.word} = {word.meaning}",
                f"太棒了！{word.word} 记得很牢！",
                f"很好！继续保持！",
            ]
            return random.choice(feedbacks)
        else:
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
