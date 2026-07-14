"""
单词游戏数据模型

设计依据：第五轮复审 6.1/6.2/6.3 修复
- 增加 SubjectType 区分学科（vocabulary/math/cross_subject）
- WordGameRequest 增加 game_id 字段（6.2⑤：25 款游戏差异化）
- WordGameSession 增加 game_id/subject/answered 记录（6.2④：错词本真实数据）
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class GameType(str, Enum):
    """游戏类型（题型）"""
    WORD_MATCH = "word_match"  # 单词配对
    SPELLING = "spelling"  # 拼写练习
    WORD_CHAIN = "word_chain"  # 单词接龙
    FILL_BLANK = "fill_blank"  # 填空
    MULTIPLE_CHOICE = "multiple_choice"  # 选择题
    LISTEN_WRITE = "listen_write"  # 听写
    WORD_SEARCH = "word_search"  # 单词搜索
    CROSSWORD = "crossword"  # 填字游戏
    # 扩展题型（保留现有 8 种，不删除）
    TAP_MATCH = "tap_match"  # 点击配对消除（两列卡片点击匹配）
    LISTEN_SELECT = "listen_select"  # 听音选词（TTS 播放发音 + 选择题）
    DRAG_SORT = "drag_sort"  # 拖拽排序（单词排序成正确顺序）
    WORD_BANK = "word_bank"  # 词库填空（点选词库填入空格）


class SubjectType(str, Enum):
    """游戏学科分类（与 games-config.json 的 category 对齐）"""
    VOCABULARY = "vocabulary"
    MATH = "math"
    CROSS_SUBJECT = "cross_subject"


class GameDifficulty(str, Enum):
    """游戏难度"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Word(BaseModel):
    """单词"""
    word_id: str = Field(..., description="单词ID")
    word: str = Field(..., description="单词")
    meaning: str = Field(..., description="含义")
    pronunciation: Optional[str] = Field(None, description="发音")
    example_sentence: Optional[str] = Field(None, description="例句")
    part_of_speech: Optional[str] = Field(None, description="词性")
    difficulty: float = Field(..., ge=0, le=1, description="难度")
    category: Optional[str] = Field(None, description="分类")
    # P1-2：数学题正确答案随 session 持久化，避免 submit_answer 线性遍历题库反查
    correct_answer: Optional[str] = Field(None, description="正确答案（数学题用，避免反查题库）")


class AnswerRecord(BaseModel):
    """单题作答记录（6.2④：错词本真实数据来源）"""
    question_id: str = Field(..., description="问题ID")
    word_id: str = Field("", description="单词ID（数学题为空）")
    word: str = Field("", description="题目内容/单词")
    is_correct: bool = Field(..., description="是否正确")
    user_answer: str = Field(..., description="用户答案")
    correct_answer: str = Field(..., description="正确答案")


class WordGameSession(BaseModel):
    """游戏会话"""
    session_id: str = Field(..., description="会话ID")
    user_id: str = Field(..., description="用户ID")
    game_type: GameType = Field(..., description="游戏类型（题型）")
    game_id: str = Field(default="", description="游戏ID（25款游戏的真实标识，6.2⑤/⑥）")
    subject: SubjectType = Field(default=SubjectType.VOCABULARY, description="学科分类")
    difficulty: GameDifficulty = Field(..., description="难度")
    words: List[Word] = Field(..., description="单词列表（数学题为占位）")
    current_index: int = Field(default=0, ge=0, description="当前索引")
    score: int = Field(default=0, ge=0, description="得分")
    correct_count: int = Field(default=0, ge=0, description="正确数")
    wrong_count: int = Field(default=0, ge=0, description="错误数")
    time_limit_seconds: int = Field(..., ge=0, description="时间限制(秒)")
    started_at: datetime = Field(default_factory=datetime.now, description="开始时间")
    is_active: bool = Field(default=True, description="是否活跃")
    answered: List[AnswerRecord] = Field(default_factory=list, description="逐题作答记录（6.2④）")
    # 单词接龙交替回合制：记录当前链尾字母、已用单词、系统出过的词、当前回合
    chain_current_word: str = Field(default="", description="单词接龙当前链尾单词（系统或用户最后输入的词）")
    chain_used_words: List[str] = Field(default_factory=list, description="单词接龙已用单词列表（防重复）")
    chain_turn: str = Field(default="user", description="当前回合：user=等待用户接词，system=系统刚接完词")


