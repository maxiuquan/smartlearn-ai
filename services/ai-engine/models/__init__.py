"""
AI Engine Data Models
"""
from .recommendation import (
    RecommendationRequest,
    RecommendationResponse,
    QuestionRecommendation
)
from .forgetting_curve import (
    ForgettingCurveRequest,
    ForgettingCurveResponse,
    ReviewSchedule
)
from .ability_assessment import (
    AbilityAssessmentRequest,
    AbilityAssessmentResponse,
    UserAbility
)
from .knowledge_graph import (
    KnowledgeNode,
    KnowledgeGraph,
    KnowledgeRelation
)
from .handwriting import (
    HandwritingRequest,
    HandwritingResponse,
    RecognizedCharacter
)
from .grading import (
    GradingRequest,
    GradingResponse,
    AnswerAnalysis
)
from .learning_path import (
    LearningPathRequest,
    LearningPathResponse,
    LearningStep
)
from .daily_planning import (
    DailyPlanRequest,
    DailyPlanResponse,
    DailyTask
)
from .word_games import (
    WordGameRequest,
    WordGameResponse,
    WordGameSession,
    WordGameResult
)

__all__ = [
    # Recommendation
    "RecommendationRequest",
    "RecommendationResponse",
    "QuestionRecommendation",
    # Forgetting Curve
    "ForgettingCurveRequest",
    "ForgettingCurveResponse",
    "ReviewSchedule",
    # Ability Assessment
    "AbilityAssessmentRequest",
    "AbilityAssessmentResponse",
    "UserAbility",
    # Knowledge Graph
    "KnowledgeNode",
    "KnowledgeGraph",
    "KnowledgeRelation",
    # Handwriting
    "HandwritingRequest",
    "HandwritingResponse",
    "RecognizedCharacter",
    # Grading
    "GradingRequest",
    "GradingResponse",
    "AnswerAnalysis",
    # Learning Path
    "LearningPathRequest",
    "LearningPathResponse",
    "LearningStep",
    # Daily Planning
    "DailyPlanRequest",
    "DailyPlanResponse",
    "DailyTask",
    # Word Games
    "WordGameRequest",
    "WordGameResponse",
    "WordGameSession",
    "WordGameResult",
]
