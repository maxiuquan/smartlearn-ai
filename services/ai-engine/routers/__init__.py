"""
AI Engine Routers
"""
from .recommendation_router import router as recommendation_router
from .forgetting_curve_router import router as forgetting_curve_router
from .ability_assessment_router import router as ability_assessment_router
from .knowledge_graph_router import router as knowledge_graph_router
from .handwriting_router import router as handwriting_router
from .grading_router import router as grading_router
from .learning_path_router import router as learning_path_router
from .daily_planning_router import router as daily_planning_router
from .word_games_router import router as word_games_router

__all__ = [
    "recommendation_router",
    "forgetting_curve_router",
    "ability_assessment_router",
    "knowledge_graph_router",
    "handwriting_router",
    "grading_router",
    "learning_path_router",
    "daily_planning_router",
    "word_games_router",
]