class WordGameQuestion(BaseModel):
    """游戏问题"""
    question_id: str = Field(..., description="问题ID")
    word: Word = Field(..., description="单词")
    question_type: GameType = Field(..., description="问题类型")
    question_text: str = Field(..., description="问题文本")
    options: Optional[List[str]] = Field(None, description="选项")
    correct_answer: str = Field(..., description="正确答案")
    hint: Optional[str] = Field(None, description="提示")
    points: int = Field(default=10, ge=1, description="分值")
    # 扩展字段（新题型专用，可选）
    # 点击配对消除题用：左列和右列的卡片
    pairs: Optional[List[Dict[str, str]]] = Field(None, description="配对题的左右列卡片")
    # 拖拽排序题用：打乱顺序的单词列表
    sort_items: Optional[List[str]] = Field(None, description="排序题的待排序项")
    # 词库填空题用：词库选项
    word_bank: Optional[List[str]] = Field(None, description="词库填空的候选词")


class WordGameAnswer(BaseModel):
    """游戏答案"""
    question_id: str = Field(..., description="问题ID")
    user_answer: str = Field(..., description="用户答案")
    time_spent_seconds: int = Field(..., ge=0, description="用时(秒)")
    used_hint: bool = Field(default=False, description="是否使用提示")


class WordGameResult(BaseModel):
    """游戏结果"""
    question_id: str = Field(..., description="问题ID")
    is_correct: bool = Field(..., description="是否正确")
    user_answer: str = Field(..., description="用户答案")
    correct_answer: str = Field(..., description="正确答案")
    points_earned: int = Field(..., ge=0, description="获得分数")
    time_spent_seconds: int = Field(..., ge=0, description="用时(秒)")
    feedback: str = Field(..., description="反馈")


class WordGameRequest(BaseModel):
    """单词游戏请求"""
    user_id: str = Field(..., description="用户ID（兼容前端传值，真实身份以 JWT 为准）")
    game_type: GameType = Field(..., description="游戏类型（题型）")
    game_id: str = Field(default="", description="游戏ID（25款游戏差异化，6.2⑤）")
    subject: SubjectType = Field(default=SubjectType.VOCABULARY, description="学科分类")
    difficulty: GameDifficulty = Field(default=GameDifficulty.MEDIUM, description="难度")
    word_count: int = Field(default=10, ge=5, le=30, description="单词数量")
    time_limit_seconds: Optional[int] = Field(None, description="时间限制(秒)")
    categories: Optional[List[str]] = Field(None, description="单词分类")
    exclude_words: Optional[List[str]] = Field(None, description="排除的单词")


class WordGameResponse(BaseModel):
    """单词游戏响应"""
    session: WordGameSession = Field(..., description="游戏会话")
    first_question: WordGameQuestion = Field(..., description="第一个问题")
    total_questions: int = Field(..., description="总问题数")
    instructions: str = Field(..., description="游戏说明")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")


class SubmitAnswerRequest(BaseModel):
    """提交答案请求"""
    session_id: str = Field(..., description="会话ID")
    answer: WordGameAnswer = Field(..., description="答案")


class SubmitAnswerResponse(BaseModel):
    """提交答案响应"""
    session_id: str = Field(..., description="会话ID")
    result: WordGameResult = Field(..., description="结果")
    next_question: Optional[WordGameQuestion] = Field(None, description="下一题")
    current_score: int = Field(..., description="当前得分")
    progress: float = Field(..., ge=0, le=1, description="进度")
    is_game_over: bool = Field(..., description="是否结束")


class GameSummary(BaseModel):
    """游戏总结"""
    session_id: str = Field(..., description="会话ID")
    user_id: str = Field(..., description="用户ID")
    game_type: GameType = Field(..., description="游戏类型（题型）")
    game_id: str = Field(default="", description="游戏ID")
    subject: SubjectType = Field(default=SubjectType.VOCABULARY, description="学科分类")
    total_score: int = Field(..., description="总得分")
    max_score: int = Field(..., description="满分")
    accuracy: float = Field(..., ge=0, le=1, description="正确率")
    total_time_seconds: int = Field(..., description="总用时(秒)")
    average_time_per_question: float = Field(..., description="平均每题用时")
    correct_words: List[str] = Field(default_factory=list, description="正确的单词")
    wrong_words: List[str] = Field(default_factory=list, description="错误的单词")
    improvement_words: List[str] = Field(default_factory=list, description="需要加强的单词")
    rank: Optional[int] = Field(None, description="排名")
    badge: Optional[str] = Field(None, description="获得的徽章")
    completed_at: datetime = Field(default_factory=datetime.now, description="完成时间")


class LeaderboardEntry(BaseModel):
    """排行榜条目"""
    rank: int = Field(..., ge=1, description="排名")
    user_id: str = Field(..., description="用户ID")
    username: str = Field(..., description="用户名")
    score: int = Field(..., description="得分")
    game_type: Optional[GameType] = Field(None, description="游戏类型（题型）")
    game_id: str = Field(default="", description="游戏ID（6.2⑥：按真实 game_id 分榜）")
    achieved_at: datetime = Field(..., description="达成时间")


