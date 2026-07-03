"""
单词游戏服务
趣味单词游戏逻辑
"""
import numpy as np
from typing import List, Optional, Dict
from datetime import datetime
from collections import defaultdict
import uuid
import random

from config import settings
from models.word_games import (
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
    LeaderboardEntry
)


class WordGamesService:
    """单词游戏服务"""
    
    def __init__(self):
        self.time_limit = settings.WORD_GAME_TIME_LIMIT
        self.batch_size = settings.WORD_GAME_BATCH_SIZE
        # 模拟单词库
        self._word_bank = self._init_word_bank()
        # 活跃会话
        self._sessions: Dict[str, WordGameSession] = {}
        # 排行榜数据
        self._leaderboard: List[LeaderboardEntry] = []
    
    async def start_game(
        self,
        request: WordGameRequest
    ) -> WordGameResponse:
        """开始游戏"""
        
        # 选择单词
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
        
        self._sessions[session.session_id] = session
        
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
        
        session = self._sessions.get(request.session_id)
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
            # 时间奖励
            time_bonus = max(0, 5 - answer.time_spent_seconds // 10)
            # 不使用提示奖励
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
        
        session = self._sessions.get(session_id)
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
        
        # 简化处理：假设前correct_count个是正确的
        for i, word in enumerate(session.words):
            if i < session.correct_count:
                correct_words.append(word.word)
            else:
                wrong_words.append(word.word)
        
        # 确定需要加强的单词
        improvement_words = wrong_words[:5]
        
        # 计算排名
        rank = self._update_leaderboard(session)
        
        # 确定徽章
        badge = self._award_badge(session, accuracy)
        
        return GameSummary(
            session_id=session_id,
            user_id=session.user_id,
            game_type=session.game_type,
            total_score=session.score,
            max_score=total_questions * 18,  # 最大可能得分
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
        """获取排行榜"""
        
        # 过滤排行榜
        filtered = self._leaderboard
        
        if request.game_type:
            filtered = [e for e in filtered if e.game_type == request.game_type]
        
        # 排序并限制数量
        filtered = sorted(filtered, key=lambda x: -x.score)[:request.limit]
        
        return LeaderboardResponse(
            entries=filtered,
            total_players=len(self._leaderboard),
            generated_at=datetime.now()
        )
    
    def _init_word_bank(self) -> Dict[GameDifficulty, List[Word]]:
        """初始化单词库"""
        return {
            GameDifficulty.EASY: [
                Word(word_id="w1", word="apple", meaning="苹果", pronunciation="ˈæpl", 
                     difficulty=0.2, category="fruit"),
                Word(word_id="w2", word="book", meaning="书", pronunciation="bʊk",
                     difficulty=0.2, category="object"),
                Word(word_id="w3", word="cat", meaning="猫", pronunciation="kæt",
                     difficulty=0.2, category="animal"),
                Word(word_id="w4", word="dog", meaning="狗", pronunciation="dɔːɡ",
                     difficulty=0.2, category="animal"),
                Word(word_id="w5", word="egg", meaning="鸡蛋", pronunciation="eɡ",
                     difficulty=0.2, category="food"),
            ],
            GameDifficulty.MEDIUM: [
                Word(word_id="w6", word="beautiful", meaning="美丽的", pronunciation="ˈbjuːtɪfl",
                     difficulty=0.5, category="adjective"),
                Word(word_id="w7", word="computer", meaning="电脑", pronunciation="kəmˈpjuːtər",
                     difficulty=0.5, category="technology"),
                Word(word_id="w8", word="important", meaning="重要的", pronunciation="ɪmˈpɔːrtənt",
                     difficulty=0.5, category="adjective"),
                Word(word_id="w9", word="knowledge", meaning="知识", pronunciation="ˈnɑːlɪdʒ",
                     difficulty=0.5, category="abstract"),
                Word(word_id="w10", word="language", meaning="语言", pronunciation="ˈlæŋɡwɪdʒ",
                     difficulty=0.5, category="abstract"),
            ],
            GameDifficulty.HARD: [
                Word(word_id="w11", word="accomplish", meaning="完成", pronunciation="əˈkɑːmplɪʃ",
                     difficulty=0.8, category="verb"),
                Word(word_id="w12", word="phenomenon", meaning="现象", pronunciation="fəˈnɑːmɪnən",
                     difficulty=0.8, category="abstract"),
                Word(word_id="w13", word="sophisticated", meaning="复杂的", pronunciation="səˈfɪstɪkeɪtɪd",
                     difficulty=0.8, category="adjective"),
                Word(word_id="w14", word="entrepreneur", meaning="企业家", pronunciation="ˌɑːntrəprəˈnɜːr",
                     difficulty=0.8, category="business"),
                Word(word_id="w15", word="psychology", meaning="心理学", pronunciation="saɪˈkɑːlədʒi",
                     difficulty=0.8, category="science"),
            ]
        }
    
    async def _select_words(
        self,
        count: int,
        difficulty: GameDifficulty,
        categories: Optional[List[str]],
        exclude_words: List[str]
    ) -> List[Word]:
        """选择单词"""
        
        # 获取对应难度的单词
        word_pool = self._word_bank.get(difficulty, self._word_bank[GameDifficulty.MEDIUM])
        
        # 过滤排除的单词
        word_pool = [w for w in word_pool if w.word not in exclude_words]
        
        # 按类别过滤
        if categories:
            word_pool = [w for w in word_pool if w.category in categories]
        
        # 如果单词不够，从其他难度补充
        if len(word_pool) < count:
            for diff in [GameDifficulty.EASY, GameDifficulty.MEDIUM, GameDifficulty.HARD]:
                if diff != difficulty:
                    additional = [w for w in self._word_bank[diff] 
                                 if w.word not in exclude_words]
                    word_pool.extend(additional)
        
        # 随机选择
        selected = random.sample(word_pool, min(count, len(word_pool)))
        
        # 如果还是不够，重复选择
        while len(selected) < count:
            selected.extend(random.sample(word_pool, min(count - len(selected), len(word_pool))))
        
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
        """生成选择题选项"""
        options = [correct_word.word]
        
        # 从其他单词中选择干扰项
        other_words = [w.word for w in all_words if w.word_id != correct_word.word_id]
        
        if len(other_words) >= 3:
            options.extend(random.sample(other_words, 3))
        else:
            # 如果不够，添加一些假选项
            fake_options = ["option1", "option2", "option3"]
            options.extend(fake_options[:3 - len(other_words)])
            options.extend(other_words)
        
        random.shuffle(options)
        return options
    
    def _check_answer(
        self,
        user_answer: str,
        correct_answer: str,
        game_type: GameType
    ) -> bool:
        """检查答案"""
        # 标准化答案
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
    
    def _update_leaderboard(self, session: WordGameSession) -> int:
        """更新排行榜"""
        entry = LeaderboardEntry(
            rank=0,
            user_id=session.user_id,
            username=f"用户{session.user_id[:6]}",
            score=session.score,
            game_type=session.game_type,
            achieved_at=datetime.now()
        )
        
        self._leaderboard.append(entry)
        
        # 重新排序
        self._leaderboard.sort(key=lambda x: -x.score)
        
        # 更新排名
        for i, e in enumerate(self._leaderboard):
            e.rank = i + 1
        
        # 返回当前排名
        for e in self._leaderboard:
            if e.user_id == session.user_id and e.score == session.score:
                return e.rank
        
        return len(self._leaderboard)
    
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
