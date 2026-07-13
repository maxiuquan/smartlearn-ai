"""Outbox dispatcher — 事务性 Outbox 可靠投递后台任务 (P1-4.9).

职责:
- 周期性扫描 outbox_events 表中 status=pending / processing 的项
- 用 SELECT FOR UPDATE SKIP LOCKED 行锁（多实例并发安全）
- 调用对应 event_type 的 handler
- 成功: status=sent, sent_at=now
- 失败: retry_count++, next_retry_at=now+退避, last_error=err
- 超过 max_retry: status=dead (DLQ，需人工重放)

handler 注册:
- order.created / order.paid / order.refunded: 订单事件（当前为日志投递占位）
- subscription.activated / subscription.revoked: 订阅事件（当前为日志投递占位）
真实接入外部系统（消息队列、webhook 等）时，替换 handler 实现即可。

退避策略: 指数退避 base=30s, factor=2, max=1h
DLQ 告警: status=dead 时记录 ERROR 日志（生产环境应接入告警系统）
"""
from __future__ import annotations

import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Optional

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.models.order import OutboxEvent

logger = logging.getLogger(__name__)

# 退避参数
_BACKOFF_BASE_SEC = 30       # 初始退避 30s
_BACKOFF_FACTOR = 2          # 指数因子
_BACKOFF_MAX_SEC = 3600      # 最大退避 1h

# 单次扫描批量大小
_BATCH_SIZE = 50

# handler 注册表
HandlerFn = Callable[[OutboxEvent], Awaitable[None]]
_HANDLERS: dict[str, HandlerFn] = {}


def register_handler(event_type: str, handler: HandlerFn) -> None:
    """注册 event_type 对应的 handler。"""
    _HANDLERS[event_type] = handler


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _calc_backoff(retry_count: int) -> datetime:
    """计算指数退避的 next_retry_at。"""
    delay = min(
        _BACKOFF_BASE_SEC * (_BACKOFF_FACTOR ** retry_count),
        _BACKOFF_MAX_SEC,
    )
    # 加随机抖动（避免重试风暴）
    jitter = secrets.randbelow(int(delay * 0.1) + 1)
    return _utcnow() + timedelta(seconds=delay + jitter)


async def _default_handler(event: OutboxEvent) -> None:
    """默认 handler: 仅记录日志（占位）。

    真实接入时，替换为对外部系统的调用：
    - 消息队列（Kafka/RabbitMQ）
    - Webhook
    - 邮件/短信通知
    - 数据同步
    """
    logger.info(
        "[Outbox] 投递事件 id=%s type=%s aggregate=%s/%s payload_len=%d",
        event.id,
        event.event_type,
        event.aggregate_type,
        event.aggregate_id,
        len(event.payload or ""),
    )
    # 模拟投递：解析 payload 验证完整性
    try:
        payload = json.loads(event.payload) if event.payload else {}
        if not payload:
            raise ValueError("payload 为空")
    except (json.JSONDecodeError, ValueError) as e:
        raise ValueError(f"payload 解析失败: {e}") from e


# 注册默认 handler
for _evt in [
    "order.created",
    "order.paid",
    "order.refunded",
    "subscription.activated",
    "subscription.revoked",
]:
    register_handler(_evt, _default_handler)


async def dispatch_batch() -> dict[str, int]:
    """扫描并投递一批 outbox 事件。

    Returns:
        统计 dict: {sent, failed, dead, skipped}
    """
    stats = {"sent": 0, "failed": 0, "dead": 0, "skipped": 0}
    now = _utcnow()

    async with async_session_factory() as db:
        async with db.begin():
            # 选取待投递事件（pending 或到期的 processing）
            # SELECT FOR UPDATE SKIP LOCKED: 多实例并发安全
            stmt = (
                select(OutboxEvent)
                .where(
                    or_(
                        OutboxEvent.status == "pending",
                        (
                            (OutboxEvent.status == "processing")
                            & (OutboxEvent.next_retry_at.is_(None) | (OutboxEvent.next_retry_at <= now))
                        ),
                    )
                )
                .order_by(OutboxEvent.created_at.asc())
                .limit(_BATCH_SIZE)
                .with_for_update(skip_locked=True)
            )
            result = await db.execute(stmt)
            events = list(result.scalars().all())

            if not events:
                return stats

            for event in events:
                # 标记为 processing
                event.status = "processing"
                await db.flush()

                handler = _HANDLERS.get(event.event_type, _default_handler)
                try:
                    await handler(event)
                    # 投递成功
                    event.status = "sent"
                    event.sent_at = _utcnow()
                    stats["sent"] += 1
                    logger.info(
                        "[Outbox] 投递成功 id=%s type=%s",
                        event.id,
                        event.event_type,
                    )
                except Exception as e:
                    # 投递失败
                    event.retry_count += 1
                    event.last_error = f"{type(e).__name__}: {e}"[:2000]
                    if event.retry_count >= event.max_retry:
                        # 进入 DLQ
                        event.status = "dead"
                        stats["dead"] += 1
                        logger.error(
                            "[Outbox] 事件进入 DLQ id=%s type=%s retries=%d err=%s",
                            event.id,
                            event.event_type,
                            event.retry_count,
                            e,
                            exc_info=True,
                        )
                    else:
                        # 退避重试
                        event.status = "pending"
                        event.next_retry_at = _calc_backoff(event.retry_count)
                        stats["failed"] += 1
                        logger.warning(
                            "[Outbox] 投递失败(将重试) id=%s type=%s retry=%d/%d err=%s next=%s",
                            event.id,
                            event.event_type,
                            event.retry_count,
                            event.max_retry,
                            e,
                            event.next_retry_at.isoformat(),
                        )

    return stats


async def replay_event(event_id: int) -> bool:
    """人工重放 DLQ 中的事件（管理员手动触发）。

    将 status=dead 的事件重置为 pending，retry_count=0。
    Returns: True 表示已重置，False 表示事件不存在或状态不符。
    """
    async with async_session_factory() as db:
        async with db.begin():
            result = await db.execute(
                select(OutboxEvent)
                .where(OutboxEvent.id == event_id)
                .with_for_update()
            )
            event = result.scalar_one_or_none()
            if event is None:
                return False
            if event.status not in ("dead", "failed"):
                return False

            event.status = "pending"
            event.retry_count = 0
            event.last_error = None
            event.next_retry_at = None
            logger.info(
                "[Outbox] 人工重放事件 id=%s type=%s",
                event.id,
                event.event_type,
            )
            return True


async def get_outbox_stats() -> dict[str, Any]:
    """获取 Outbox 统计信息（用于监控）。"""
    from sqlalchemy import func

    async with async_session_factory() as db:
        # 各状态计数
        stmt = (
            select(OutboxEvent.status, func.count(OutboxEvent.id))
            .group_by(OutboxEvent.status)
        )
        result = await db.execute(stmt)
        status_counts = {row[0]: row[1] for row in result.all()}

        # 最早未投递事件（延迟监控）
        oldest_stmt = (
            select(OutboxEvent.created_at)
            .where(OutboxEvent.status.in_(["pending", "processing"]))
            .order_by(OutboxEvent.created_at.asc())
            .limit(1)
        )
        oldest_result = await db.execute(oldest_stmt)
        oldest_pending = oldest_result.scalar_one_or_none()

    return {
        "status_counts": status_counts,
        "oldest_pending_at": oldest_pending.isoformat() if oldest_pending else None,
        "lag_seconds": (
            int((_utcnow() - oldest_pending).total_seconds())
            if oldest_pending
            else 0
        ),
        "handlers_registered": list(_HANDLERS.keys()),
    }
