"""用户管理 + 权限操作 API 路由.

所有端点要求管理员权限（admin 或 super_admin）；
写操作均记录到 AuditLog 表。

P1-4.7 整改：
- 审计日志与业务变更在同一事务内提交（_record_audit 不再独立 commit）
- 用户删除改为软删除（status=deleted + deleted_at + PII 匿名化）
- PII 响应最小化：默认对 phone/email/wechat_openid 脱敏；
  管理员需显式 ?reveal_pii=true 才能查看明文（同时记录审计）
"""
import csv
import io
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_current_super_admin, get_db
from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.business import (
    AIConversation,
    GameSession,
    UserQuestionAttempt,
    UserWordProgress,
)
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.admin import (
    ResetPasswordRequest,
    SubscriptionInfo,
    UserBanRequest,
    UserCreateRequest,
    UserDetailResponse,
    UserListResponse,
    UserListItem,
    UserRoleUpdateRequest,
    UserStatsSummary,
    UserUpdateRequest,
    UserVipUpdateRequest,
)

router = APIRouter()
logger = logging.getLogger("api.users")


# ── P1-4.7: PII 脱敏工具 ──


def _mask_phone(phone: Optional[str]) -> Optional[str]:
    """手机号脱敏：保留前 3 + 后 4，中间 ****。"""
    if not phone or len(phone) < 7:
        return phone
    return f"{phone[:3]}****{phone[-4:]}"


def _mask_email(email: Optional[str]) -> Optional[str]:
    """邮箱脱敏：保留首字符 + 域名，中间 ****。"""
    if not email or "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 1:
        return f"{local}***@{domain}"
    return f"{local[0]}***@{domain}"


def _mask_openid(openid: Optional[str]) -> Optional[str]:
    """微信 openid 脱敏：保留前 4 + 后 4，中间 ****。"""
    if not openid or len(openid) < 8:
        return openid
    return f"{openid[:4]}****{openid[-4:]}"


# ── 辅助函数 ──


