"""内容版权台账与下架机制 API 路由 (P0-5).

- /content/assets: 资产台账 CRUD（admin）
- /content/takedown: 下架请求提交（登录用户）与审核（admin）
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_current_user, get_db
from app.models.audit_log import AuditLog
from app.models.content_asset import ContentAsset, ContentTakedownRequest
from app.models.user import User
from app.schemas.content import (
    ContentAssetCreate,
    ContentAssetListResponse,
    ContentAssetResponse,
    ContentAssetUpdate,
    TakedownListResponse,
    TakedownRequestCreate,
    TakedownRequestResponse,
    TakedownReviewRequest,
)

router = APIRouter()

logger = logging.getLogger(__name__)


# ── 辅助函数 ──


def _naive_utc_now() -> datetime:
    """当前 UTC 时间（剥离 tzinfo，适配 TIMESTAMP WITHOUT TIME ZONE 列）."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _get_asset_or_404(db: AsyncSession, asset_id: int) -> ContentAsset:
    """按 id 查询资产，不存在则 404."""
    result = await db.execute(
        select(ContentAsset).where(ContentAsset.id == asset_id)
    )
    asset = result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"内容资产 {asset_id} 不存在",
        )
    return asset


async def _get_takedown_or_404(
    db: AsyncSession, request_id: int
) -> ContentTakedownRequest:
    """按 id 查询下架请求，不存在则 404."""
    result = await db.execute(
        select(ContentTakedownRequest).where(
            ContentTakedownRequest.id == request_id
        )
    )
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"下架请求 {request_id} 不存在",
        )
    return req


async def _record_audit(
    db: AsyncSession,
    *,
    actor: User,
    action: str,
    target: str,
    details: Optional[dict] = None,
) -> None:
    """记录审计日志并提交。"""
    log = AuditLog(
        actor=actor.display_name,
        actor_id=actor.id,
        action=action,
        target=target,
        details=details or {},
    )
    db.add(log)
    await db.commit()


# ── 资产台账 ──


