"""
AI Engine Services
"""
from .recommendation_service import RecommendationService
from .forgetting_curve_service import ForgettingCurveService
from .ability_assessment_service import AbilityAssessmentService
from .knowledge_graph_service import KnowledgeGraphService
from .handwriting_service import HandwritingService
from .grading_service import GradingService
from .learning_path_service import LearningPathService
from .daily_planning_service import DailyPlanningService
from .word_games_service import WordGamesService

__all__ = [
    "RecommendationService",
    "ForgettingCurveService",
    "AbilityAssessmentService",
    "KnowledgeGraphService",
    "HandwritingService",
    "GradingService",
    "LearningPathService",
    "DailyPlanningService",
    "WordGamesService",
]