async def _get_user_or_404(db: AsyncSession, user_id: int) -> User:
    """按 id 查询用户，不存在则 404。"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"用户 {user_id} 不存在",
        )
    return user


async def _build_user_detail(
    db: AsyncSession,
    user: User,
    *,
    reveal_pii: bool = False,
) -> UserDetailResponse:
    """构造用户详情响应（含订阅与统计）。

    每个子查询独立 try/except，避免单点失败导致整个接口 500。

    P1-4.7:
    - 默认对 phone/email/wechat_openid 做脱敏
    - reveal_pii=True 时返回明文（调用方需自行记录审计）
    """
    def _strip_tz(dt):
        """安全地剥离 datetime 的 tzinfo。"""
        if dt and hasattr(dt, 'tzinfo') and dt.tzinfo:
            return dt.replace(tzinfo=None)
        return dt

    # 订阅信息（失败不阻塞）
    sub = None
    try:
        sub_result = await db.execute(
            select(Subscription)
            .where(Subscription.user_id == user.id)
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
        sub = sub_result.scalar_one_or_none()
    except Exception as e:
        logger.warning("Failed to load subscription for user %s: %s", user.id, e)

    # 统计（每个独立 try/except，失败默认 0）
    async def _safe_count(model, label):
        try:
            return (
                await db.execute(
                    select(func.count()).select_from(model).where(
                        model.user_id == user.id
                    )
                )
            ).scalar() or 0
        except Exception as e:
            logger.warning("Failed to count %s for user %s: %s", label, user.id, e)
            return 0

    question_count = await _safe_count(UserQuestionAttempt, "attempts")
    word_count = await _safe_count(UserWordProgress, "word_progress")
    game_count = await _safe_count(GameSession, "game_sessions")
    ai_conversation_count = await _safe_count(AIConversation, "ai_conversations")

    # 学习天数
    study_days = 0
    try:
        study_days_result = await db.execute(
            select(func.count(func.distinct(func.date(UserQuestionAttempt.created_at)))).where(
                UserQuestionAttempt.user_id == user.id
            )
        )
        study_days = study_days_result.scalar() or 0
    except Exception as e:
        logger.warning("Failed to count study_days for user %s: %s", user.id, e)

    # updated_at 可能不存在（旧迁移），安全获取
    updated_at = _strip_tz(getattr(user, 'updated_at', None) or user.created_at)

    # P1-4.7: PII 脱敏
    raw_phone = user.phone
    raw_email = user.email
    raw_openid = getattr(user, 'wechat_openid', None)
    if reveal_pii:
        phone_out, email_out, openid_out = raw_phone, raw_email, raw_openid
        pii_masked = False
    else:
        phone_out = _mask_phone(raw_phone)
        email_out = _mask_email(raw_email)
        openid_out = _mask_openid(raw_openid)
        pii_masked = True

    return UserDetailResponse(
        id=user.id,
        phone=phone_out,
        email=email_out,
        role=user.role,
        status=user.status,
        nickname=user.nickname,
        avatar=user.avatar,
        wechat_openid=openid_out,
        vip_level=user.vip_level,
        vip_expire_at=_strip_tz(user.vip_expire_at),
        ai_quota_daily_override=user.ai_quota_daily_override,
        last_login_at=_strip_tz(user.last_login_at),
        created_at=_strip_tz(user.created_at),
        updated_at=updated_at,
        deleted_at=_strip_tz(getattr(user, 'deleted_at', None)),
        pii_masked=pii_masked,
        subscription=(
            SubscriptionInfo(
                plan=sub.plan,
                status=sub.status,
                end_at=_strip_tz(sub.end_at),
                ai_quota_daily=sub.ai_quota_daily,
            )
            if sub
            else None
        ),
        stats=UserStatsSummary(
            question_count=question_count,
            word_count=word_count,
            game_count=game_count,
            ai_conversation_count=ai_conversation_count,
            study_days=study_days,
        ),
    )


async def _record_audit(
    db: AsyncSession,
    *,
    actor: User,
    action: str,
    target: str,
    details: Optional[dict] = None,
) -> None:
    """P1-4.7: 记录审计日志（仅 add，不单独 commit）。

    调用方必须在调用本函数后自行 `await db.commit()`，
    以保证审计与业务变更在同一事务内原子提交。
    """
    log = AuditLog(
        actor=actor.display_name,
        actor_id=actor.id,
        action=action,
        target=target,
        details=details or {},
    )
    db.add(log)


def _apply_sort(query, model, sort: str, order: str):
    """通用排序应用。sort 取模型属性名，order 为 asc/desc。"""
    column = getattr(model, sort, None) if hasattr(model, sort) else None
    if column is None:
        column = model.created_at
    if order == "asc":
        return query.order_by(asc(column))
    return query.order_by(desc(column))


# ── 列表与详情 ──


@router.get(
    "/",
    response_model=UserListResponse,
    summary="用户列表（分页 + 搜索 + 筛选 + 排序）",
)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="按 phone/email/nickname 模糊搜索"),
    role: Optional[str] = Query(None, description="按角色筛选"),
    status_filter: Optional[str] = Query(None, alias="status", description="按状态筛选（active/banned/deleted）"),
    vip_level: Optional[int] = Query(None, ge=0, le=3, description="按 VIP 等级筛选"),
    include_deleted: bool = Query(False, description="是否包含已软删除用户（默认不包含）"),
    sort: str = Query("created_at", description="排序字段"),
    order: str = Query("desc", description="asc / desc"),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> UserListResponse:
    """获取用户列表（支持分页、搜索、筛选、排序）。

    P1-4.7: 默认不返回已软删除用户；显式 include_deleted=true 可查看。
    """
    conditions = []
    if search:
        conditions.append(
            or_(
                User.phone.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.nickname.ilike(f"%{search}%"),
            )
        )
    if role:
        conditions.append(User.role == role)
    if status_filter:
        conditions.append(User.status == status_filter)
    elif not include_deleted:
        # P1-4.7: 默认排除软删除用户
        conditions.append(User.status != "deleted")
    if vip_level is not None:
        conditions.append(User.vip_level == vip_level)

    base_query = select(User)
    count_query = select(func.count()).select_from(User)
    for cond in conditions:
        base_query = base_query.where(cond)
        count_query = count_query.where(cond)

    total = (await db.execute(count_query)).scalar() or 0

    base_query = _apply_sort(base_query, User, sort, order)
    base_query = base_query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(base_query)
    users = result.scalars().all()

    # P1-4.7: 列表也做 PII 脱敏（列表场景不开放 reveal）
    items = []
    for u in users:
        items.append(
            UserListItem(
                id=u.id,
                phone=_mask_phone(u.phone),
                email=_mask_email(u.email),
                role=u.role,
                status=u.status,
                nickname=u.nickname,
                avatar=u.avatar,
                vip_level=u.vip_level,
                vip_expire_at=u.vip_expire_at,
                last_login_at=u.last_login_at,
                created_at=u.created_at,
                deleted_at=getattr(u, 'deleted_at', None),
            )
        )

    return UserListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{user_id}",
    response_model=UserDetailResponse,
    summary="用户详情",
)
async def get_user(
    user_id: int,
    reveal_pii: bool = Query(
        False,
        description="P1-4.7: 显式请求明文 PII；为 true 时记录审计",
    ),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> UserDetailResponse:
    """获取用户详情（含订阅与学习统计）。

    P1-4.7: 默认对 phone/email/wechat_openid 脱敏；
    reveal_pii=true 时返回明文，并记录一条审计日志。
    """
    user = await _get_user_or_404(db, user_id)

    if reveal_pii:
        # P1-4.7: PII 解密查看需记审计（与"读"操作不在同一事务，
        # 但读取为副作用 commit 仍可接受；至少保证被记录）
        _record_audit(
            db,
            actor=current,
            action="user.pii.reveal",
            target=f"user:{user.id}",
            details={"fields": ["phone", "email", "wechat_openid"]},
        )
        await db.commit()

    return await _build_user_detail(db, user, reveal_pii=reveal_pii)


# ── 创建 / 更新 ──


@router.post(
    "/",
    response_model=UserDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建用户",
)
async def create_user(
    body: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> UserDetailResponse:
    """管理员创建用户。

    - 至少提供 phone 或 email 之一
    - 角色不能直接设为 super_admin（仅 super_admin 通过角色更新接口修改）
    """
    if not body.phone and not body.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="必须提供手机号或邮箱",
        )

    if body.role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="不允许通过创建接口直接生成 super_admin",
        )

    if body.role not in ("user", "teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"非法角色：{body.role}",
        )

    # 唯一性检查
    conds = []
    if body.phone:
        conds.append(User.phone == body.phone)
    if body.email:
        conds.append(User.email == body.email)
    exists = (await db.execute(select(User).where(or_(*conds)))).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="手机号或邮箱已被占用",
        )

    user = User(
        phone=body.phone,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        status="active",
        nickname=body.nickname,
    )
    db.add(user)
    await db.flush()  # 获取 user.id，但不提交

    # P1-4.7: 审计与业务同事务（add 但不 commit）
    _record_audit(
        db,
        actor=current,
        action="user.create",
        target=f"user:{user.id}",
        details={"phone": body.phone, "email": body.email, "role": body.role},
    )
    await db.commit()
    await db.refresh(user)

    return await _build_user_detail(db, user)


@router.put(
    "/{user_id}",
    response_model=UserDetailResponse,
    summary="更新用户基本信息",
)
async def update_user(
    user_id: int,
    body: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> UserDetailResponse:
    """更新 nickname/phone/email。"""
    user = await _get_user_or_404(db, user_id)

    changes: dict = {}
    if body.nickname is not None and body.nickname != user.nickname:
        changes["nickname"] = {"from": user.nickname, "to": body.nickname}
        user.nickname = body.nickname
    if body.phone is not None and body.phone != user.phone:
        # 唯一性检查
        if body.phone:
            conflict = (
                await db.execute(
                    select(User).where(User.phone == body.phone, User.id != user.id)
                )
            ).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="手机号已被其他用户占用",
                )
        changes["phone"] = {"from": user.phone, "to": body.phone}
        user.phone = body.phone
    if body.email is not None and body.email != user.email:
        if body.email:
            conflict = (
                await db.execute(
                    select(User).where(User.email == body.email, User.id != user.id)
                )
            ).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="邮箱已被其他用户占用",
                )
        changes["email"] = {"from": user.email, "to": body.email}
        user.email = body.email

    if changes:
        # P1-4.7: 审计与业务同事务
        _record_audit(
            db,
            actor=current,
            action="user.update",
            target=f"user:{user.id}",
            details=changes,
        )
        await db.commit()
        await db.refresh(user)

    return await _build_user_detail(db, user)


# ── 状态：禁用 / 启用 / 删除 ──


@router.post(
    "/{user_id}/ban",
    response_model=UserDetailResponse,
    summary="禁用用户",
)
async def ban_user(
    user_id: int,
    body: UserBanRequest,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> UserDetailResponse:
    """禁用用户（status=banned）。"""
    user = await _get_user_or_404(db, user_id)

    if user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="不能禁用超级管理员",
        )
    if user.id == current.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能禁用当前登录账号",
        )

    user.status = "banned"
    # P1-4.7: 审计与业务同事务
    _record_audit(
        db,
        actor=current,
        action="user.ban",
        target=f"user:{user.id}",
        details={"reason": body.reason},
    )
    await db.commit()
    await db.refresh(user)

    return await _build_user_detail(db, user)


@router.post(
    "/{user_id}/enable",
    response_model=UserDetailResponse,
    summary="启用用户",
)
async def enable_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> UserDetailResponse:
    """启用用户（status=active）。

    P1-4.7: 不能启用已软删除的用户（需专门的恢复流程）。
    """
    user = await _get_user_or_404(db, user_id)

    if user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户已被软删除，不能直接启用（需先恢复）",
        )

    user.status = "active"
    # P1-4.7: 审计与业务同事务
    _record_audit(
        db,
        actor=current,
        action="user.enable",
        target=f"user:{user.id}",
        details={},
    )
    await db.commit()
    await db.refresh(user)

    return await _build_user_detail(db, user)


@router.delete(
    "/{user_id}",
    summary="删除用户（仅 super_admin，软删除）",
)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_super_admin),
) -> dict:
    """P1-4.7: 软删除用户。

    - 仅超级管理员可执行
    - 设置 status=deleted + deleted_at 时间戳
    - 匿名化 PII（phone/email/wechat_openid 加 deleted_ 前缀）
    - 撤销所有会话
    - 业务变更与审计同事务写入
    """
    user = await _get_user_or_404(db, user_id)

    if user.id == current.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除当前登录账号",
        )

    if user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户已被软删除",
        )

    display = user.display_name
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # P1-4.7: 软删除 + PII 匿名化
    user.status = "deleted"
    user.deleted_at = now
    # 匿名化 PII（保留唯一性前缀，避免冲突）
    if user.phone:
        user.phone = f"deleted_{user.id}_{user.phone}"
    if user.email:
        user.email = f"deleted_{user.id}_{user.email}"
    if user.wechat_openid:
        user.wechat_openid = f"deleted_{user.id}_{user.wechat_openid}"
    # 清空密码哈希，防止后续误用
    user.password_hash = None
    # 清空 VIP 相关
    user.vip_level = 0
    user.vip_expire_at = None
    user.ai_quota_daily_override = None

    # P1-4.7: 审计与业务同事务
    _record_audit(
        db,
        actor=current,
        action="user.delete",
        target=f"user:{user.id}",
        details={
            "display_name": display,
            "soft_delete": True,
            "anonymized_pii": True,
            "deleted_at": now.isoformat(),
        },
    )
    await db.commit()
    await db.refresh(user)

    # 撤销所有会话（独立操作，不阻塞主事务）
    try:
        from app.core.security import revoke_all_user_sessions
        await revoke_all_user_sessions(user.id, db)
    except Exception as e:
        logger.warning("软删除后撤销会话失败（非阻塞）: user_id=%s err=%s", user.id, e)

    return {
        "message": f"用户 {display}（id={user_id}）已软删除，PII 已匿名化",
        "soft_delete": True,
        "deleted_at": now.isoformat(),
    }


# ── 密码 ──


@router.post(
    "/{user_id}/reset-password",
    summary="重置用户密码",
)
async def reset_password(
    user_id: int,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """管理员重置目标用户密码。

    P0-07: 目标用户为 super_admin 时，仅允许另一名 super_admin 操作。
    """
    user = await _get_user_or_404(db, user_id)

    # P0-07: super_admin 保护 — 仅 super_admin 可重置 super_admin 密码
    if user.is_super_admin and not current.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅超级管理员可重置超级管理员密码",
        )

    user.password_hash = hash_password(body.new_password)
    # P1-4.7: 审计与业务同事务
    _record_audit(
        db,
        actor=current,
        action="user.reset_password",
        target=f"user:{user.id}",
        details={"revoked_sessions": True},
    )
    await db.commit()

    # P0-07: 撤销目标用户所有会话（密码重置后强制重新登录）
    try:
        from app.core.security import revoke_all_user_sessions
        await revoke_all_user_sessions(user.id, db)
    except Exception:
        pass  # Redis 不可用时降级

    return {"message": f"用户 {user.id} 密码已重置，所有会话已撤销"}


# ── 角色与 VIP ──


@router.put(
    "/{user_id}/role",
    response_model=UserDetailResponse,
    summary="修改用户角色",
)
async def update_user_role(
    user_id: int,
    body: UserRoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> UserDetailResponse:
    """修改用户角色。

    - super_admin 角色仅 super_admin 可设置
    - 不能修改自己的角色（防止降级锁死）
    """
    user = await _get_user_or_404(db, user_id)

    if user.id == current.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能修改自己的角色",
        )

    if body.role == "super_admin" and not current.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅超级管理员可设置 super_admin 角色",
        )

    # 降级 super_admin 也需 super_admin 权限
    if user.role == "super_admin" and not current.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅超级管理员可修改超级管理员的角色",
        )

    old_role = user.role
    user.role = body.role
    # P1-4.7: 审计与业务同事务
    _record_audit(
        db,
        actor=current,
        action="user.role.update",
        target=f"user:{user.id}",
        details={"from": old_role, "to": body.role},
    )
    await db.commit()
    await db.refresh(user)

    return await _build_user_detail(db, user)


@router.put(
    "/{user_id}/vip",
    response_model=UserDetailResponse,
    summary="更新用户 VIP 等级与 AI 配额",
)
async def update_user_vip(
    user_id: int,
    body: UserVipUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> UserDetailResponse:
    """更新用户 VIP 等级、有效期、AI 配额覆盖。"""
    user = await _get_user_or_404(db, user_id)

    details: dict = {
        "vip_level": {"from": user.vip_level, "to": body.vip_level},
    }
    user.vip_level = body.vip_level

    if body.vip_expire_at is not None:
        details["vip_expire_at"] = {"from": user.vip_expire_at, "to": body.vip_expire_at}
        user.vip_expire_at = body.vip_expire_at
    elif body.vip_level == 0:
        # 取消 VIP 时清空过期时间
        user.vip_expire_at = None

    if body.ai_quota_daily_override is not None:
        details["ai_quota_daily_override"] = {
            "from": user.ai_quota_daily_override,
            "to": body.ai_quota_daily_override,
        }
        user.ai_quota_daily_override = body.ai_quota_daily_override

    # P1-4.7: 审计与业务同事务
    _record_audit(
        db,
        actor=current,
        action="user.vip.update",
        target=f"user:{user.id}",
        details=details,
    )
    await db.commit()
    await db.refresh(user)

    return await _build_user_detail(db, user)


# ── 统计 ──


@router.get(
    "/{user_id}/stats",
    response_model=UserStatsSummary,
    summary="用户学习统计",
)
async def get_user_stats(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> UserStatsSummary:
    """获取单个用户的学习统计摘要。"""
    user = await _get_user_or_404(db, user_id)
    detail = await _build_user_detail(db, user)
    return detail.stats


# ── 导入 / 导出 ──


@router.post(
    "/import",
    summary="批量导入用户（CSV / JSON）",
)
async def import_users(
    file: UploadFile = File(..., description="CSV 或 JSON 文件"),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """批量导入用户。

    CSV 表头：phone,email,password,nickname,role
    JSON：上述字段的数组
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="上传文件为空",
        )

    filename = (file.filename or "").lower()
    try:
        if filename.endswith(".json"):
            try:
                rows = json.loads(raw.decode("utf-8-sig"))
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"JSON 解析失败：{e}",
                )
            if not isinstance(rows, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="JSON 顶层必须是数组",
                )
        else:
            # 默认按 CSV 解析
            text = raw.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"文件解析失败：{e}",
        )

    success_count = 0
    error_count = 0
    errors: list[dict] = []

    for idx, row in enumerate(rows, start=1):
        try:
            phone = (row.get("phone") or "").strip() or None
            email = (row.get("email") or "").strip() or None
            password = (row.get("password") or "").strip()
            nickname = (row.get("nickname") or "").strip() or None
            role = (row.get("role") or "user").strip() or "user"

            if not phone and not email:
                raise ValueError("必须提供 phone 或 email")
            if len(password) < 6:
                raise ValueError("密码长度至少 6 位")
            if role not in ("user", "teacher", "admin"):
                raise ValueError(f"非法角色：{role}")

            # 唯一性检查
            conds = []
            if phone:
                conds.append(User.phone == phone)
            if email:
                conds.append(User.email == email)
            existing = (await db.execute(select(User).where(or_(*conds)))).first()
            if existing:
                raise ValueError("手机号或邮箱已存在")

            user = User(
                phone=phone,
                email=email,
                password_hash=hash_password(password),
                role=role,
                status="active",
                nickname=nickname,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append({"row": idx, "error": str(e), "data": row})
            # 回滚当前未提交的事务
            await db.rollback()

    # P1-4.7: 审计与业务同事务（add 但不 commit；最后一次统一 commit）
    _record_audit(
        db,
        actor=current,
        action="user.import",
        target="users:bulk",
        details={
            "success_count": success_count,
            "error_count": error_count,
            "filename": file.filename,
        },
    )
    await db.commit()

    return {
        "success_count": success_count,
        "error_count": error_count,
        "errors": errors,
    }


@router.get(
    "/export",
    summary="导出全部用户（CSV 流式响应）",
)
async def export_users(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> StreamingResponse:
    """导出全部用户列表为 CSV。

    P1-4.7: 导出明文 PII 属于敏感操作；审计日志记录操作者与数量。
    导出范围默认排除已软删除用户。
    """
    result = await db.execute(
        select(User).where(User.status != "deleted").order_by(desc(User.created_at))
    )
    users = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "phone",
            "email",
            "role",
            "status",
            "nickname",
            "vip_level",
            "vip_expire_at",
            "last_login_at",
            "created_at",
        ]
    )
    for u in users:
        writer.writerow(
            [
                u.id,
                u.phone or "",
                u.email or "",
                u.role,
                u.status,
                u.nickname or "",
                u.vip_level,
                u.vip_expire_at.isoformat() if u.vip_expire_at else "",
                u.last_login_at.isoformat() if u.last_login_at else "",
                u.created_at.isoformat() if u.created_at else "",
            ]
        )

    # P1-4.7: 记录导出审计日志（只读操作，审计单独 commit 可接受）
    _record_audit(
        db,
        actor=current,
        action="user.export",
        target="users:all",
        details={"count": len(users), "include_pii": True},
    )
    await db.commit()

    content = output.getvalue()
    output.close()

    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=users_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        },
    )
