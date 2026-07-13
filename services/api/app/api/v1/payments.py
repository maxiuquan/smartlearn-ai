"""支付 API 路由 (P1-4).

- 用户: 创建/查看/关闭自己的订单
- 管理员: 退款/对账/全量订单列表
- 回调: 微信/支付宝 webhook（无鉴权，验签由 service 处理，当前为占位）
"""
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_current_user, get_db
from app.models.user import User
from app.schemas.payment import (
    CallbackPayload,
    CreateOrderRequest,
    OrderListResponse,
    OrderResponse,
    RefundRequest,
)
from app.services.payment_service import payment_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/orders",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建支付订单",
)
async def create_order(
    body: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> OrderResponse:
    """创建订单（已登录用户）。

    统一 SDK 下单（微信/支付宝预下单生成支付参数）由调用方在拿到订单后接入，
    本接口仅落账务记录 + Outbox(order.created)。
    """
    try:
        order = await payment_service.create_order(
            db,
            user_id=current.id,
            channel=body.channel,
            product_type=body.product_type,
            product_snapshot=body.product_snapshot,
            amount_cents=body.amount_cents,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    await db.commit()
    await db.refresh(order)
    return order


@router.get(
    "/orders",
    response_model=OrderListResponse,
    summary="我的订单列表",
)
async def list_my_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> OrderListResponse:
    """已登录用户查看自己的订单（仅自己的）。"""
    return await payment_service.list_orders(
        db,
        user_id=current.id,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/orders/{order_id}",
    response_model=OrderResponse,
    summary="订单详情",
)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> OrderResponse:
    try:
        order = await payment_service.get_order(db, order_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    if order.user_id != current.id and not current.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权查看他人订单"
        )
    return order


@router.post(
    "/orders/{order_id}/close",
    response_model=OrderResponse,
    summary="关闭未支付订单",
)
async def close_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> OrderResponse:
    """关闭未支付订单（用户自己或管理员）。"""
    try:
        order = await payment_service.get_order(db, order_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    if order.user_id != current.id and not current.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权操作他人订单"
        )
    try:
        order = await payment_service.close_order(db, order_id, operator_id=current.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    await db.commit()
    await db.refresh(order)
    return order


@router.post(
    "/orders/{order_id}/refund",
    response_model=OrderResponse,
    summary="退款（管理员）",
)
async def refund_order(
    order_id: int,
    body: RefundRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> OrderResponse:
    """退款（仅管理员）。"""
    try:
        order = await payment_service.refund_order(
            db,
            order_id=order_id,
            refund_amount_cents=body.refund_amount_cents,
            reason=body.reason,
            operator_id=admin.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    await db.commit()
    await db.refresh(order)
    return order


@router.get(
    "/admin/orders",
    response_model=OrderListResponse,
    summary="管理员订单列表",
)
async def admin_list_orders(
    user_id: Optional[int] = Query(None, description="按用户筛选"),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> OrderListResponse:
    """管理员查看全量订单（可按 user_id / status 筛选）。"""
    return await payment_service.list_orders(
        db,
        user_id=user_id,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/callbacks/wechat",
    summary="微信支付回调",
)
async def wechat_callback(
    payload: CallbackPayload,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """微信支付回调（无鉴权，验签由 service 处理）。

    真实接入需解析微信 XML/JSON 报文并校验签名，当前以通用 dict 载荷传入。
    """
    return await _handle_callback("wechat", payload, db)


@router.post(
    "/callbacks/alipay",
    summary="支付宝回调",
)
async def alipay_callback(
    payload: CallbackPayload,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """支付宝回调（无鉴权，验签由 service 处理）。

    真实接入需解析支付宝表单报文并校验签名，当前以通用 dict 载荷传入。
    """
    return await _handle_callback("alipay", payload, db)


@router.post(
    "/admin/reconcile",
    summary="对账（管理员）",
)
async def admin_reconcile(
    date: Optional[str] = Query(None, description="对账日期 YYYY-MM-DD，默认当前"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> dict:
    """对账：三方已支付未发权益等异常告警。"""
    parsed_date: Optional[datetime] = None
    if date:
        try:
            parsed_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date 格式应为 YYYY-MM-DD",
            )
    return await payment_service.admin_reconcile(db, date=parsed_date)


# ── P1-4.9: Outbox 管理端点 ──


@router.get(
    "/admin/outbox/stats",
    summary="Outbox 统计（管理员）",
)
async def outbox_stats(
    admin: User = Depends(get_current_admin_user),
) -> dict:
    """P1-4.9: 查看 Outbox 投递状态统计（pending/processing/sent/dead 计数 + 延迟监控）。"""
    from app.services.outbox_dispatcher import get_outbox_stats
    return await get_outbox_stats()


@router.post(
    "/admin/outbox/{event_id}/replay",
    summary="人工重放 Outbox 事件（管理员）",
)
async def outbox_replay(
    event_id: int,
    admin: User = Depends(get_current_admin_user),
) -> dict:
    """P1-4.9: 人工重放 DLQ 中的事件（将 status=dead 重置为 pending）。"""
    from app.services.outbox_dispatcher import replay_event
    ok = await replay_event(event_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"事件 {event_id} 不存在或当前状态不可重放（仅 dead/failed 可重放）",
        )
    return {"message": f"事件 {event_id} 已重置为 pending，将在下次 dispatcher 执行时重投"}


@router.get(
    "/admin/subscription-ledger/{user_id}",
    summary="查看用户权益账本（管理员）",
)
async def view_subscription_ledger(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> dict:
    """P1-4.9: 查看用户的所有权益变更历史（不可变账本）。"""
    from sqlalchemy import select
    from app.models.subscription_ledger import SubscriptionLedger

    result = await db.execute(
        select(SubscriptionLedger)
        .where(SubscriptionLedger.user_id == user_id)
        .order_by(SubscriptionLedger.created_at.desc())
        .limit(100)
    )
    items = result.scalars().all()
    return {
        "user_id": user_id,
        "count": len(items),
        "items": [
            {
                "id": i.id,
                "event_type": i.event_type,
                "plan_from": i.plan_from,
                "plan_to": i.plan_to,
                "quota_daily_from": i.quota_daily_from,
                "quota_daily_to": i.quota_daily_to,
                "source": i.source,
                "order_id": i.order_id,
                "created_at": i.created_at.isoformat() if i.created_at else None,
                "start_at": i.start_at.isoformat() if i.start_at else None,
                "end_at": i.end_at.isoformat() if i.end_at else None,
            }
            for i in items
        ],
    }


async def _handle_callback(
    channel: str, payload: CallbackPayload, db: AsyncSession
) -> dict:
    """统一处理微信/支付宝回调：提取字段 + 调用 service + 事务提交。"""
    order_no = payload.order_no or payload.out_trade_no
    trade_no = payload.transaction_id or payload.trade_no
    amount_cents = (
        payload.amount_cents
        if payload.amount_cents is not None
        else payload.total_fee
    )
    if not order_no or not trade_no or amount_cents is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "回调缺少必要字段: 需要 order_no/out_trade_no, "
                "transaction_id/trade_no, amount_cents/total_fee"
            ),
        )
    callback_raw = json.dumps(payload.model_dump(), ensure_ascii=False, default=str)
    # 验签占位: 真实接入需用各渠道 SDK/公钥校验签名，此处先标记为 True
    signature_valid = True
    try:
        order = await payment_service.handle_pay_callback(
            db,
            channel=channel,
            order_no=order_no,
            third_party_trade_no=trade_no,
            callback_raw=callback_raw,
            signature_valid=signature_valid,
            amount_cents=amount_cents,
        )
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    await db.commit()
    await db.refresh(order)
    return {
        "code": "SUCCESS",
        "message": "OK",
        "order_no": order.order_no,
        "status": order.status,
    }
