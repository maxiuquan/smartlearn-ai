"""支付账务服务 — 订单状态机 + 事务性 Outbox (P1-4).

职责:
- 创建订单 + OrderEvent(create) + Outbox(order.created) 同事务写入
- 处理支付回调: 验签校验(渠道/金额/状态) + 幂等(已 paid 直接返回) + 状态机 created->paid
  + 发放权益(更新 Subscription + 写 SubscriptionLedger) + OrderEvent(pay_callback)
  + Outbox(order.paid, subscription.activated)
- 关闭未支付订单 / 退款状态机
- 退款权益策略（P1-4.9）: 全退撤销权益 / 部分退按时间折算保留
- 对账(三方已支付未发权益告警)

P1-4.9 整改:
- 订单号改用 secrets.token_hex 加密随机（替代 random.choices）
- 权益变更写入 SubscriptionLedger（不可变账本）
- 全额退款撤销订阅权益；部分退款按比例保留（写 ledger 记录）
- Outbox dispatcher 由独立后台任务处理（见 outbox_dispatcher.py）

不实际调用微信/支付宝 SDK；状态机与账务记录完整，SDK 接入后替换回调验签占位即可。
所有写操作在同一事务内（flush 取 id），commit 由调用方（路由层）控制。
"""
from __future__ import annotations

import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderEvent, OutboxEvent
from app.models.subscription import Subscription
from app.models.subscription_ledger import SubscriptionLedger
from app.services.feature_flags import is_alipay_enabled, is_wechat_pay_enabled

logger = logging.getLogger(__name__)


class FeatureNotEnabledError(RuntimeError):
    """可选功能未配置时调用具体业务方法抛出."""

    def __init__(self, feature: str, message: Optional[str] = None):
        self.feature = feature
        super().__init__(message or f"功能未启用：{feature}（请在 .env 配置相应凭证）")


# ── 套餐 -> 每日 AI 配额 ──
PLAN_QUOTA: dict[str, int] = {
    "free": 10,
    "basic": 50,
    "premium": 200,
    "ultimate": 1000,
}

# ── 周期 -> 天数 ──
PERIOD_DAYS: dict[str, int] = {
    "weekly": 7,
    "monthly": 30,
    "quarterly": 90,
    "yearly": 365,
}

VALID_CHANNELS = {"wechat", "alipay"}
VALID_PRODUCT_TYPES = {"subscription", "credits", "package"}

# 订单状态机常量
ORDER_STATUS_CREATED = "created"
ORDER_STATUS_PAID = "paid"
ORDER_STATUS_CLOSED = "closed"
ORDER_STATUS_REFUND_PENDING = "refund_pending"
ORDER_STATUS_REFUNDED = "refunded"
ORDER_STATUS_FAILED = "failed"


