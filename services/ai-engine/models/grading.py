"""
智能批改数据模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class QuestionType(str, Enum):
    """题目类型"""
    CHOICE = "choice"  # 选择题
    FILL = "fill"  # 填空题
    SHORT_ANSWER = "short_answer"  # 简答题
    CALCULATION = "calculation"  # 计算题
    PROOF = "proof"  # 证明题
    ESSAY = "essay"  # 作文


class ErrorType(str, Enum):
    """错误类型"""
    CALCULATION = "calculation"  # 计算错误
    CONCEPT = "concept"  # 概念错误
    CARELESS = "careless"  # 粗心错误
    INCOMPLETE = "incomplete"  # 不完整
    LOGIC = "logic"  # 逻辑错误
    METHOD = "method"  # 方法错误
    SYNTAX = "syntax"  # 语法错误
    OTHER = "other"  # 其他


class AnswerAnalysis(BaseModel):
    """答案分析"""
    is_correct: bool = Field(..., description="是否正确")
    score: float = Field(..., ge=0, le=1, description="得分率")
    error_type: Optional[ErrorType] = Field(None, description="错误类型")
    error_description: Optional[str] = Field(None, description="错误描述")
    correct_answer: str = Field(..., description="正确答案")
    user_answer: str = Field(..., description="用户答案")
    key_points: List[str] = Field(default_factory=list, description="关键点")
    missed_points: List[str] = Field(default_factory=list, description="遗漏点")
    suggestions: List[str] = Field(default_factory=list, description="改进建议")


class StepAnalysis(BaseModel):
    """步骤分析"""
    step_number: int = Field(..., ge=1, description="步骤编号")
    content: str = Field(..., description="步骤内容")
    is_correct: bool = Field(..., description="是否正确")
    score: float = Field(..., ge=0, le=1, description="步骤得分")
    error: Optional[str] = Field(None, description="错误说明")
    correction: Optional[str] = Field(None, description="修正")


class GradingRequest(BaseModel):
    """批改请求"""
    question_id: str = Field(..., description="题目ID")
    question_type: QuestionType = Field(..., description="题目类型")
    question_content: str = Field(..., description="题目内容")
    standard_answer: str = Field(..., description="标准答案")
    user_answer: str = Field(..., description="用户答案")
    scoring_rules: Optional[Dict] = Field(None, description="评分规则")
    knowledge_points: Optional[List[str]] = Field(None, description="相关知识点")
    user_id: Optional[str] = Field(None, description="用户ID")


class GradingResponse(BaseModel):
    """批改响应"""
    question_id: str = Field(..., description="题目ID")
    analysis: AnswerAnalysis = Field(..., description="答案分析")
    step_analysis: Optional[List[StepAnalysis]] = Field(None, description="步骤分析")
    total_score: float = Field(..., ge=0, description="总得分")
    max_score: float = Field(..., ge=0, description="满分")
    score_percentage: float = Field(..., ge=0, le=100, description="得分百分比")
    feedback: str = Field(..., description="反馈")
    graded_at: datetime = Field(default_factory=datetime.now, description="批改时间")


class BatchGradingRequest(BaseModel):
    """批量批改请求"""
    user_id: str = Field(..., description="用户ID")
    answers: List[GradingRequest] = Field(..., description="答案列表")


class BatchGradingResponse(BaseModel):
    """批量批改响应"""
    user_id: str = Field(..., description="用户ID")
    results: List[GradingResponse] = Field(..., description="批改结果")
    total_score: float = Field(..., description="总得分")
    total_max_score: float = Field(..., description="总满分")
    accuracy_rate: float = Field(..., ge=0, le=1, description="正确率")
    error_statistics: Dict[ErrorType, int] = Field(default_factory=dict, description="错误统计")
    suggestions: List[str] = Field(default_factory=list, description="整体建议")


class ErrorPattern(BaseModel):
    """错误模式"""
    error_type: ErrorType = Field(..., description="错误类型")
    frequency: int = Field(..., ge=0, description="出现频率")
    knowledge_points: List[str] = Field(default_factory=list, description="相关知识点")
    examples: List[str] = Field(default_factory=list, description="示例")


class ErrorAnalysisRequest(BaseModel):
    """错误分析请求"""
    user_id: str = Field(..., description="用户ID")
    recent_gradings: List[GradingResponse] = Field(..., description="最近批改结果")
    time_range_days: int = Field(default=7, ge=1, description="时间范围(天)")


class ErrorAnalysisResponse(BaseModel):
    """错误分析响应"""
    user_id: str = Field(..., description="用户ID")
    error_patterns: List[ErrorPattern] = Field(..., description="错误模式")
    weak_knowledge_points: List[str] = Field(..., description="薄弱知识点")
    improvement_plan: List[str] = Field(..., description="改进计划")
    priority_order: List[str] = Field(..., description="优先处理顺序")
