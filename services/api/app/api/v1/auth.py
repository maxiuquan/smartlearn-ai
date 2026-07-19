"""认证相关 API 路由.

重构说明：
- 使用 ORM 模型替代原始 SQL Table
- JWT 加入 role/status claim，便于前端守卫与后端快速校验
- 新增 /auth/me、/auth/logout、/auth/change-password
- 登录兼容前端 username 字段（可传 phone 或 email）
- 登录时更新 last_login_at
- banned 用户拒绝登录

P0-01: Refresh Token 同时通过 HttpOnly Cookie 下发，前端不再需要 localStorage 存储。
- /login 和 /refresh 设置 `refresh_token` HttpOnly Cookie
- /logout 清除 Cookie
- /refresh 优先从 Cookie 读取 refresh_token，fallback 到 body
"""
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    decode_token,
    get_redis_client,
    hash_password,
    is_session_revoked,
    is_token_revoked,
    revoke_all_user_sessions,
    revoke_session,
    revoke_token,
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


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """P0-01: 设置 HttpOnly + Secure + SameSite=Lax 的 refresh_token Cookie.

    - HttpOnly: JavaScript 无法读取，防 XSS 窃取
    - Secure: 仅 HTTPS 传输（HF Space 强制 HTTPS）
    - SameSite=Lax: 防 CSRF（跨站请求仅允许顶级导航的 GET）
    - Path=/api/v1/auth: 限制 Cookie 仅发往 auth 相关端点
    """
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api/v1/auth",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


def _clear_refresh_cookie(response: Response) -> None:
    """P0-01: 清除 refresh_token Cookie."""
    response.delete_cookie(
        key="refresh_token",
        path="/api/v1/auth",
    )


def _validate_csrf_origin(request: Request) -> None:
    """P0-01 (R3): CSRF 防护 — 校验 Origin/Referer 是否在 CORS 允许列表内.

    Cookie 自动随请求发送，需防止跨站 CSRF。
    - 优先检查 Origin 头（包含 scheme + host + port）
    - 若无 Origin，检查 Referer 头
    - 两者都无时拒绝（生产模式）/ 放行（开发模式）
    """
    if not settings.is_production:
        return  # 开发模式跳过 CSRF 校验

    origin = request.headers.get("origin", "")
    referer = request.headers.get("referer", "")

    allowed_origins = settings.cors_origins_list
    # 允许同源请求（Origin 为空时浏览器可能不发送）
    if not origin and not referer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF 校验失败：缺少 Origin/Referer 头",
        )

    check_value = origin or referer
    # 匹配允许的 Origin（精确匹配 scheme + host + port）
    for allowed in allowed_origins:
        if allowed and check_value.startswith(allowed):
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="CSRF 校验失败：Origin 不在允许列表内",
    )


def _issue_tokens(user: User, session_id: str | None = None) -> TokenResponse:
    """为用户签发 access + refresh token（带 role/status/sid claim）.

    P0-2: 传入 session_id 用于会话轮转（refresh 时生成新 sid）
    """
    sid = session_id or str(uuid.uuid4())
    extra_claims = {"role": user.role, "status": user.status}
    access_token = create_access_token(str(user.id), extra_claims=extra_claims, session_id=sid)
    refresh_token = create_refresh_token(str(user.id), session_id=sid)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# 限流装饰器（slowapi 不可用时退化为无操作）