@router.post(
    "/assets",
    response_model=ContentAssetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建内容资产台账（admin）",
)
async def create_asset(
    payload: ContentAssetCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> ContentAssetResponse:
    """管理员创建一条内容资产版权台账记录。"""
    asset = ContentAsset(
        asset_type=payload.asset_type,
        source_type=payload.source_type,
        source_ref=payload.source_ref,
        license_type=payload.license_type,
        license_scope=payload.license_scope,
        commercial_use=payload.commercial_use,
        ai_processing_allowed=payload.ai_processing_allowed,
        evidence_file_url=payload.evidence_file_url,
        content_ref_id=payload.content_ref_id,
        status=payload.status,
        metadata_json=payload.metadata_json,
    )
    db.add(asset)
    await db.flush()
    asset_id = asset.id
    await db.commit()
    await db.refresh(asset)

    await _record_audit(
        db,
        actor=current,
        action="content.asset.create",
        target=f"content_asset:{asset_id}",
        details={"asset_type": payload.asset_type, "source_type": payload.source_type},
    )

    return ContentAssetResponse.model_validate(asset)


@router.get(
    "/assets",
    response_model=ContentAssetListResponse,
    summary="内容资产列表（admin）",
)
async def list_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    asset_type: Optional[str] = Query(None, description="按资产类型筛选（精确）"),
    status_filter: Optional[str] = Query(
        None, alias="status", description="按状态筛选（精确）"
    ),
    source_type: Optional[str] = Query(None, description="按来源类型筛选（精确）"),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> ContentAssetListResponse:
    """获取内容资产台账列表（分页 + 多条件筛选）."""
    conditions = []
    if asset_type:
        conditions.append(ContentAsset.asset_type == asset_type)
    if status_filter:
        conditions.append(ContentAsset.status == status_filter)
    if source_type:
        conditions.append(ContentAsset.source_type == source_type)

    base_query = select(ContentAsset)
    count_query = select(func.count()).select_from(ContentAsset)
    for cond in conditions:
        base_query = base_query.where(cond)
        count_query = count_query.where(cond)

    total = (await db.execute(count_query)).scalar() or 0

    base_query = (
        base_query.order_by(ContentAsset.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(base_query)
    assets = result.scalars().all()

    return ContentAssetListResponse(
        items=[ContentAssetResponse.model_validate(a) for a in assets],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/assets/{asset_id}",
    response_model=ContentAssetResponse,
    summary="内容资产详情（admin）",
)
async def get_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> ContentAssetResponse:
    """获取单条内容资产台账详情。"""
    asset = await _get_asset_or_404(db, asset_id)
    return ContentAssetResponse.model_validate(asset)


@router.patch(
    "/assets/{asset_id}",
    response_model=ContentAssetResponse,
    summary="更新内容资产台账（admin）",
)
async def update_asset(
    asset_id: int,
    payload: ContentAssetUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> ContentAssetResponse:
    """管理员更新内容资产台账字段（PATCH 部分更新）."""
    asset = await _get_asset_or_404(db, asset_id)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供任何待更新字段",
        )
    for field, value in update_data.items():
        setattr(asset, field, value)

    await db.commit()
    await db.refresh(asset)

    await _record_audit(
        db,
        actor=current,
        action="content.asset.update",
        target=f"content_asset:{asset_id}",
        details=update_data,
    )

    return ContentAssetResponse.model_validate(asset)


@router.delete(
    "/assets/{asset_id}",
    response_model=ContentAssetResponse,
    summary="软删除内容资产（admin，置为 taken_down）",
)
async def delete_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> ContentAssetResponse:
    """软删除：将资产 status 置为 taken_down，不物理删除。"""
    asset = await _get_asset_or_404(db, asset_id)
    if asset.status == "taken_down":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="资产已处于下架状态",
        )
    asset.status = "taken_down"
    asset.reviewer_id = current.id
    asset.reviewed_at = _naive_utc_now()
    await db.commit()
    await db.refresh(asset)

    await _record_audit(
        db,
        actor=current,
        action="content.asset.takedown",
        target=f"content_asset:{asset_id}",
        details={"reason": "admin_soft_delete"},
    )

    return ContentAssetResponse.model_validate(asset)


# ── 下架请求 ──


@router.post(
    "/takedown",
    response_model=TakedownRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="提交下架请求（登录用户）",
)
async def create_takedown_request(
    payload: TakedownRequestCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> TakedownRequestResponse:
    """任何已登录用户均可提交下架/投诉请求（无需 admin）。"""
    asset = await _get_asset_or_404(db, payload.asset_id)

    requester_id: Optional[int] = None
    if payload.requester_type in ("user", "admin"):
        requester_id = current.id

    req = ContentTakedownRequest(
        asset_id=asset.id,
        requester_type=payload.requester_type,
        requester_id=requester_id,
        requester_name=payload.requester_name,
        requester_contact=payload.requester_contact,
        reason=payload.reason,
        evidence_url=payload.evidence_url,
        status="pending",
    )
    db.add(req)
    await db.flush()
    req_id = req.id
    await db.commit()
    await db.refresh(req)

    logger.info(
        "Takedown request #%s created by user=%s for asset=%s",
        req_id,
        current.id,
        asset.id,
    )
    return TakedownRequestResponse.model_validate(req)


@router.get(
    "/takedown",
    response_model=TakedownListResponse,
    summary="下架请求列表（admin）",
)
async def list_takedown_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    status_filter: Optional[str] = Query(
        None, alias="status", description="按状态筛选（精确）"
    ),
    asset_id: Optional[int] = Query(None, description="按资产 ID 筛选"),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> TakedownListResponse:
    """管理员查看下架请求列表（分页 + 筛选）."""
    conditions = []
    if status_filter:
        conditions.append(ContentTakedownRequest.status == status_filter)
    if asset_id is not None:
        conditions.append(ContentTakedownRequest.asset_id == asset_id)

    base_query = select(ContentTakedownRequest)
    count_query = select(func.count()).select_from(ContentTakedownRequest)
    for cond in conditions:
        base_query = base_query.where(cond)
        count_query = count_query.where(cond)

    total = (await db.execute(count_query)).scalar() or 0

    base_query = (
        base_query.order_by(ContentTakedownRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(base_query)
    reqs = result.scalars().all()

    return TakedownListResponse(
        items=[TakedownRequestResponse.model_validate(r) for r in reqs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/takedown/{request_id}/review",
    response_model=TakedownRequestResponse,
    summary="审核下架请求（admin，approved 时资产下架）",
)
async def review_takedown_request(
    request_id: int,
    payload: TakedownReviewRequest,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> TakedownRequestResponse:
    """管理员审核下架请求。

    - approved: 同意下架，关联资产 status 置为 taken_down
    - rejected: 驳回
    - escalated: 升级处理
    """
    req = await _get_takedown_or_404(db, request_id)

    if req.status not in ("pending", "reviewing"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"当前请求状态为 {req.status}，无法重复审核",
        )

    asset = await _get_asset_or_404(db, req.asset_id)

    req.status = payload.status
    req.reviewer_id = current.id
    req.review_note = payload.review_note
    req.reviewed_at = _naive_utc_now()

    if payload.status == "approved":
        asset.status = "taken_down"
        asset.reviewer_id = current.id
        asset.reviewed_at = _naive_utc_now()

    await db.commit()
    await db.refresh(req)

    await _record_audit(
        db,
        actor=current,
        action="content.takedown.review",
        target=f"takedown_request:{request_id}",
        details={
            "asset_id": req.asset_id,
            "review_status": payload.status,
            "asset_status_changed": payload.status == "approved",
        },
    )

    return TakedownRequestResponse.model_validate(req)
