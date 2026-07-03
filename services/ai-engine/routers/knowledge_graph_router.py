"""
知识图谱路由
"""
from fastapi import APIRouter

from models.knowledge_graph import (
    KnowledgeGraphRequest,
    KnowledgeGraphResponse,
    PrerequisiteRequest,
    PrerequisiteResponse
)
from services.knowledge_graph_service import KnowledgeGraphService

router = APIRouter(prefix="/knowledge-graph", tags=["知识图谱"])

# 服务实例
kg_service = KnowledgeGraphService()


@router.post("/get", response_model=KnowledgeGraphResponse)
async def get_knowledge_graph(request: KnowledgeGraphRequest):
    """
    获取知识图谱
    
    返回知识点及其依赖关系图：
    - 知识节点列表
    - 前置/依赖关系
    - 难度和重要性信息
    """
    return await kg_service.get_knowledge_graph(request)


@router.post("/prerequisites", response_model=PrerequisiteResponse)
async def get_prerequisites(request: PrerequisiteRequest):
    """
    获取前置知识点
    
    分析学习某个知识点需要的前置知识：
    - 前置知识路径
    - 学习顺序建议
    - 预估学习时间
    """
    return await kg_service.get_prerequisites(request)


@router.get("/subjects")
async def get_available_subjects():
    """
    获取可用科目列表
    """
    return {
        "subjects": [
            {"id": "math", "name": "数学"},
            {"id": "chinese", "name": "语文"},
            {"id": "english", "name": "英语"},
            {"id": "physics", "name": "物理"},
            {"id": "chemistry", "name": "化学"},
        ]
    }


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "knowledge_graph"}
