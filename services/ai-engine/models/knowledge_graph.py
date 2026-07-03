"""
知识图谱数据模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Set
from datetime import datetime
from enum import Enum


class RelationType(str, Enum):
    """知识点关系类型"""
    PREREQUISITE = "prerequisite"  # 前置关系
    DEPENDENT = "dependent"  # 依赖关系
    RELATED = "related"  # 相关关系
    EXTENSION = "extension"  # 扩展关系
    APPLICATION = "application"  # 应用关系


class KnowledgeDifficulty(str, Enum):
    """知识点难度"""
    BASIC = "basic"  # 基础
    INTERMEDIATE = "intermediate"  # 中等
    ADVANCED = "advanced"  # 高级
    EXPERT = "expert"  # 专家


class KnowledgeNode(BaseModel):
    """知识节点"""
    id: str = Field(..., description="知识点ID")
    name: str = Field(..., description="知识点名称")
    subject: str = Field(..., description="所属科目")
    chapter: Optional[str] = Field(None, description="所属章节")
    difficulty: KnowledgeDifficulty = Field(..., description="难度等级")
    description: Optional[str] = Field(None, description="知识点描述")
    keywords: List[str] = Field(default_factory=list, description="关键词")
    importance: float = Field(default=0.5, ge=0, le=1, description="重要性")
    estimated_time_minutes: int = Field(default=30, ge=1, description="预估学习时间")
    metadata: Dict = Field(default_factory=dict, description="元数据")


class KnowledgeRelation(BaseModel):
    """知识点关系"""
    source_id: str = Field(..., description="源知识点ID")
    target_id: str = Field(..., description="目标知识点ID")
    relation_type: RelationType = Field(..., description="关系类型")
    strength: float = Field(default=1.0, ge=0, le=1, description="关系强度")
    description: Optional[str] = Field(None, description="关系描述")


class KnowledgeGraph(BaseModel):
    """知识图谱"""
    nodes: List[KnowledgeNode] = Field(default_factory=list, description="知识节点")
    relations: List[KnowledgeRelation] = Field(default_factory=list, description="知识关系")
    subject: str = Field(..., description="科目")
    version: str = Field(default="1.0.0", description="版本号")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")


class PrerequisitePath(BaseModel):
    """前置知识路径"""
    target_id: str = Field(..., description="目标知识点ID")
    path: List[str] = Field(..., description="路径(知识点ID列表)")
    depth: int = Field(..., ge=0, description="深度")
    total_time_minutes: int = Field(..., description="总学习时间")
    is_complete: bool = Field(..., description="是否完整路径")


class KnowledgeGraphRequest(BaseModel):
    """知识图谱请求"""
    subject: Optional[str] = Field(None, description="科目筛选")
    knowledge_point_id: Optional[str] = Field(None, description="指定知识点")
    include_relations: bool = Field(default=True, description="是否包含关系")
    depth: int = Field(default=3, ge=1, le=10, description="查询深度")


class KnowledgeGraphResponse(BaseModel):
    """知识图谱响应"""
    graph: KnowledgeGraph = Field(..., description="知识图谱")
    total_nodes: int = Field(..., description="节点总数")
    total_relations: int = Field(..., description="关系总数")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")


class PrerequisiteRequest(BaseModel):
    """前置知识请求"""
    knowledge_point_id: str = Field(..., description="目标知识点ID")
    user_learned: Optional[List[str]] = Field(None, description="已学知识点")
    max_depth: int = Field(default=5, ge=1, le=10, description="最大深度")


class PrerequisiteResponse(BaseModel):
    """前置知识响应"""
    target_id: str = Field(..., description="目标知识点ID")
    prerequisites: List[PrerequisitePath] = Field(..., description="前置知识路径")
    missing_prerequisites: List[str] = Field(..., description="缺失的前置知识")
    learning_order: List[str] = Field(..., description="建议学习顺序")
    total_time_minutes: int = Field(..., description="总学习时间")
