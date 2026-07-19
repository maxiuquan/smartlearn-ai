"""内容版权台账与下架机制 Pydantic schemas (P0-5).

包含资产台账的创建/更新/响应模型，以及下架请求的创建/响应/审核模型。
"""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── 资产台账 ──


AssetType = Literal[
    "question",
    "exam_question",
    "vocabulary",
    "analysis",
    "image",
    "audio",
    "dictionary",
    "other",
]
SourceType = Literal[
    "original",
    "licensed",
    "public_domain",
    "user_generated",
    "ai_generated",
    "third_party",
]
LicenseType = Literal[
    "CC-BY",
    "CC-BY-SA",
    "CC-BY-NC",
    "commercial",
    "purchased",
    "fair_use",
    "unknown",
]
AssetStatus = Literal["active", "under_review", "taken_down", "expired"]


class ContentAssetCreate(BaseModel):
    """创建内容资产台账请求."""

    asset_type: AssetType = Field(..., description="资产类型")
    source_type: SourceType = Field(..., description="来源类型")
    source_ref: Optional[str] = Field(None, max_length=500, description="来源引用")
    license_type: Optional[LicenseType] = Field(None, description="许可类型")
    license_scope: Optional[str] = Field(None, max_length=200, description="授权范围")
    commercial_use: bool = Field(False, description="是否允许商用")
    ai_processing_allowed: bool = Field(False, description="是否允许 AI 二次处理")
    evidence_file_url: Optional[str] = Field(None, max_length=500, description="证据文件 URL")
    content_ref_id: Optional[str] = Field(None, max_length=100, description="关联内容 ID")
    status: AssetStatus = Field("active", description="初始状态")
    metadata_json: Optional[str] = Field(None, description="额外元数据（JSON 字符串）")

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class ContentAssetUpdate(BaseModel):
    """更新内容资产台账请求（PATCH，全部字段可选）."""

    asset_type: Optional[AssetType] = None
    source_type: Optional[SourceType] = None
    source_ref: Optional[str] = Field(None, max_length=500)
    license_type: Optional[LicenseType] = None
    license_scope: Optional[str] = Field(None, max_length=200)
    commercial_use: Optional[bool] = None
    ai_processing_allowed: Optional[bool] = None
    evidence_file_url: Optional[str] = Field(None, max_length=500)
    content_ref_id: Optional[str] = Field(None, max_length=100)
    status: Optional[AssetStatus] = None
    metadata_json: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class ContentAssetResponse(BaseModel):
    """内容资产台账响应."""

    id: int
    asset_type: str
    source_type: str
    source_ref: Optional[str] = None
    license_type: Optional[str] = None
    license_scope: Optional[str] = None
    commercial_use: bool
    ai_processing_allowed: bool
    evidence_file_url: Optional[str] = None
    content_ref_id: Optional[str] = None
    status: str
    reviewer_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    metadata_json: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContentAssetListResponse(BaseModel):
    """内容资产列表响应（分页）."""

    items: list[ContentAssetResponse]
    total: int
    page: int
    page_size: int


# ── 下架请求 ──


RequesterType = Literal["user", "admin", "third_party", "legal"]
TakedownStatus = Literal[
    "pending", "reviewing", "approved", "rejected", "escalated"
]


class TakedownRequestCreate(BaseModel):
    """提交下架请求."""

    asset_id: int = Field(..., description="被投诉的资产 ID")
    requester_type: RequesterType = Field(..., description="投诉方类型")
    requester_name: Optional[str] = Field(None, max_length=100)
    requester_contact: Optional[str] = Field(None, max_length=200)
    reason: str = Field(..., min_length=1, description="投诉/举报原因")
    evidence_url: Optional[str] = Field(None, max_length=500)

    model_config = ConfigDict(extra="forbid")


class TakedownRequestResponse(BaseModel):
    """下架请求响应."""

    id: int
    asset_id: int
    requester_type: str
    requester_id: Optional[int] = None
    requester_name: Optional[str] = None
    requester_contact: Optional[str] = None
    reason: str
    evidence_url: Optional[str] = None
    status: str
    reviewer_id: Optional[int] = None
    review_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TakedownListResponse(BaseModel):
    """下架请求列表响应（分页）."""

    items: list[TakedownRequestResponse]
    total: int
    page: int
    page_size: int


class TakedownReviewRequest(BaseModel):
    """审核下架请求（admin）."""

    status: Literal["approved", "rejected", "escalated"] = Field(
        ..., description="审核结果"
    )
    review_note: Optional[str] = Field(None, description="审核备注")

    model_config = ConfigDict(extra="forbid")
