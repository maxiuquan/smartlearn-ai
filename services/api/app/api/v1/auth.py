"""认证相关 API 路由.

重构说明：
- 使用 ORM 模型替代原始 SQL Table
- JWT 加入 role/status claim，便于前端守卫与后端快速校验
- 新增 /auth/me、/auth/logout、/auth/change-password
- 登录兼容前端 username 字段（可传 phone 或 email）
- 登录时更新 last_login_at
- banned 用户拒绝登录
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserProfileResponse,
    WechatLoginRequest,
)

router = APIRouter()


def _issue_tokens(user: User) -> TokenResponse:
    """为用户签发 access + refresh token（带 role/status claim）."""
    from app.core.config import settings

    extra_claims = {"role": user.role, "status": user.status}
    access_token = create_access_token(str(user.id), extra_claims=extra_claims)
    refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# 限流装饰器（slowapi 不可用时退化为无操作）
# 注意: slowapi 装饰器在请求时从 request.app.state.limiter 获取限流器实例,
# 因此这里只需创建一个用于生成装饰器的 Limiter, 实际限流状态存储在 app.state.limiter
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    _limiter = Limiter(key_func=get_remote_address, enabled=True)
    limit_login = _limiter.limit("10/minute")
    limit_register = _limiter.limit("5/minute")
except ImportError:
    def limit_login(func):
        return func

    def limit_register(func):
        return func


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="用户注册",
)
@limit_register
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """通过手机号或邮箱 + 密码注册新用户。

    - 至少提供 phone 或 email 之一
    - 密码长度 6-128 字符
    - 成功返回 JWT access + refresh token
    """
    if not body.phone and not body.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="必须提供手机号或邮箱",
        )

    # 检查用户是否已存在
    conditions = []
    if body.phone:
        conditions.append(User.phone == body.phone)
    if body.email:
        conditions.append(User.email == body.email)

    result = await db.execute(select(User).where(or_(*conditions)))
    if result.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="手机号或邮箱已被注册",
        )

    # 创建用户
    user = User(
        phone=body.phone,
        email=body.email,
        password_hash=hash_password(body.password),
        role="user",
        status="active",
        nickname=body.nickname,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _issue_tokens(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="用户登录",
)
@limit_login
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """通过手机号或邮箱 + 密码登录。

    - 兼容前端 username 字段：若传入 username，自动判断为 phone 或 email
    - 成功返回 JWT access + refresh token
    - banned 用户拒绝登录
    """
    # 兼容前端 username 字段
    phone = body.phone
    email = body.email
    if body.username and not phone and not email:
        uname = body.username.strip()
        if "@" in uname:
            email = uname
        else:
            phone = uname

    if not phone and not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="必须提供手机号或邮箱",
        )

    # 查找用户
    conds = []
    if phone:
        conds.append(User.phone == phone)
    if email:
        conds.append(User.email == email)
    result = await db.execute(select(User).where(or_(*conds)))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号/邮箱或密码错误",
        )

    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用，请联系管理员",
        )

    # 更新最后登录时间
    # 注意: last_login_at 列是 TIMESTAMP WITHOUT TIME ZONE, 传 aware datetime 会触发
    # asyncpg "can't subtract offset-naive and offset-aware datetimes" 错误, 故剥离 tzinfo
    user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()

    return _issue_tokens(user)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="刷新访问令牌",
)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """使用 refresh token 获取新的 access token."""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或已过期的 refresh token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 缺少用户标识",
        )

    # 查库确认用户仍存在且未被禁用
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用",
        )

    return _issue_tokens(user)


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="获取当前用户信息",
)
async def get_me(current: User = Depends(get_current_user)) -> UserProfileResponse:
    """返回当前登录用户的完整信息（管理后台进入后首个调用）."""
    return UserProfileResponse.model_validate(current)


@router.post(
    "/logout",
    summary="退出登录",
)
async def logout(current: User = Depends(get_current_user)) -> dict:
    """退出登录.

    JWT 是无状态的，后端不做 token 拉黑（如需可加 Redis 黑名单）。
    前端清除本地 token 即可。
    """
    return {"message": "已退出登录"}


@router.post(
    "/change-password",
    summary="修改密码",
)
async def change_password(
    body: ChangePasswordRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """修改当前用户密码."""
    if not current.password_hash or not verify_password(body.old_password, current.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="原密码错误",
        )
    current.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"message": "密码修改成功"}


@router.post(
    "/wechat",
    response_model=TokenResponse,
    summary="微信登录",
)
async def wechat_login(
    body: WechatLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """通过微信授权码登录.

    未配置 WECHAT_APP_ID 时返回明确错误，不影响其他功能。
    """
    from app.core.config import settings

    if not settings.is_wechat_pay_enabled and not settings.WECHAT_APP_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="微信登录未配置 — 需在 .env 设置 WECHAT_APP_ID 并对接微信开放平台 API",
        )
    # TODO: 对接微信开放平台 API 获取 openid
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="微信登录功能待实现 — 需要对接微信开放平台 API",
    )
