"""
学习路径路由
"""
from fastapi import APIRouter

from models.learning_path import (
    LearningPathRequest,
    LearningPathResponse,
    PathProgressUpdate,
    PathProgressResponse,
    AdaptivePathRequest,
    AdaptivePathResponse,
    LearningPath
)
from services.learning_path_service import LearningPathService

router = APIRouter(prefix="/learning-path", tags=["学习路径"])

# 服务实例
learning_path_service = LearningPathService()

# 临时存储路径（实际应用中应使用数据库）
_paths_store = {}


@router.post("/generate", response_model=LearningPathResponse)
async def generate_learning_path(request: LearningPathRequest):
    """
    生成学习路径
    
    为目标知识点生成学习路径：
    - 分析前置知识
    - 生成学习步骤
    - 估算学习时间
    """
    response = await learning_path_service.generate_path(request)
    _paths_store[response.path.path_id] = response.path
    return response


@router.post("/update-progress", response_model=PathProgressResponse)
async def update_progress(path_id: str, update: PathProgressUpdate):
    """
    更新学习进度
    
    更新学习路径的进度：
    - 标记步骤完成
    - 解锁后续步骤
    - 计算整体进度
    """
    path = _paths_store.get(path_id)
    if not path:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Path not found")
    
    return await learning_path_service.update_progress(path, update)


@router.post("/adapt", response_model=AdaptivePathResponse)
async def adapt_learning_path(request: AdaptivePathRequest):
    """
    自适应调整路径
    
    根据学习表现调整路径：
    - 增加基础练习
    - 跳过已掌握内容
    - 优化学习顺序
    """
    return await learning_path_service.adapt_path(request)


@router.get("/{path_id}")
async def get_learning_path(path_id: str):
    """
    获取学习路径详情
    """
    path = _paths_store.get(path_id)
    if not path:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Path not found")
    
    return path


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "learning_path"}
