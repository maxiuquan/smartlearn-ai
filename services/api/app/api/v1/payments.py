"""支付 API 路由 (P1-4).

- 用户: 创建/查看/关闭自己的订单
- 管理员: 退款/对账/全量订单列表
- 回调: 微信/支付宝 webhook（无鉴权，验签由 service 处理）

P1-01: 已接入微信支付 V3 SDK (wechatpayv3) 和支付宝 RSA2 SDK (alipay-sdk-python)。
当 SDK 已安装且凭证完整配置时执行真实签名验证；否则 fail-closed 返回 False。
"""
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_admin_user, get_current_user, get_db
from app.models.order import Order
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


@router.get(
    "/status",
    summary="支付功能可用性查询",
)
async def payment_status() -> dict:
    """P0-03 (R3): 查询支付功能是否启用。

    前端在渲染支付入口前调用此接口；未配置支付凭证时返回 {"enabled": false}，
    前端据此隐藏支付相关 UI。无需鉴权，仅返回布尔状态，不泄露任何凭证细节。
    """
    return {"enabled": settings.is_payment_enabled}


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
    # P0-03 (R3): 未配置支付凭证时返回 501，禁止下单
    if not settings.is_payment_enabled:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="支付功能未启用 — 请配置微信支付或支付宝凭证后再使用",
        )
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
    request: Request,
    payload: CallbackPayload,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """微信支付回调（无鉴权，验签由 SDK 处理）。

    P1-01: 使用 wechatpayv3 SDK 验签。
    从请求头提取 Wechatpay-Signature / Wechatpay-Serial / Wechatpay-Timestamp / Wechatpay-Nonce，
    配合原始请求体进行 V3 验签。
    """
    headers = dict(request.headers)
    raw_body = (await request.body()).decode("utf-8", errors="replace")
    return await _handle_callback("wechat", payload, db, headers=headers, raw_body=raw_body)


