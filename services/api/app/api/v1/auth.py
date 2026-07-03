"""认证相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserProfileResponse,
    WechatLoginRequest,
)

router = APIRouter()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="用户注册",
)
async def register(
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
        conditions.append(users.c.phone == body.phone)
    if body.email:
        conditions.append(users.c.email == body.email)

    from sqlalchemy import or_

    # 使用原始 SQL 查询因为还没有 ORM 模型定义
    if body.phone:
        result = await db.execute(
            select(users).where(
                or_(users.c.phone == body.phone, users.c.email == body.email)
            )
        )
        existing = result.first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="手机号或邮箱已被注册",
            )

    # 创建用户
    hashed = hash_password(body.password)
    insert_stmt = (
        users.insert()
        .values(
            phone=body.phone,
            email=body.email,
            password_hash=hashed,
            role="user",
        )
        .returning(users.c.id)
    )
    result = await db.execute(insert_stmt)
    user_id = result.scalar_one()
    await db.commit()

    # 生成 token
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    from app.core.config import settings

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="用户登录",
)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """通过手机号或邮箱 + 密码登录。

    - 成功返回 JWT access + refresh token
    """
    if not body.phone and not body.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="必须提供手机号或邮箱",
        )

    # 查找用户
    from sqlalchemy import or_

    result = await db.execute(
        select(users).where(
            or_(users.c.phone == body.phone, users.c.email == body.email)
        )
    )
    user = result.first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号/邮箱或密码错误",
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    from app.core.config import settings

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="刷新访问令牌",
)
async def refresh_token(body: RefreshRequest) -> TokenResponse:
    """使用 refresh token 获取新的 access token。

    - refresh token 有效期 7 天
    """
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

    access_token = create_access_token(int(user_id))
    refresh_token_new = create_refresh_token(int(user_id))

    from app.core.config import settings

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_new,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/wechat",
    response_model=TokenResponse,
    summary="微信登录",
)
async def wechat_login(
    body: WechatLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """通过微信授权码登录。

    - 首次登录自动注册
    - 返回 JWT access + refresh token
    """
    # TODO: 调用微信 API 获取 openid
    # 此处为占位实现，实际需要对接微信开放平台
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="微信登录功能待实现 — 需要对接微信开放平台 API",
    )


# --- SQLAlchemy 表引用（用于原始 SQL 查询） ---
from sqlalchemy import Column, DateTime, Integer, String, Table, MetaData, func

metadata = MetaData()

users = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("phone", String(20)),
    Column("email", String(255)),
    Column("password_hash", String(255)),
    Column("wechat_openid", String(128)),
    Column("role", String(20)),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)