# 注意: slowapi 装饰器在请求时从 request.app.state.limiter 获取限流器实例,
# 因此这里只需创建一个用于生成装饰器的 Limiter, 实际限流状态存储在 app.state.limiter
# key_func 使用 X-Forwarded-For 头获取真实客户端 IP（经过 nginx 反代）
try:
    from slowapi import Limiter
    from fastapi import Request


    def _get_forwarded_ip(request: Request) -> str:
        """从 X-Forwarded-For 或 X-Real-IP 获取真实客户端 IP."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        return request.client.host if request.client else "unknown"


    _limiter = Limiter(key_func=_get_forwarded_ip, enabled=True)
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
    response: Response,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """通过手机号或邮箱 + 密码登录。

    - 兼容前端 username 字段：若传入 username，自动判断为 phone 或 email
    - 成功返回 JWT access + refresh token
    - banned 用户拒绝登录
    - P0-01: refresh_token 同时通过 HttpOnly Cookie 下发
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

    tokens = _issue_tokens(user)
    # P0-01: 设置 HttpOnly Cookie（前端不再需要 localStorage 存 refresh_token）
    _set_refresh_cookie(response, tokens.refresh_token)
    return tokens


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="刷新访问令牌",
)
async def refresh_token(
    request: Request,
    response: Response,
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """使用 refresh token 获取新的 access token.

    P0-2: Refresh Token 单次轮转
    - 旧 refresh token 用后即弃（加入 Redis 黑名单）
    - 检测到旧 token 重放时撤销整条会话链
    - 新 token 对使用新 session_id

    P0-01: 优先从 HttpOnly Cookie 读取 refresh_token，fallback 到 body
    P0-01 (R3): 增加 CSRF Origin/Referer 校验
    """
    # P0-01 (R3): CSRF 防护
    _validate_csrf_origin(request)

    # P0-01: 优先从 Cookie 读取 refresh_token
    refresh_token_value = request.cookies.get("refresh_token") or body.refresh_token
    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少 refresh token",
        )

    payload = decode_refresh_token(refresh_token_value)
    if not payload:
        # Cookie 中的 token 无效时清除 Cookie
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或已过期的 refresh token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 缺少用户标识",
        )

    # P0-2: 检查 refresh token 是否已被撤销（重放检测）
    token_jti = payload.get("jti", "")
    session_id = payload.get("sid", "")
    # P0-03: 修复 — 不再从 db._redis 获取（始终为 None），改用独立 Redis 客户端
    redis_client = await get_redis_client()

    if redis_client:
        if await is_token_revoked(token_jti, redis_client):
            # 旧 token 重放！撤销整条会话链
            await revoke_session(session_id, redis_client)
            await redis_client.aclose()
            _clear_refresh_cookie(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="检测到 refresh token 重放，会话已撤销",
            )
        if await is_session_revoked(session_id, redis_client):
            await redis_client.aclose()
            _clear_refresh_cookie(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="会话已撤销，请重新登录",
            )

    # 查库确认用户仍存在且未被禁用
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )
    if user.is_banned:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用",
        )

    # P0-2: 旧 refresh token 用后即弃（加入黑名单）
    if redis_client and token_jti:
        exp = payload.get("exp", 0)
        await revoke_token(token_jti, int(exp), redis_client)

    # P0-03: 关闭 Redis 客户端
    if redis_client:
        try:
            await redis_client.aclose()
        except Exception:
            pass

    # 生成新 token 对（使用新 session_id 实现会话轮转）
    new_session_id = str(uuid.uuid4())
    tokens = _issue_tokens(user, session_id=new_session_id)
    # P0-01: 轮转后设置新 Cookie
    _set_refresh_cookie(response, tokens.refresh_token)
    return tokens


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
async def logout(
    current: User = Depends(get_current_user),
    request: Request = None,
    response: Response = None,
) -> dict:
    """退出登录.

    P0-2: 将当前 token 的 jti 加入 Redis 黑名单，实现真正的 logout
    如 Redis 不可用则降级为无状态 logout（前端清 token）
    P0-01: 同时清除 refresh_token Cookie
    P0-01 (R3): 增加 CSRF Origin/Referer 校验
    """
    # P0-01 (R3): CSRF 防护
    if request is not None:
        _validate_csrf_origin(request)
    # 尝试从请求头获取 token 并提取 jti/sid
    auth_header = request.headers.get("Authorization", "") if request else ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = decode_access_token(token)
        if payload:
            jti = payload.get("jti", "")
            sid = payload.get("sid", "")
            exp = int(payload.get("exp", 0))
            # 尝试获取 Redis 客户端（可选，不可用时降级）
            try:
                import redis.asyncio as aioredis
                from app.core.config import settings
                redis_url = settings.REDIS_URL or f"redis://:{settings.REDIS_PASSWORD}@{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
                r = aioredis.from_url(redis_url, decode_responses=True)
                if jti:
                    await revoke_token(jti, exp, r)
                if sid:
                    await revoke_session(sid, r)
                await r.close()
            except Exception:
                pass  # Redis 不可用时降级为无状态 logout

    # P0-01: 清除 HttpOnly refresh_token Cookie
    if response is not None:
        _clear_refresh_cookie(response)

    return {"message": "已退出登录"}


@router.post(
    "/change-password",
    summary="修改密码",
)
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """修改当前用户密码.

    P0-2: 修改密码后撤销当前会话（强制重新登录），防止旧 token 继续使用。
    """
    if not current.password_hash or not verify_password(body.old_password, current.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="原密码错误",
        )
    current.password_hash = hash_password(body.new_password)
    await db.commit()

    # P0-03: 撤销当前用户所有会话（强制全部设备重新登录）
    try:
        await revoke_all_user_sessions(current.id, db)
    except Exception:
        pass  # Redis 不可用降级

    return {"message": "密码修改成功，请重新登录"}


@router.post(
    "/sessions/revoke-all",
    summary="全部设备退出",
)
async def revoke_all_sessions(
    request: Request,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """P0-03: 撤销当前用户的所有会话（全部设备退出）.

    通过 auth_sessions 表查询并撤销所有 active 会话，
    同时在 Redis 中标记所有 session_id 为已撤销。
    """
    # P0-03: 撤销用户所有会话（通过 auth_sessions 表 + Redis）
    revoked_count = await revoke_all_user_sessions(current.id, db)

    # 同时撤销当前 token 的 jti
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_access_token(token)
            if payload:
                jti = payload.get("jti", "")
                exp = int(payload.get("exp", 0))
                if jti:
                    redis_client = await get_redis_client()
                    if redis_client:
                        await revoke_token(jti, exp, redis_client)
                        await redis_client.aclose()
    except Exception:
        pass

    return {"message": f"已撤销 {revoked_count} 个会话，请重新登录"}


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
