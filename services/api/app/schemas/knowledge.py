"""知识点相关 Pydantic schemas"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class KnowledgePointResponse(BaseModel):
    """知识点响应"""

    id: int
    subject: str
    chapter: Optional[str] = None
    section: Optional[str] = None
    name: str
    description: Optional[str] = None
    difficulty: int = 1
    importance: int = 1
    # 数据源 JSON 中 prerequisites 可能是 list[str] 或 list[dict]
    # 用 list[Any] 兼容两种结构
    prerequisites: Optional[list[Any]] = None
    keywords: Optional[list[str]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class KnowledgePointDetailResponse(KnowledgePointResponse):
    """知识点详情（含前置知识点完整信息）"""

    prerequisite_details: list["KnowledgePointResponse"] = Field(default_factory=list)


class KnowledgeTreeItem(BaseModel):
    """知识点树节点"""

    id: int
    name: str
    children: list["KnowledgeTreeItem"] = Field(default_factory=list)


class KnowledgeTreeResponse(BaseModel):
    """知识点树响应"""

    subject: str
    total_points: int
    tree: list[KnowledgeTreeItem]


class KnowledgeSearchResponse(BaseModel):
    """知识点搜索结果"""

    results: list[KnowledgePointResponse]
    total: int
    query: str