"""SubscriptionLedger ORM model — 不可变订阅权益账本 (P1-4.9).

每条记录代表一次权益变更（授予/续期/撤销/部分撤销/升降级），
与 Subscription 形成"current state + immutable history"模式：
- Subscription 表保存当前生效的订阅（可变）
- SubscriptionLedger 表保存所有历史变更（append-only）

所有金额、配额、时间窗口的审计与对账以 ledger 为准。
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SubscriptionLedger(Base):
    """订阅权益账本（不可变）。

    event_type: grant / renew / revoke / partial_revoke / upgrade / downgrade
    plan_from / plan_to: 变更前后的套餐
    quota_daily_from / quota_daily_to: 变更前后的每日 AI 配额
    source: 触发来源（order:42 / admin:7 / refund:55 / system）
    order_id: 关联订单（可空，如管理员手动调整则无订单）
    snapshot_json: 变更快照（金额/周期/原因等，用于审计与对账）
    """

    __tablename__ = "subscription_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subscription_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    plan_from: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    plan_to: Mapped[str] = mapped_column(String(50), nullable=False)
    quota_daily_from: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quota_daily_to: Mapped[int] = mapped_column(Integer, nullable=False)
    start_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    order_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    snapshot_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<SubscriptionLedger id={self.id} user_id={self.user_id} "
            f"event={self.event_type} plan={self.plan_from}->{self.plan_to}>"
        )
