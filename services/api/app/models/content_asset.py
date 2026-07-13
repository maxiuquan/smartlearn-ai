"""内容版权台账与下架机制 ORM 模型 (P0-5).

- ContentAsset: 内容资产版权台账，记录每条内容的来源/许可/商用授权等信息
- ContentTakedownRequest: 下架/投诉请求记录，支持审核流转
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ContentAsset(Base):
    """内容资产版权台账.

    asset_type: question/exam_question/vocabulary/analysis/image/audio/dictionary/other
    source_type: original/licensed/public_domain/user_generated/ai_generated/third_party
    license_type: CC-BY/CC-BY-SA/CC-BY-NC/commercial/purchased/fair_use/unknown
    status: active/under_review/taken_down/expired
    """

    __tablename__ = "content_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    source_ref: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    license_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    license_scope: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    commercial_use: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    ai_processing_allowed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    evidence_file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    content_ref_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), server_default="active", nullable=False, index=True
    )
    reviewer_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<ContentAsset id={self.id} type={self.asset_type} "
            f"source={self.source_type} status={self.status}>"
        )


class ContentTakedownRequest(Base):
    """内容下架/投诉请求.

    requester_type: user/admin/third_party/legal
    status: pending/reviewing/approved/rejected/escalated
    approved 时关联 asset 的 status 会被置为 taken_down
    """

    __tablename__ = "content_takedown_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("content_assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requester_type: Mapped[str] = mapped_column(String(20), nullable=False)
    requester_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    requester_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    requester_contact: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), server_default="pending", nullable=False, index=True
    )
    reviewer_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<ContentTakedownRequest id={self.id} asset_id={self.asset_id} "
            f"status={self.status}>"
        )
