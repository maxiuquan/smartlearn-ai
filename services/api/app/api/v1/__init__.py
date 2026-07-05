"""API v1 路由聚合"""
from fastapi import APIRouter

from app.api.v1.audit import router as audit_router
from app.api.v1.auth import router as auth_router
from app.api.v1.games import router as games_router
from app.api.v1.knowledge import router as knowledge_router
from app.api.v1.questions import router as questions_router
from app.api.v1.statistics import router as statistics_router
from app.api.v1.system import router as system_router
from app.api.v1.users import router as users_router
from app.api.v1.vocab import router as vocab_router
from app.api.v1.wrong_questions import router as wrong_questions_router

api_router = APIRouter(prefix="/api/v1")

# 业务路由（原有）
api_router.include_router(auth_router, prefix="/auth", tags=["认证"])
api_router.include_router(knowledge_router, prefix="/knowledge", tags=["知识点"])
api_router.include_router(questions_router, prefix="/questions", tags=["题目"])
api_router.include_router(vocab_router, prefix="/vocab", tags=["词汇"])
api_router.include_router(games_router, prefix="/games", tags=["游戏"])
api_router.include_router(wrong_questions_router, prefix="/wrong-questions", tags=["错题"])

# 管理后台路由（新增）
api_router.include_router(users_router, prefix="/users", tags=["用户管理"])
api_router.include_router(system_router, prefix="/system", tags=["系统管理"])
api_router.include_router(statistics_router, prefix="/statistics", tags=["统计"])
api_router.include_router(audit_router, prefix="/audit-logs", tags=["审计日志"])
