"""
ai-engine 全局鉴权模块

提供 FastAPI 依赖：
- `require_auth`：当 `AI_ENGINE_AUTH_ENABLED=true`（默认 true，生产）时，要求请求满足其一：
    (a) 请求头 `X-Api-Key` 等于环境变量 `AI_ENGINE_API_KEY`（服务间/网关凭证）；
    (b) 请求头 `Authorization: Bearer <jwt>`，且该 JWT 用**共享** `JWT_SECRET`
        （与 api 服务同一密钥，由 compose 注入相同值）校验通过。
  校验失败返回 401。

- `require_service_or_admin`：在 `require_auth` 基础上的更严格校验，用于
  `POST /prompts/{id}` 等写接口——仅允许持有 service key 或 `role=admin` 的 JWT；
  普通用户 JWT 应被拒（403）。

同时提供 `ensure_auth_configured()` 供 `main.py` 在启动期做 fail-fast 校验。
"""
import logging
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status

from config import settings

logger = logging.getLogger("ai_engine.auth")

# 复用 api 服务的 JWT 签名配置（同一密钥，由 compose 注入相同值）
JWT_SECRET: str = settings.JWT_SECRET
JWT_ALGORITHM: str = settings.JWT_ALGORITHM

# 允许写入 prompt 模板的角色
WRITE_ALLOWED_ROLES = {"admin", "service"}

# 默认/占位密钥（用于 fail-fast 判定，避免用代码默认值启动生产）
_WEAK_JWT_SECRETS = {
    "",
    "change-me-in-production",
    "change-me-to-a-secure-random-jwt-secret-at-least-32-chars",
}


def ensure_auth_configured() -> None:
    """
    启动期安全门槛（fail-fast）。

    当 `AI_ENGINE_AUTH_ENABLED=true` 但缺少必要密钥
    （`JWT_SECRET` 或 `AI_ENGINE_API_KEY`）时，拒绝启动进程。
    宁可启动失败，也不暴露一个未鉴权的 AI 服务。
    """
    if not settings.AI_ENGINE_AUTH_ENABLED:
        logger.warning(
            "ai-engine 鉴权已关闭 (AI_ENGINE_AUTH_ENABLED=false)。"
            "仅允许在本地开发/测试使用，生产环境必须开启。"
        )
        return

    missing: list[str] = []
    if JWT_SECRET in _WEAK_JWT_SECRETS:
        missing.append("JWT_SECRET")
    if not settings.AI_ENGINE_API_KEY:
        missing.append("AI_ENGINE_API_KEY")

    if missing:
        raise RuntimeError(
            "ai-engine 鉴权已启用 (AI_ENGINE_AUTH_ENABLED=true)，但缺少必要密钥: "
            + ", ".join(missing)
            + "。请通过环境变量注入，或将 AI_ENGINE_AUTH_ENABLED 显式设为 false"
            + "（不推荐用于生产环境）。"
        )


def _verify_jwt(token: str) -> Optional[dict]:
    """校验 JWT，成功返回 payload，失败返回 None。"""
    if not JWT_SECRET:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        logger.warning("JWT 已过期")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("JWT 校验失败: %s", e)
        return None


def require_auth(
    authorization: Optional[str] = Header(default=None),
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
) -> dict:
    """
    全局鉴权依赖。

    返回凭证信息 dict：`{"auth_type", "role", "sub", "payload"}`；
    鉴权关闭时返回 `{"auth_type": "disabled", "role": "anonymous"}`。
    校验失败抛出 401。
    """
    # 鉴权关闭：仅本地开发/测试放行
    if not settings.AI_ENGINE_AUTH_ENABLED:
        return {"auth_type": "disabled", "role": "anonymous"}

    # (a) X-Api-Key（服务间 / 网关凭证）
    if x_api_key and settings.AI_ENGINE_API_KEY and x_api_key == settings.AI_ENGINE_API_KEY:
        return {"auth_type": "api_key", "role": "service", "sub": None, "payload": None}

    # (b) Bearer JWT（复用 api 的 JWT_SECRET 校验）
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token:
            payload = _verify_jwt(token)
            if payload is not None:
                return {
                    "auth_type": "jwt",
                    "role": payload.get("role", "user"),
                    "sub": payload.get("sub"),
                    "payload": payload,
                }

    logger.warning("鉴权失败：缺少有效凭证（无 X-Api-Key 或有效 Bearer JWT）")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="未授权：请提供有效的 X-Api-Key 或 Authorization: Bearer <JWT>",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_service_or_admin(
    creds: dict = Depends(require_auth),
) -> dict:
    """
    写接口权限校验（C3）：仅允许 service key 或 admin 角色。

    - service key（X-Api-Key）直接放行；
    - `role=admin` 的 JWT 放行；
    - 普通用户 JWT / 其他角色 → 403；
    - 鉴权关闭时放行（本地开发）。
    """
    # 鉴权关闭时不限制
    if creds.get("auth_type") == "disabled":
        return creds

    auth_type = creds.get("auth_type")
    role = creds.get("role", "user")

    # 服务间密钥直接放行
    if auth_type == "api_key":
        return creds

    # admin 角色放行
    if role in WRITE_ALLOWED_ROLES:
        return creds

    logger.warning(
        "越权写尝试被拒 (403)：role=%s auth_type=%s",
        role,
        auth_type,
    )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="禁止访问：修改 prompt 模板需要 service key 或 admin 角色",
    )
