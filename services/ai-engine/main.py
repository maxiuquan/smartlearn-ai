"""
SmartLearn AI Engine Service
智能学习AI引擎服务

主入口文件
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from contextlib import asynccontextmanager
from datetime import datetime
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import settings
from routers import (
    recommendation_router,
    forgetting_curve_router,
    ability_assessment_router,
    knowledge_graph_router,
    handwriting_router,
    grading_router,
    learning_path_router,
    daily_planning_router,
    word_games_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    print(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} 启动中...")
    print(f"📝 调试模式: {settings.DEBUG}")
    
    yield
    
    # 关闭时执行
    print(f"👋 {settings.APP_NAME} 关闭中...")


# 创建FastAPI应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## SmartLearn AI Engine

智能学习平台的AI引擎服务，提供以下核心功能：

### 📚 功能模块

1. **智能推题引擎** - 根据用户能力模型智能推荐题目
2. **遗忘曲线算法** - 艾宾浩斯遗忘曲线实现，智能复习提醒
3. **能力评估** - 用户能力等级评估与追踪
4. **知识图谱** - 知识点依赖关系图，学习路径规划
5. **手写识别** - OCR识别接口（模拟实现）
6. **智能批改** - 答案批改、错误分析、改进建议
7. **学习路径生成** - 前置知识点链、个性化学习路径
8. **每日规划** - 智能分配每日学习任务
9. **单词游戏** - 趣味单词游戏逻辑

### 🔧 技术栈

- Python 3.11+
- FastAPI
- Pydantic
- NumPy

---
**联系方式**: SmartLearn Team
    """,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理器"""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": str(exc),
            "timestamp": datetime.now().isoformat()
        }
    )


# 注册路由
app.include_router(recommendation_router)
app.include_router(forgetting_curve_router)
app.include_router(ability_assessment_router)
app.include_router(knowledge_graph_router)
app.include_router(handwriting_router)
app.include_router(grading_router)
app.include_router(learning_path_router)
app.include_router(daily_planning_router)
app.include_router(word_games_router)


# 根路径
@app.get("/", tags=["Root"])
async def root():
    """
    服务根路径
    
    返回服务基本信息
    """
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "docs": "/docs",
        "redoc": "/redoc"
    }


# 健康检查
@app.get("/health", tags=["Health"])
async def health_check():
    """
    健康检查端点
    
    用于服务健康状态监控
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": settings.APP_VERSION
    }


# 服务状态
@app.get("/status", tags=["Health"])
async def service_status():
    """
    服务状态详情
    
    返回各模块状态
    """
    return {
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "modules": {
            "recommendation": "active",
            "forgetting_curve": "active",
            "ability_assessment": "active",
            "knowledge_graph": "active",
            "handwriting": "active",
            "grading": "active",
            "learning_path": "active",
            "daily_planning": "active",
            "word_games": "active",
        },
        "config": {
            "debug": settings.DEBUG,
            "forgetting_base": settings.FORGETTING_BASE,
            "ability_levels": settings.ABILITY_LEVELS,
            "mastery_threshold": settings.MASTERY_THRESHOLD,
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
