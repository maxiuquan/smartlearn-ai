"""
单词游戏数据模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class GameType(str, Enum):
    """游戏类型"""
    WORD_MATCH = "word_match"  # 单词配对
    SPELLING = "spelling"  # 拼写练习
    WORD_CHAIN = "word_chain"  # 单词接龙
    FILL_BLANK = "fill_blank"  # 填空
    MULTIPLE_CHOICE = "multiple_choice"  # 选择题
    LISTEN_WRITE = "listen_write"  # 听写
    WORD_SEARCH = "word_search"  # 单词搜索
    CROSSWORD = "crossword"  # 填字游戏


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


class WordGameSession(BaseModel):
    """游戏会话"""
    session_id: str = Field(..., description="会话ID")
    user_id: str = Field(..., description="用户ID")
    game_type: GameType = Field(..., description="游戏类型")
    difficulty: GameDifficulty = Field(..., description="难度")
    words: List[Word] = Field(..., description="单词列表")
    current_index: int = Field(default=0, ge=0, description="当前索引")
    score: int = Field(default=0, ge=0, description="得分")
    correct_count: int = Field(default=0, ge=0, description="正确数")
    wrong_count: int = Field(default=0, ge=0, description="错误数")
    time_limit_seconds: int = Field(..., ge=0, description="时间限制(秒)")
    started_at: datetime = Field(default_factory=datetime.now, description="开始时间")
    is_active: bool = Field(default=True, description="是否活跃")


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
    user_id: str = Field(..., description="用户ID")
    game_type: GameType = Field(..., description="游戏类型")
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
    game_type: GameType = Field(..., description="游戏类型")
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
    game_type: GameType = Field(..., description="游戏类型")
    achieved_at: datetime = Field(..., description="达成时间")


class LeaderboardRequest(BaseModel):
    """排行榜请求"""
    game_type: Optional[GameType] = Field(None, description="游戏类型")
    difficulty: Optional[GameDifficulty] = Field(None, description="难度")
    limit: int = Field(default=10, ge=1, le=100, description="数量限制")


class LeaderboardResponse(BaseModel):
    """排行榜响应"""
    entries: List[LeaderboardEntry] = Field(..., description="排行榜条目")
    total_players: int = Field(..., description="总玩家数")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")