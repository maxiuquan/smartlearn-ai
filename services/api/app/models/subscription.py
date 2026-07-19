"""Subscription ORM model — 用户会员订阅计划."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Subscription(Base):
    """订阅计划表。

    plan: free / basic / premium / ultimate
    status: active / expired / cancelled
    ai_quota_daily: 该计划每日 AI 调用配额（用户实际配额 = ai_quota_daily_override or 此值）
    """

    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan: Mapped[str] = mapped_column(String(50), server_default="free", nullable=False)
    status: Mapped[str] = mapped_column(String(20), server_default="active", nullable=False)
    start_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ai_quota_daily: Mapped[int] = mapped_column(Integer, server_default="10", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<Subscription id={self.id} user_id={self.user_id} plan={self.plan}>"