def _utcnow() -> datetime:
    """当前 UTC 时间（naive，匹配 TIMESTAMP WITHOUT TIME ZONE 列）。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PaymentService:
    """支付账务服务聚合.

    状态机:
      created -> paid            (handle_pay_callback)
      created -> closed          (close_order)
      created -> failed          (超时，本服务不主动触发)
      paid    -> refunded        (refund_order 全额)
      paid    -> refund_pending  (refund_order 部分/异步占位)
    """

    # ── 功能开关（兼容 system.py / feature_flags）──
    @property
    def is_enabled(self) -> bool:
        return is_wechat_pay_enabled() or is_alipay_enabled()

    @property
    def wechat_enabled(self) -> bool:
        return is_wechat_pay_enabled()

    @property
    def alipay_enabled(self) -> bool:
        return is_alipay_enabled()

    def status(self) -> dict[str, Any]:
        return {
            "enabled": self.is_enabled,
            "wechat": {"enabled": self.wechat_enabled},
            "alipay": {"enabled": self.alipay_enabled},
        }

    # ── 内部工具 ──
    @staticmethod
    def _gen_order_no() -> str:
        """P1-4.9: 生成商户订单号 — 加密随机，唯一性由数据库唯一约束保证.

        格式: SL + 14位UTC时间戳 + 16位 hex（secrets.token_hex(8)）
        总长 32 字符，可排序（时间前缀），随机性由 secrets 保证。
        """
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        rand = secrets.token_hex(8)  # 16 个 hex 字符，128-bit 熵
        return f"SL{ts}{rand}"

    @staticmethod
    def _dump(obj: Any) -> str:
        return json.dumps(obj, ensure_ascii=False, sort_keys=True, default=str)

    @staticmethod
    def _parse_snapshot(raw: "str | dict | None") -> dict:
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str) and raw:
            try:
                return json.loads(raw)
            except Exception:
                return {"raw": raw}
        return {}

    @staticmethod
    def _period_days(snapshot: dict) -> int:
        period = snapshot.get("period")
        if isinstance(period, str) and period in PERIOD_DAYS:
            return PERIOD_DAYS[period]
        pdays = snapshot.get("period_days")
        if isinstance(pdays, int) and pdays > 0:
            return pdays
        if isinstance(period, str) and period.isdigit():
            return int(period)
        return 30

    @staticmethod
    def _quota_for_plan(plan: str) -> int:
        return PLAN_QUOTA.get(plan, PLAN_QUOTA["free"])

    @staticmethod
    def _add_event(
        db: AsyncSession,
        *,
        order_id: int,
        from_status: Optional[str],
        to_status: str,
        event_type: str,
        operator_id: Optional[int] = None,
        note: Optional[str] = None,
    ) -> OrderEvent:
        ev = OrderEvent(
            order_id=order_id,
            from_status=from_status,
            to_status=to_status,
            event_type=event_type,
            operator_id=operator_id,
            note=note,
        )
        db.add(ev)
        return ev

    @staticmethod
    def _add_outbox(
        db: AsyncSession,
        *,
        aggregate_type: str,
        aggregate_id: int,
        event_type: str,
        payload: dict,
    ) -> OutboxEvent:
        ev = OutboxEvent(
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            event_type=event_type,
            payload=PaymentService._dump(payload),
            status="pending",
        )
        db.add(ev)
        return ev

    # ── 业务方法 ──

    async def create_order(
        self,
        db: AsyncSession,
        user_id: int,
        channel: str,
        product_type: str,
        product_snapshot: dict,
        amount_cents: int,
    ) -> Order:
        """创建订单 + OrderEvent(create) + Outbox(order.created) 同事务.

        统一 SDK 下单（微信/支付宝预下单）不在本方法实现，由调用方在拿到订单后
        调用各渠道 SDK 生成支付参数；本方法仅负责账务记录完整。
        """
        if channel not in VALID_CHANNELS:
            raise ValueError(f"不支持的支付渠道: {channel}")
        if product_type not in VALID_PRODUCT_TYPES:
            raise ValueError(f"不支持的商品类型: {product_type}")
        if amount_cents <= 0:
            raise ValueError("amount_cents 必须大于 0")

        snapshot_json = self._dump(product_snapshot)
        order = Order(
            order_no=self._gen_order_no(),
            user_id=user_id,
            channel=channel,
            product_type=product_type,
            product_snapshot=snapshot_json,
            amount_cents=amount_cents,
            currency="CNY",
            status=ORDER_STATUS_CREATED,
        )
        db.add(order)
        await db.flush()  # 获取 order.id

        self._add_event(
            db,
            order_id=order.id,
            from_status=None,
            to_status=ORDER_STATUS_CREATED,
            event_type="create",
            note=f"channel={channel}, product_type={product_type}, amount={amount_cents}",
        )
        self._add_outbox(
            db,
            aggregate_type="order",
            aggregate_id=order.id,
            event_type="order.created",
            payload={
                "order_id": order.id,
                "order_no": order.order_no,
                "user_id": user_id,
                "channel": channel,
                "product_type": product_type,
                "amount_cents": amount_cents,
            },
        )
        await db.flush()
        return order

    async def handle_pay_callback(
        self,
        db: AsyncSession,
        channel: str,
        order_no: str,
        third_party_trade_no: str,
        callback_raw: str,
        signature_valid: bool,
        amount_cents: int,
        notification_id: str = "",
    ) -> Order:
        """处理支付回调: 验签校验 + 幂等 + 状态机 created->paid + 发放权益 + Outbox.

        幂等: 订单已 paid 时直接返回，不重复发放权益（仅补记一条事件）。
        行锁 SELECT ... FOR UPDATE 保证并发回调串行化。

        P0-04: signature_valid=False 时 fail-closed，拒绝入账。
        """
        # P0-04: 验签失败直接拒绝，不得入账
        if not signature_valid:
            raise ValueError(
                "支付签名验证失败，拒绝入账（signature_valid=False）"
            )

        result = await db.execute(
            select(Order).where(Order.order_no == order_no).with_for_update()
        )
        order = result.scalar_one_or_none()
        if order is None:
            raise ValueError(f"订单不存在: {order_no}")

        # 幂等: 已支付直接返回（不重复发权益）
        if order.status == ORDER_STATUS_PAID:
            self._add_event(
                db,
                order_id=order.id,
                from_status=ORDER_STATUS_PAID,
                to_status=ORDER_STATUS_PAID,
                event_type="pay_callback",
                note="幂等:重复回调,订单已支付,跳过权益发放",
            )
            await db.flush()
            return order

        # 校验状态
        if order.status != ORDER_STATUS_CREATED:
            raise ValueError(
                f"订单当前状态 {order.status} 不可支付,仅 created 可流转至 paid"
            )

        # 验签校验: 渠道一致
        if order.channel != channel:
            raise ValueError(f"渠道不匹配: 期望 {order.channel}, 收到 {channel}")
        # 金额校验（分）
        if amount_cents != order.amount_cents:
            raise ValueError(
                f"金额不匹配: 期望 {order.amount_cents} 分, 收到 {amount_cents} 分"
            )

        # 状态机: created -> paid
        prev = order.status
        order.status = ORDER_STATUS_PAID
        order.third_party_trade_no = third_party_trade_no
        # P0-02 (R5): 记录支付平台通知 ID
        if notification_id:
            order.notification_id = notification_id
        order.callback_raw = callback_raw
        order.signature_valid = signature_valid
        order.paid_at = _utcnow()

        self._add_event(
            db,
            order_id=order.id,
            from_status=prev,
            to_status=ORDER_STATUS_PAID,
            event_type="pay_callback",
            note=f"trade_no={third_party_trade_no}, signature_valid={signature_valid}",
        )

        # 发放权益: 创建/更新 Subscription
        subscription = await self._grant_subscription(db, order)

        self._add_outbox(
            db,
            aggregate_type="order",
            aggregate_id=order.id,
            event_type="order.paid",
            payload={
                "order_id": order.id,
                "order_no": order.order_no,
                "user_id": order.user_id,
                "amount_cents": order.amount_cents,
                "channel": order.channel,
                "third_party_trade_no": third_party_trade_no,
            },
        )
        self._add_outbox(
            db,
            aggregate_type="subscription",
            aggregate_id=subscription.id,
            event_type="subscription.activated",
            payload={
                "subscription_id": subscription.id,
                "user_id": subscription.user_id,
                "plan": subscription.plan,
                "start_at": subscription.start_at.isoformat()
                if subscription.start_at
                else None,
                "end_at": subscription.end_at.isoformat()
                if subscription.end_at
                else None,
                "ai_quota_daily": subscription.ai_quota_daily,
                "order_id": order.id,
            },
        )
        await db.flush()
        return order

    async def _grant_subscription(self, db: AsyncSession, order: Order) -> Subscription:
        """根据订单 product_snapshot 发放/续期订阅权益.

        - 无订阅: 创建新 Subscription
        - 已有且未过期: 在原 end_at 基础上续期累加
        - 已有但已过期: 从当前时间起算

        P1-4.9: 每次权益变更写入 SubscriptionLedger（不可变账本）。
        """
        snapshot = self._parse_snapshot(order.product_snapshot)
        plan = str(snapshot.get("plan", "free")).lower()
        days = self._period_days(snapshot)
        quota = self._quota_for_plan(plan)
        now = _utcnow()
        end_at = now + timedelta(days=days)

        result = await db.execute(
            select(Subscription)
            .where(Subscription.user_id == order.user_id)
            .with_for_update()
        )
        sub = result.scalar_one_or_none()
        if sub is None:
            # 新建订阅
            sub = Subscription(
                user_id=order.user_id,
                plan=plan,
                status="active",
                start_at=now,
                end_at=end_at,
                ai_quota_daily=quota,
            )
            db.add(sub)
            await db.flush()
            # P1-4.9: 写入 ledger（grant 事件）
            ledger = SubscriptionLedger(
                user_id=order.user_id,
                subscription_id=sub.id,
                event_type="grant",
                plan_from=None,
                plan_to=plan,
                quota_daily_from=None,
                quota_daily_to=quota,
                start_at=now,
                end_at=end_at,
                source=f"order:{order.id}",
                order_id=order.id,
                snapshot_json=self._dump(
                    {
                        "order_no": order.order_no,
                        "amount_cents": order.amount_cents,
                        "period_days": days,
                        "snapshot": snapshot,
                    }
                ),
            )
            db.add(ledger)
        else:
            # 续期 / 升降级
            base = sub.end_at if (sub.end_at is not None and sub.end_at > now) else now
            old_plan = sub.plan
            old_quota = sub.ai_quota_daily
            old_end = sub.end_at
            new_end = base + timedelta(days=days)

            # 判断事件类型
            if old_plan == plan:
                event_type = "renew"
            elif PLAN_QUOTA.get(plan, 0) > PLAN_QUOTA.get(old_plan, 0):
                event_type = "upgrade"
            else:
                event_type = "downgrade"

            sub.plan = plan
            sub.status = "active"
            sub.start_at = now
            sub.end_at = new_end
            sub.ai_quota_daily = quota

            # P1-4.9: 写入 ledger
            ledger = SubscriptionLedger(
                user_id=order.user_id,
                subscription_id=sub.id,
                event_type=event_type,
                plan_from=old_plan,
                plan_to=plan,
                quota_daily_from=old_quota,
                quota_daily_to=quota,
                start_at=now,
                end_at=new_end,
                source=f"order:{order.id}",
                order_id=order.id,
                snapshot_json=self._dump(
                    {
                        "order_no": order.order_no,
                        "amount_cents": order.amount_cents,
                        "period_days": days,
                        "prev_end_at": old_end.isoformat() if old_end else None,
                        "new_end_at": new_end.isoformat(),
                        "snapshot": snapshot,
                    }
                ),
            )
            db.add(ledger)
        await db.flush()
        return sub

    async def close_order(
        self, db: AsyncSession, order_id: int, operator_id: Optional[int]
    ) -> Order:
        """关闭未支付订单: created -> closed."""
        result = await db.execute(
            select(Order).where(Order.id == order_id).with_for_update()
        )
        order = result.scalar_one_or_none()
        if order is None:
            raise ValueError(f"订单不存在: {order_id}")
        if order.status != ORDER_STATUS_CREATED:
            raise ValueError(f"仅未支付订单可关闭,当前状态: {order.status}")

        prev = order.status
        order.status = ORDER_STATUS_CLOSED
        self._add_event(
            db,
            order_id=order.id,
            from_status=prev,
            to_status=ORDER_STATUS_CLOSED,
            event_type="close",
            operator_id=operator_id,
            note="用户/管理员关闭未支付订单",
        )
        await db.flush()
        return order

    async def refund_order(
        self,
        db: AsyncSession,
        order_id: int,
        refund_amount_cents: int,
        reason: str,
        operator_id: Optional[int],
    ) -> Order:
        """退款状态机: paid -> refunded(全额) / paid -> refund_pending(部分/异步).

        P1-4.9 退款权益策略:
        - 全额退款（refund_amount == amount）: 撤销订阅权益
            * status=cancelled, end_at=now
            * 写入 SubscriptionLedger revoke 事件
            * 写入 Outbox subscription.revoked
        - 部分退款: 不强制撤销权益，仅记录到 ledger（partial_revoke 事件）
            * 按 refund/amount 比例折算剩余配额（快照记录，不立即裁剪）
            * 真实 SDK 异步回调完成后由专门流程处理
        """
        result = await db.execute(
            select(Order).where(Order.id == order_id).with_for_update()
        )
        order = result.scalar_one_or_none()
        if order is None:
            raise ValueError(f"订单不存在: {order_id}")
        if order.status != ORDER_STATUS_PAID:
            raise ValueError(f"仅已支付订单可退款,当前状态: {order.status}")
        if refund_amount_cents <= 0 or refund_amount_cents > order.amount_cents:
            raise ValueError(
                f"退款金额非法: {refund_amount_cents}, 订单金额: {order.amount_cents}"
            )

        prev = order.status
        is_full_refund = refund_amount_cents == order.amount_cents
        if is_full_refund:
            order.status = ORDER_STATUS_REFUNDED
            to_status = ORDER_STATUS_REFUNDED
            order.refunded_at = _utcnow()
        else:
            # 部分退款: 标记 refund_pending（真实 SDK 异步回调完成后置为 refunded）
            order.status = ORDER_STATUS_REFUND_PENDING
            to_status = ORDER_STATUS_REFUND_PENDING
        order.refund_amount_cents = refund_amount_cents
        order.refund_reason = reason

        self._add_event(
            db,
            order_id=order.id,
            from_status=prev,
            to_status=to_status,
            event_type="refund",
            operator_id=operator_id,
            note=f"refund_amount={refund_amount_cents}, reason={reason}, full={is_full_refund}",
        )

        # P1-4.9: 退款权益处理
        await self._handle_refund_entitlement(
            db, order, refund_amount_cents, is_full_refund, reason, operator_id
        )

        self._add_outbox(
            db,
            aggregate_type="order",
            aggregate_id=order.id,
            event_type="order.refunded",
            payload={
                "order_id": order.id,
                "order_no": order.order_no,
                "refund_amount_cents": refund_amount_cents,
                "reason": reason,
                "operator_id": operator_id,
                "to_status": to_status,
                "full_refund": is_full_refund,
            },
        )
        await db.flush()
        return order

    async def _handle_refund_entitlement(
        self,
        db: AsyncSession,
        order: Order,
        refund_amount_cents: int,
        is_full_refund: bool,
        reason: str,
        operator_id: Optional[int],
    ) -> None:
        """P1-4.9: 退款时的权益处理.

        - 全额退款: 撤销订阅（status=cancelled, end_at=now）
        - 部分退款: 不撤销，仅写 ledger 记录折算比例
        """
        # 查找该订单关联的订阅
        result = await db.execute(
            select(Subscription)
            .where(Subscription.user_id == order.user_id)
            .with_for_update()
        )
        sub = result.scalar_one_or_none()
        if sub is None:
            # 无订阅记录（可能是非 subscription 类型订单），跳过
            return

        now = _utcnow()
        snapshot = self._parse_snapshot(order.product_snapshot)

        if is_full_refund:
            # 全额退款：撤销权益
            old_plan = sub.plan
            old_quota = sub.ai_quota_daily
            old_end = sub.end_at

            sub.status = "cancelled"
            sub.end_at = now

            # 写入 ledger
            ledger = SubscriptionLedger(
                user_id=order.user_id,
                subscription_id=sub.id,
                event_type="revoke",
                plan_from=old_plan,
                plan_to="free",
                quota_daily_from=old_quota,
                quota_daily_to=0,
                start_at=sub.start_at,
                end_at=now,
                source=f"refund:{order.id}",
                order_id=order.id,
                snapshot_json=self._dump(
                    {
                        "order_no": order.order_no,
                        "refund_amount_cents": refund_amount_cents,
                        "reason": reason,
                        "operator_id": operator_id,
                        "prev_end_at": old_end.isoformat() if old_end else None,
                        "snapshot": snapshot,
                    }
                ),
            )
            db.add(ledger)

            # 写入 Outbox
            self._add_outbox(
                db,
                aggregate_type="subscription",
                aggregate_id=sub.id,
                event_type="subscription.revoked",
                payload={
                    "subscription_id": sub.id,
                    "user_id": order.user_id,
                    "order_id": order.id,
                    "reason": reason,
                    "revoked_at": now.isoformat(),
                },
            )
        else:
            # 部分退款：不撤销，仅记录折算比例
            ratio = refund_amount_cents / order.amount_cents
            ledger = SubscriptionLedger(
                user_id=order.user_id,
                subscription_id=sub.id,
                event_type="partial_revoke",
                plan_from=sub.plan,
                plan_to=sub.plan,
                quota_daily_from=sub.ai_quota_daily,
                quota_daily_to=sub.ai_quota_daily,  # 不立即裁剪
                start_at=sub.start_at,
                end_at=sub.end_at,
                source=f"refund:{order.id}",
                order_id=order.id,
                snapshot_json=self._dump(
                    {
                        "order_no": order.order_no,
                        "refund_amount_cents": refund_amount_cents,
                        "order_amount_cents": order.amount_cents,
                        "refund_ratio": ratio,
                        "reason": reason,
                        "operator_id": operator_id,
                        "note": "partial refund; entitlement preserved, ratio recorded for audit",
                        "snapshot": snapshot,
                    }
                ),
            )
            db.add(ledger)

    async def list_orders(
        self,
        db: AsyncSession,
        user_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """分页订单列表。user_id=None 表示管理员查看全部。"""
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)
        stmt = select(Order)
        count_stmt = select(func.count()).select_from(Order)
        if user_id is not None:
            stmt = stmt.where(Order.user_id == user_id)
            count_stmt = count_stmt.where(Order.user_id == user_id)
        if status_filter:
            stmt = stmt.where(Order.status == status_filter)
            count_stmt = count_stmt.where(Order.status == status_filter)
        total = (await db.execute(count_stmt)).scalar() or 0
        stmt = (
            stmt.order_by(Order.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list((await db.execute(stmt)).scalars().all())
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_order(self, db: AsyncSession, order_id: int) -> Order:
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if order is None:
            raise ValueError(f"订单不存在: {order_id}")
        return order

    async def admin_reconcile(
        self, db: AsyncSession, date: Optional[datetime]
    ) -> dict:
        """对账: 找出已支付但权益/账务异常的订单并告警.

        告警场景:
        - status=paid 但 third_party_trade_no 为空（三方交易号缺失）
        - paid 订单对应的 Subscription 不存在或已过期
        """
        stmt = select(Order).where(Order.status == ORDER_STATUS_PAID)
        orders = list((await db.execute(stmt)).scalars().all())
        alerts: list[dict] = []
        now = _utcnow()
        for o in orders:
            if not o.third_party_trade_no:
                alerts.append(
                    {
                        "order_id": o.id,
                        "order_no": o.order_no,
                        "user_id": o.user_id,
                        "issue": "paid 但缺少三方交易号",
                    }
                )
                continue
            sub_result = await db.execute(
                select(Subscription).where(Subscription.user_id == o.user_id)
            )
            sub = sub_result.scalar_one_or_none()
            if sub is None:
                alerts.append(
                    {
                        "order_id": o.id,
                        "order_no": o.order_no,
                        "user_id": o.user_id,
                        "issue": "已支付但无订阅记录",
                    }
                )
            elif sub.end_at is not None and sub.end_at < now:
                alerts.append(
                    {
                        "order_id": o.id,
                        "order_no": o.order_no,
                        "user_id": o.user_id,
                        "issue": "订阅已过期但订单已支付",
                        "subscription_id": sub.id,
                        "end_at": sub.end_at.isoformat(),
                    }
                )
        return {
            "date": (date or now).isoformat(),
            "checked_paid_orders": len(orders),
            "alerts": alerts,
            "alert_count": len(alerts),
        }


payment_service = PaymentService()
