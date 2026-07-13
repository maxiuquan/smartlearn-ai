"""支付订单与事务性 Outbox ORM 模型 — P1-4 支付账务状态机.

Order         商户订单 + 三方交易号 + 状态机 + 回调原文/验签结果
OrderEvent    订单状态流转审计事件（每次 from->to 落一条）
OutboxEvent   事务性 Outbox，与业务变更同事务写入，由后台 worker 异步投递

datetime 列使用 TIMESTAMP WITHOUT TIME ZONE（沿用项目既有 DateTime 风格）。
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Order(Base):
    """订单表。

    status 状态机:
      created -> paid            (支付回调成功)
      created -> closed          (用户/管理员关闭未支付订单)
      created -> failed          (超时/失败，本服务不主动触发)
      paid    -> refunded        (全额退款)
      paid    -> refund_pending  (部分退款/异步退款处理中)
    """

    __tablename__ = "orders"

    # P0-02 (R4): DB 级唯一约束兜底 — Redis 故障时仍可防止重复回调处理
    __table_args__ = (
        UniqueConstraint(
            "channel", "third_party_trade_no", name="uq_order_channel_trade_no"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_no: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False)  # wechat / alipay
    product_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # subscription / credits / package
    product_snapshot: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # 商品快照 JSON: plan/amount/period/quota 等
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)  # 金额（分）
    currency: Mapped[str] = mapped_column(
        String(10), server_default="CNY", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), server_default="created", nullable=False, index=True
    )  # created/paid/closed/refunded/refund_pending/failed
    third_party_trade_no: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, index=True
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    refunded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    refund_amount_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    refund_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    callback_raw: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # 回调原文（JSON）
    signature_valid: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Order id={self.id} order_no={self.order_no} status={self.status}>"


class OrderEvent(Base):
    """订单状态流转事件审计。"""

    __tablename__ = "order_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    event_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # create/pay_callback/close/refund/refund_callback/admin_op
    operator_id: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )  # 操作人（admin 时）
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<OrderEvent order_id={self.order_id} {self.from_status}->{self.to_status}>"


class OutboxEvent(Base):
    """事务性 Outbox — 与业务变更同事务写入，由后台 worker 异步投递。

    status: pending / processing / sent / failed / dead
    """

    __tablename__ = "outbox_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    aggregate_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # order / subscription
    aggregate_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # order.paid / order.refunded / subscription.activated
    payload: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    status: Mapped[str] = mapped_column(
        String(20), server_default="pending", nullable=False, index=True
    )
    retry_count: Mapped[int] = mapped_column(
        Integer, server_default="0", nullable=False
    )
    max_retry: Mapped[int] = mapped_column(
        Integer, server_default="5", nullable=False
    )
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_retry_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<OutboxEvent id={self.id} {self.event_type} status={self.status}>"
