"""审计日志 API 路由.

提供管理员操作的审计日志查询接口。
"""
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.admin import AuditLogListResponse, AuditLogResponse

router = APIRouter()


@router.get(
    "/",
    response_model=AuditLogListResponse,
    summary="审计日志列表",
)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    actor: Optional[str] = Query(None, description="按操作者名称模糊筛选"),
    action: Optional[str] = Query(None, description="按动作类型筛选（精确）"),
    start_date: Optional[date] = Query(None, description="起始日期（含，UTC）"),
    end_date: Optional[date] = Query(None, description="结束日期（含，UTC）"),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> AuditLogListResponse:
    """获取审计日志列表（分页 + 多条件筛选）。"""
    conditions = []
    if actor:
        conditions.append(AuditLog.actor.ilike(f"%{actor}%"))
    if action:
        # 支持 action 前缀匹配（如 user. 匹配所有 user.* 操作）
        if action.endswith("."):
            conditions.append(AuditLog.action.like(f"{action}%"))
        else:
            conditions.append(AuditLog.action == action)
    if start_date is not None:
        # start_date 00:00:00 UTC
        start_dt = datetime.combine(
            start_date, datetime.min.time(), tzinfo=timezone.utc
        )
        conditions.append(AuditLog.created_at >= start_dt)
    if end_date is not None:
        # end_date 23:59:59.999999 UTC
        end_dt = datetime.combine(
            end_date, datetime.max.time(), tzinfo=timezone.utc
        )
        conditions.append(AuditLog.created_at <= end_dt)

    base_query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)
    for cond in conditions:
        base_query = base_query.where(cond)
        count_query = count_query.where(cond)

    total = (await db.execute(count_query)).scalar() or 0

    base_query = (
        base_query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(base_query)
    logs = result.scalars().all()

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
    )
