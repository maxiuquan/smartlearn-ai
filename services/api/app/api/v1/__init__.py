"""API v1 路由聚合"""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.knowledge import router as knowledge_router
from app.api.v1.questions import router as questions_router
from app.api.v1.vocab import router as vocab_router
from app.api.v1.games import router as games_router
from app.api.v1.wrong_questions import router as wrong_questions_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router, prefix="/auth", tags=["认证"])
api_router.include_router(knowledge_router, prefix="/knowledge", tags=["知识点"])
api_router.include_router(questions_router, prefix="/questions", tags=["题目"])
api_router.include_router(vocab_router, prefix="/vocab", tags=["词汇"])
api_router.include_router(games_router, prefix="/games", tags=["游戏"])
api_router.include_router(wrong_questions_router, prefix="/wrong-questions", tags=["错题"])