class LeaderboardRequest(BaseModel):
    """排行榜请求"""
    game_type: Optional[GameType] = Field(None, description="游戏类型（题型）")
    game_id: Optional[str] = Field(None, description="游戏ID（6.2⑥：按真实 game_id 分榜）")
    difficulty: Optional[GameDifficulty] = Field(None, description="难度")
    limit: int = Field(default=10, ge=1, le=100, description="数量限制")


class LeaderboardResponse(BaseModel):
    """排行榜响应"""
    entries: List[LeaderboardEntry] = Field(..., description="排行榜条目")
    total_players: int = Field(..., description="总玩家数")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")


# ============================================================================
# 客户端 DTO（R8 审计修复）
# 拆分内部/公开 DTO：以下 Client 版本不含 correct_answer 字段，
# 避免正确答案被下发到浏览器。内部模型（WordGameQuestion/Word 等）保留不变，
# 服务层仍使用完整模型；仅在需要对外响应时通过转换函数剥离 correct_answer。
# ============================================================================


class WordClient(BaseModel):
    """单词（客户端版本，不含 correct_answer）"""
    word_id: str
    word: str
    meaning: str
    pronunciation: Optional[str] = None
    example_sentence: Optional[str] = None
    part_of_speech: Optional[str] = None
    difficulty: float = 0.0
    category: Optional[str] = None


class WordGameQuestionClient(BaseModel):
    """游戏问题（客户端版本，不含 correct_answer 和 word.correct_answer）"""
    question_id: str
    word: Optional[WordClient] = None
    question_type: Any = None  # GameType 枚举
    question_text: str
    options: Optional[List[str]] = None
    hint: Optional[str] = None
    points: int = 10
    pairs: Optional[List[Dict[str, str]]] = None
    sort_items: Optional[List[str]] = None
    word_bank: Optional[List[str]] = None


class WordGameSessionClient(BaseModel):
    """游戏会话（客户端版本，words 使用 WordClient）"""
    session_id: str
    user_id: str
    game_type: Any = None
    game_id: str
    subject: Any = None
    difficulty: Any = None
    score: int = 0
    correct_count: int = 0
    wrong_count: int = 0
    current_index: int = 0
    time_limit_seconds: int = 0
    started_at: Optional[datetime] = None
    is_active: bool = True


class WordGameResponseClient(BaseModel):
    """开始游戏响应（客户端版本，不含 correct_answer）"""
    session: WordGameSessionClient
    first_question: WordGameQuestionClient
    total_questions: int
    instructions: Optional[str] = None
    generated_at: Optional[datetime] = None


class SubmitAnswerResponseClient(BaseModel):
    """提交答案响应（客户端版本，next_question 不含 correct_answer）"""
    session_id: str
    result: Any = None  # WordGameResult（含 correct_answer，合法：用户已提交）
    next_question: Optional[WordGameQuestionClient] = None
    current_score: int = 0
    progress: Optional[Any] = None
    is_game_over: bool = False


def to_client_question(q: WordGameQuestion) -> WordGameQuestionClient:
    """将内部 Question 转换为客户端版本（剥离 correct_answer）"""
    word_client = None
    if q.word:
        word_client = WordClient(
            word_id=q.word.word_id,
            word=q.word.word,
            meaning=q.word.meaning,
            pronunciation=q.word.pronunciation,
            example_sentence=q.word.example_sentence,
            part_of_speech=q.word.part_of_speech,
            difficulty=q.word.difficulty,
            category=q.word.category,
        )
    return WordGameQuestionClient(
        question_id=q.question_id,
        word=word_client,
        question_type=q.question_type,
        question_text=q.question_text,
        options=q.options,
        hint=q.hint,
        points=q.points,
        pairs=q.pairs,
        sort_items=q.sort_items,
        word_bank=q.word_bank,
    )


def to_client_session(s) -> WordGameSessionClient:
    """将内部 Session 转换为客户端版本（剥离 words 中的 correct_answer）"""
    return WordGameSessionClient(
        session_id=s.session_id,
        user_id=s.user_id,
        game_type=s.game_type,
        game_id=s.game_id,
        subject=s.subject,
        difficulty=s.difficulty,
        score=s.score,
        correct_count=s.correct_count,
        wrong_count=s.wrong_count,
        current_index=s.current_index,
        time_limit_seconds=s.time_limit_seconds,
        started_at=s.started_at,
        is_active=s.is_active,
    )