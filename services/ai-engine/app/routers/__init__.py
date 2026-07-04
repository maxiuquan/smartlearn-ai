"""AI 引擎路由模块"""
from app.routers.chat_router import router as chat_router
from app.routers.rag_router import router as rag_router
from app.routers.study_router import router as study_router
from app.routers.media_router import router as media_router
from app.routers.moderation_router import router as moderation_router
from app.routers.prompt_router import router as prompt_router
from app.routers.word_games_router import router as word_games_router

__all__ = [
    "chat_router",
    "rag_router",
    "study_router",
    "media_router",
    "moderation_router",
    "prompt_router",
    "word_games_router",
]