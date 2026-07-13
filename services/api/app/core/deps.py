"""FastAPI dependencies for auth and database access.

P0-2: token 撤销检查（Redis 黑名单 / 会话撤销），Redis 不可用时降级为无状态。
"""
from typing import AsyncGenerator, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    decode_token,
    is_session_revoked,
    is_token_revoked,
)
from app.db.session import async_session_factory
from app.models.user import User

security_scheme = HTTPBearer()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_redis(request: Request):
    """获取可选的 Redis 客户端（P0-2 token 撤销检查用）.

    Redis 不可用时返回 None，调用方需做空值降级。
    """
    client = getattr(request.app.state, "redis", None)
    if client is not None:
        return client
    # 尝试临时建立连接（兼容未在 app.state 注入的场景）
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings

        url = settings.redis_url
        client = aioredis.from_url(url, decode_responses=True)
        await client.ping()
        # 注意：此处返回的连接由调用方负责关闭
        return client
    except Exception:
        return None


async def _check_token_revocation(payload: dict, request: Request) -> None:
    """P0-2: 检查 access token 是否已撤销（jti 黑名单 / 会话撤销）.

    Redis 不可用时静默降级（不阻塞请求），保证可用性。
    """
    redis_client = await get_redis(request)
    if redis_client is None:
        return
    try:
        jti = payload.get("jti", "")
        sid = payload.get("sid", "")
        if jti and await is_token_revoked(jti, redis_client):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="令牌已撤销，请重新登录",
            )
        if sid and await is_session_revoked(sid, redis_client):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="会话已失效，请重新登录",
            )
    finally:
        # 仅关闭临时建立的连接，app.state 注入的连接由应用管理
        if not hasattr(request.app.state, "redis"):
            try:
                await redis_client.aclose()
            except Exception:
                pass


async def get_current_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> int:
    """Extract user ID from JWT token (lightweight, no DB lookup).

    - 校验 JWT 签名、过期、type
    - P0-2: 检查 token 撤销状态（Redis 黑名单 / 会话撤销）
    - 校验 status claim，拒绝被封禁用户的令牌（即使签名有效）
    """
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或已过期的访问令牌",
        )
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 缺少用户标识",
        )
    # P0-2: 撤销检查（Redis 不可用降级）
    await _check_token_revocation(payload, request)
    # 校验 status claim：banned 用户的令牌即使未过期也拒绝
    token_status = payload.get("status")
    if token_status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用，请联系管理员",
        )
    return int(sub)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """返回当前登录的完整 User 对象（查库，验状态）.

    - P0-2: 检查 token 撤销状态（Redis 黑名单 / 会话撤销）
    - 拒绝 banned 用户
    - JWT 中带 role/status claim 时优先校验，避免被封禁后仍能用旧 token
    """
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或已过期的访问令牌",
        )
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 缺少用户标识",
        )

    # P0-2: 撤销检查（Redis 不可用降级）
    await _check_token_revocation(payload, request)

    user_id = int(sub)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用，请联系管理员",
        )
    return user


async def get_current_admin_user(
    current: User = Depends(get_current_user),
) -> User:
    """要求当前用户是管理员（admin 或 super_admin）."""
    if not current.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return current


async def get_current_super_admin(
    current: User = Depends(get_current_user),
) -> User:
    """要求当前用户是超级管理员."""
    if not current.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要超级管理员权限",
        )
    return current


async def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> Optional[int]:
    """Extract user ID from JWT token if present, otherwise None."""
    if credentials is None:
        return None
    token = credentials.credentials
    payload = decode_token(token)
    if payload is None:
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    return int(sub)