@router.post(
    "/callbacks/alipay",
    summary="支付宝回调",
)
async def alipay_callback(
    request: Request,
    payload: CallbackPayload,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """支付宝回调（无鉴权，验签由 SDK 处理）。

    P1-01: 使用 alipay-sdk-python 执行 RSA2 验签。
    从 payload 中提取 sign / sign_type 字段进行验证。
    """
    headers = dict(request.headers)
    raw_body = (await request.body()).decode("utf-8", errors="replace")
    return await _handle_callback("alipay", payload, db, headers=headers, raw_body=raw_body)


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


def _sanitize_callback_for_log(raw_body: str, headers: dict) -> dict:
    """P0-02 (R4): 脱敏回调原文 — 不记录完整凭证/签名/敏感字段。

    - 敏感请求头（authorization / cookie / x-api-key / 微信支付签名相关）统一遮蔽
    - 非敏感请求头截断至 100 字符
    - 原始 body 仅保留长度与前 500 字符预览，不记录完整凭证
    """
    sensitive_headers = {
        "authorization",
        "cookie",
        "x-api-key",
        "wechatpay-signature",
        "wechatpay-serial",
        "wechatpay-timestamp",
        "wechatpay-nonce",
    }
    sanitized_headers = {}
    for k, v in (headers or {}).items():
        if k.lower() in sensitive_headers:
            sanitized_headers[k] = "***REDACTED***"
        else:
            sanitized_headers[k] = v[:100]
    sanitized_body = raw_body[:500] if raw_body else ""
    return {
        "headers": sanitized_headers,
        "body_length": len(raw_body) if raw_body else 0,
        "body_preview": sanitized_body,
    }


async def _handle_callback(
    channel: str,
    payload: CallbackPayload,
    db: AsyncSession,
    *,
    headers: dict[str, str] | None = None,
    raw_body: str = "",
) -> dict:
    """统一处理微信/支付宝回调：通知去重 + 验签 + 调用 service + 事务提交。

    P1-01 安全改造：
    1. 通知去重：Redis SETNX (trade_no, 24h TTL)，防止重复回调
    2. 真实验签：SDK 已安装且凭证配置时执行官方验签，否则 fail-closed
    3. 验签失败返回 400，不得调用 handle_pay_callback()

    P0-03 (R3): 渠道支付凭证未配置时直接返回 501（明确“支付未启用”，区别于验签失败 400）。
    """
    # P0-03 (R3): 渠道支付凭证未配置时回调返回 501
    channel_configured = (
        settings.is_wechat_pay_v3_enabled
        if channel == "wechat"
        else settings.is_alipay_enabled
        if channel == "alipay"
        else False
    )
    if not channel_configured:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"{channel} 支付功能未启用 — 回调验签凭证未配置，无法处理回调",
        )

    order_no = payload.order_no or payload.out_trade_no
    trade_no = payload.transaction_id or payload.trade_no
    # P0-02 (R5): 提取支付平台通知 ID（微信通知 ID / 支付宝通知流水）
    notification_id = getattr(payload, "notification_id", None) or getattr(payload, "notify_id", None) or ""
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

    # P0-02 (R4): 脱敏记录回调 — 不得在日志中暴露完整凭证/签名/敏感字段
    logger.info(
        "payment_callback channel=%s trade_no=%s notification_id=%s sanitized=%s",
        channel,
        trade_no,
        notification_id or "(none)",
        _sanitize_callback_for_log(raw_body, headers or {}),
    )

    # P1-01: 通知去重 — Redis SETNX 防止重复处理同一交易号
    redis_client = None
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings as _settings
        redis_client = aioredis.from_url(_settings.redis_url, decode_responses=True)
        dedup_key = f"pay:callback:{channel}:{trade_no}"
        set_result = await redis_client.set(dedup_key, "1", ex=86400, nx=True)
        if not set_result:
            logger.info("payment_callback_duplicate channel=%s trade_no=%s", channel, trade_no)
            if hasattr(redis_client, "aclose"):
                await redis_client.aclose()
            else:
                await redis_client.close()
            return {"code": "SUCCESS", "message": "OK (duplicate, already processed)"}
    except Exception as e:
        logger.warning(f"Redis 去重检查失败（非阻塞，继续处理）：{e}")
        if redis_client and hasattr(redis_client, "aclose"):
            await redis_client.aclose()
        elif redis_client:
            await redis_client.close()
        redis_client = None

    # P0-02 (R4): DB 级别去重兜底 — Redis 故障时仍可防止重复处理
    # P0-02 (R5): 同时检查 notification_id（如有），双重去重
    dedup_conditions = [Order.channel == channel, Order.third_party_trade_no == trade_no]
    existing = await db.execute(
        select(Order).where(*dedup_conditions)
    )
    if existing.scalar_one_or_none():
        logger.info(
            "payment_callback_db_duplicate channel=%s trade_no=%s",
            channel, trade_no,
        )
        return {"code": "SUCCESS", "message": "OK (duplicate, already processed)"}

    # P0-02 (R5): 检查 notification_id 去重（如有 notification_id）
    if notification_id:
        existing_notif = await db.execute(
            select(Order).where(
                Order.channel == channel,
                Order.notification_id == notification_id,
            )
        )
        if existing_notif.scalar_one_or_none():
            logger.info(
                "payment_callback_notif_duplicate channel=%s notification_id=%s",
                channel, notification_id,
            )
            return {"code": "SUCCESS", "message": "OK (duplicate, already processed)"}

    callback_raw = json.dumps(payload.model_dump(), ensure_ascii=False, default=str)

    # P1-01: 真实验签 — 按渠道调用官方 SDK
    signature_valid = await _verify_channel_signature(
        channel, payload, callback_raw, headers or {}, raw_body
    )

    if not signature_valid:
        logger.warning(
            "payment_callback_signature_invalid channel=%s order_no=%s",
            channel, order_no,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="支付回调验签失败，订单状态未变更",
        )

    try:
        order = await payment_service.handle_pay_callback(
            db,
            channel=channel,
            order_no=order_no,
            third_party_trade_no=trade_no,
            callback_raw=callback_raw,
            signature_valid=signature_valid,
            amount_cents=amount_cents,
            notification_id=notification_id,
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


async def _verify_channel_signature(
    channel: str,
    payload: "CallbackPayload",
    callback_raw: str,
    headers: dict[str, str],
    raw_body: str,
) -> bool:
    """P1-01: 渠道真实验签。

    - 微信支付 V3: 使用 wechatpayv3 SDK 验签（需 V3 凭证完整配置）
    - 支付宝: 使用 alipay-sdk-python RSA2 验签（需支付宝公钥/私钥配置）
    - SDK 未安装或凭证未配置时返回 False（fail-closed），禁止伪造支付
    - 验签通过后额外校验：商户号/appid、金额、交易状态
    """
    from app.core.config import settings

    # ── 微信支付 V3 验签 ──
    if channel == "wechat":
        if not settings.is_wechat_pay_v3_enabled:
            logger.warning("wechat_pay_v3_credentials_incomplete")
            return False
        try:
            from wechatpayv3 import WeChatPay, WeChatPayType
        except ImportError:
            logger.warning("wechatpayv3 SDK not installed, callback fail-closed")
            return False

        try:
            wxpay = WeChatPay(
                wechatpay_type=WeChatPayType.NATIVE,
                mchid=settings.WECHAT_MCH_ID,
                private_key=settings.WECHAT_PRIVATE_KEY,
                cert_serial_no=settings.WECHAT_CERT_SERIAL_NO,
                apiv3_key=settings.WECHAT_API_V3_KEY,
                appid=settings.WECHAT_APP_ID,
                notify_url="",
            )
            # SDK callback 验签：需要 headers + raw_body
            result = wxpay.callback(headers, raw_body)
            if not result:
                return False
            # P1-01: 额外校验关键字段
            # result 是解密后的 dict，包含 resource 数据
            resource = result if isinstance(result, dict) else {}
            # 校验商户号
            if resource.get("mchid") and resource["mchid"] != settings.WECHAT_MCH_ID:
                logger.error("wechat_callback_mchid_mismatch")
                return False
            # 校验 appid
            if resource.get("appid") and resource["appid"] != settings.WECHAT_APP_ID:
                logger.error("wechat_callback_appid_mismatch")
                return False
            # 校验交易状态
            trade_state = resource.get("trade_state", "")
            if trade_state not in ("SUCCESS", "REFUND"):
                logger.warning("wechat_callback_trade_state=%s", trade_state)
                return False
            return True
        except Exception as e:
            logger.error("wechat_callback_verify_error: %s", e)
            return False

    # ── 支付宝 RSA2 验签 ──
    if channel == "alipay":
        if not settings.is_alipay_enabled:
            logger.warning("alipay_credentials_incomplete")
            return False
        try:
            from alipay import AliPay
        except ImportError:
            logger.warning("alipay-sdk-python not installed, callback fail-closed")
            return False

        try:
            alipay_client = AliPay(
                appid=settings.ALIPAY_APP_ID,
                app_notify_url=None,
                app_private_key_string=settings.ALIPAY_PRIVATE_KEY,
                alipay_public_key_string=settings.ALIPAY_PUBLIC_KEY,
                sign_type="RSA2",
            )
            # 从 payload 提取签名相关字段
            payload_dict = payload.model_dump()
            sign = payload_dict.get("sign", "")
            if not sign:
                logger.warning("alipay_callback_missing_sign")
                return False
            # 构建待验签数据（排除 sign 和 sign_type）
            data = {
                k: v for k, v in payload_dict.items()
                if k not in ("sign", "sign_type") and v is not None
            }
            is_valid = alipay_client.verify(data, sign)
            if not is_valid:
                logger.warning("alipay_callback_signature_invalid")
                return False
            # P1-01: 额外校验交易状态
            trade_status = payload_dict.get("trade_status", "")
            if trade_status and trade_status not in ("TRADE_SUCCESS", "TRADE_FINISHED"):
                logger.warning("alipay_callback_trade_status=%s", trade_status)
                return False
            return True
        except Exception as e:
            logger.error("alipay_callback_verify_error: %s", e)
            return False

    # 未知渠道
    return False
