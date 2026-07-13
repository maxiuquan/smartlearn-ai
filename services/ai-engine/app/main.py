"""
SmartLearn AI - AI 引擎服务 (RAG + LLM)

独立运行的 AI 引擎微服务，提供：
- RAG 知识检索
- AI 导师对话
- 题目解析
- 学习计划生成
"""
import sys
import os
from contextlib import asynccontextmanager
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from app.routers import chat_router, rag_router, study_router, media_router, moderation_router, prompt_router, word_games_router, handwriting_router
from app.services.rag_service import get_rag_service
from app.auth import ensure_auth_configured


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动期安全门槛：鉴权开启但缺密钥则拒绝启动（fail-fast）
    ensure_auth_configured()

    # 启动时
    mode = "离线模式（模拟响应）" if settings.offline_mode else "在线模式"
    print(f"   {settings.APP_NAME} v{settings.APP_VERSION} 启动中...")
    print(f"   LLM 模型: {settings.LLM_MODEL_NAME}")
    print(f"   嵌入模型: {settings.EMBEDDING_MODEL_NAME}")
    print(f"   运行模式: {mode}")
    print(f"   向量存储: {settings.VECTOR_STORE_TYPE}")

    # 预初始化 RAG 服务
    rag = get_rag_service()
    print(f"   知识库加载完成: {len(rag._knowledge_chunks)} 知识点, {len(rag._question_chunks)} 题目")

    yield

    # 关闭时
    print(f"   {settings.APP_NAME} 关闭中...")


app = FastAPI(
    title=f"{settings.APP_NAME} - RAG & LLM",
    description="""
## SmartLearn AI Engine - RAG + LLM 服务

提供基于检索增强生成（RAG）和大语言模型（LLM）的智能学习功能：

### 功能模块

- **AI 对话** (`/chat`) - AI 导师对话，自动检索知识库上下文
- **知识检索** (`/rag/query`) - 检索相关知识内容
- **题目解析** (`/rag/explain`) - AI 驱动的题目详细解析
- **相似题目** (`/rag/similar`) - 检索相似题目
- **学习计划** (`/study/plan`) - 个性化学习计划生成

### 运行模式

- 设置 `OPENAI_API_KEY` 环境变量启用在线模式（真实 AI 回答）
- 不设置则使用离线模式（模拟响应）
    """,
    version="1.0.0",
    # P0-4: 生产环境关闭 OpenAPI/Swagger/ReDoc，防止接口与模型信息泄露
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    lifespan=lifespan,
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(chat_router)
app.include_router(rag_router)
app.include_router(study_router)
app.include_router(media_router)
app.include_router(moderation_router)
app.include_router(prompt_router)
app.include_router(word_games_router)
app.include_router(handwriting_router)


@app.get("/")
async def root():
    """服务根路径

    P0-4: 生产环境仅返回最小状态，不暴露模型/端点信息
    """
    if settings.is_production:
        return {"status": "running"}
    return {
        "name": f"{settings.APP_NAME} - RAG & LLM",
        "version": settings.APP_VERSION,
        "status": "running",
        "mode": "offline" if settings.offline_mode else "online",
        "model": settings.LLM_MODEL_NAME,
        "docs": "/docs",
        "endpoints": {
            "chat": "/chat",
            "rag_query": "/rag/query",
            "rag_explain": "/rag/explain",
            "rag_similar": "/rag/similar",
            "study_plan": "/study/plan",
            "media_tts": "/media/tts",
            "media_stt": "/media/stt",
            "media_image": "/media/image",
            "moderation": "/moderation",
            "prompts": "/prompts",
            "word_games": "/word-games",
        },
    }


@app.get("/health")
async def health():
    """健康检查端点

    P0-4: 生产环境仅返回最小状态，不暴露模型/嵌入模型/运行模式信息
    """
    if settings.is_production:
        return {"status": "ok", "service": "smartlearn-ai-engine"}
    return {
        "status": "ok",
        "service": "smartlearn-ai-engine",
        "version": "1.0.0",
        "chat_model": settings.LLM_MODEL_NAME,
        "embedding_model": settings.EMBEDDING_MODEL_NAME,
        "offline_mode": settings.offline_mode,
    }


if __name__ == "__main__":
    import uvicorn

    # P0-4: 生产环境仅监听 127.0.0.1（由 Nginx/API Service 反代访问）
    host = "127.0.0.1" if settings.is_production else settings.HOST
    uvicorn.run(app, host=host, port=settings.PORT)