"""
SmartLearn AI - 安全模块
密码哈希、JWT 令牌管理（含 sid/jti/轮转/撤销）、API Key（HMAC + 恒定时间比较）

P0-2: JWT/会话体系重构
- Access Token 增加 sid（会话 ID）、jti（唯一标识）、token_use、iss、aud claims
- Refresh Token 单次轮转：旧 token 用后即弃，重放检测撤销整条会话链
- Redis 黑名单：logout/封禁/密码修改后 token 即时失效
- RS256/ES256 建议（当前仍用 HS256，可通过环境变量切换）

P0-3: API Key 改为 HMAC + 恒定时间比较
- 格式改为 sl_live_<key_id>_<random_secret>
- 存储 HMAC(server_pepper, full_key)，pepper 从环境变量读取
- 使用 hmac.compare_digest 恒定时间比较
"""
import os
import secrets
import hashlib
import hmac
import base64
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from passlib.context import CryptContext
from jose import JWTError, jwt

# ── 密码哈希 ──
pwd_context = CryptContext(
    schemes=["bcrypt", "argon2"],
    deprecated="auto",
    bcrypt__rounds=12,
)

from app.core.config import KNOWN_WEAK_JWT_SECRETS, settings as _settings

JWT_SECRET = _settings.JWT_SECRET
JWT_ALGORITHM = _settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = _settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = _settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS

# JWT issuer/audience（可从环境变量配置）
JWT_ISSUER = os.environ.get("JWT_ISSUER", "smartlearn-ai")
JWT_AUDIENCE = os.environ.get("JWT_AUDIENCE", "smartlearn-users")

# API Key HMAC pepper（从环境变量读取，不在数据库存储）
API_KEY_PEPPER = os.environ.get("API_KEY_PEPPER", "")


def hash_password(password: str) -> str:
    """使用 bcrypt/argon2 哈希密码"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码是否匹配哈希值"""
    return pwd_context.verify(plain_password, hashed_password)


def needs_rehash(hashed_password: str) -> bool:
    """检查密码哈希是否需要更新"""
    return pwd_context.needs_update(hashed_password)


# ── JWT 令牌（P0-2 重构）──


def create_access_token(
    subject: str,
    extra_claims: Optional[dict] = None,
    expires_delta: Optional[timedelta] = None,
    session_id: Optional[str] = None,
) -> str:
    """创建 JWT Access Token

    P0-2: 增加 sid（会话 ID）、jti（唯一标识）、iss、aud claims
    """
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET 环境变量未设置")

    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": subject,
        "exp": expire,
        "iat": now,
        "nbf": now,
        "type": "access",
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "jti": str(uuid.uuid4()),
        "sid": session_id or str(uuid.uuid4()),
        "token_use": "access",
    }
    if extra_claims:
        to_encode.update(extra_claims)

    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
    session_id: Optional[str] = None,
) -> str:
    """创建 JWT Refresh Token

    P0-2: 增加 sid、jti claims 用于轮转和重放检测
    """
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET 环境变量未设置")

    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "sub": subject,
        "exp": expire,
        "iat": now,
        "nbf": now,
        "type": "refresh",
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "jti": str(uuid.uuid4()),
        "sid": session_id or str(uuid.uuid4()),
        "token_use": "refresh",
    }

    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """解码并验证 JWT 令牌（含 iss/aud 校验）"""
    if not JWT_SECRET:
        return None

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTClaimsError:
        return None
    except JWTError:
        return None


def decode_access_token(token: str) -> Optional[dict]:
    """解码并验证 Access Token"""
    payload = decode_token(token)
    if payload is None:
        return None
    if payload.get("type") != "access" and payload.get("token_use") != "access":
        return None
    return payload


def decode_refresh_token(token: str) -> Optional[dict]:
    """解码并验证 Refresh Token"""
    payload = decode_token(token)
    if payload is None:
        return None
    if payload.get("type") != "refresh" and payload.get("token_use") != "refresh":
        return None
    return payload


def assert_strong_jwt_secret(secret: Optional[str] = None) -> None:
    """精确相等 + 强度校验 JWT 密钥"""
    target = secret if secret is not None else JWT_SECRET
    cleaned = (target or "").strip()
    if not cleaned:
        raise ValueError("JWT_SECRET 为空，请设置长度 ≥ 32 的强随机密钥")
    if cleaned in KNOWN_WEAK_JWT_SECRETS:
        raise ValueError(f"JWT_SECRET 为弱默认/占位值 '{cleaned}'，请更换为强随机密钥")
    if len(cleaned) < 32:
        raise ValueError("JWT_SECRET 长度不足 32 字符，存在暴力破解风险")


# ── Token 黑名单（Redis）──


async def is_token_revoked(token_jti: str, redis_client=None) -> bool:
    """检查 token 是否在 Redis 黑名单中（已撤销）

    P0-2: logout/封禁/密码修改后将 jti 加入黑名单
    """
    if not redis_client or not token_jti:
        return False
    try:
        result = await redis_client.get(f"revoked:{token_jti}")
        return result is not None
    except Exception:
        return False


async def revoke_token(token_jti: str, expires_at: int, redis_client=None) -> None:
    """将 token 加入 Redis 黑名单

    Args:
        token_jti: JWT 的 jti claim
        expires_at: token 原始过期时间戳（Unix 秒），黑名单条目在此后自动过期
        redis_client: Redis 客户端
    """
    if not redis_client or not token_jti:
        return
    try:
        import time
        ttl = max(0, expires_at - int(time.time()))
        if ttl > 0:
            await redis_client.setex(f"revoked:{token_jti}", ttl, "1")
    except Exception:
        pass


async def revoke_session(session_id: str, redis_client=None) -> None:
    """撤销整个会话（所有该 sid 的 token 失效）

    P0-2: 密码修改/全部退出时调用
    """
    if not redis_client or not session_id:
        return
    try:
        # 会话撤销标记，TTL 设为 refresh token 最长有效期
        await redis_client.setex(
            f"session_revoked:{session_id}",
            REFRESH_TOKEN_EXPIRE_DAYS * 86400,
            "1",
        )
    except Exception:
        pass


async def is_session_revoked(session_id: str, redis_client=None) -> bool:
    """检查会话是否已撤销"""
    if not redis_client or not session_id:
        return False
    try:
        result = await redis_client.get(f"session_revoked:{session_id}")
        return result is not None
    except Exception:
        return False


# ── API Key 管理（P0-3: HMAC + 恒定时间比较）──


def generate_api_key(prefix: str = "sl_live") -> str:
    """生成安全的 API Key

    P0-3: 格式改为 sl_live_<key_id>_<random_secret>
    """
    key_id = secrets.token_urlsafe(9)
    random_secret = secrets.token_urlsafe(32)
    return f"{prefix}_{key_id}_{random_secret}"


def hash_api_key(api_key: str) -> str:
    """使用 HMAC-SHA256 哈希 API Key

    P0-3: 从裸 SHA-256 改为 HMAC(pepper, key)
    pepper 从环境变量 API_KEY_PEPPER 读取
    """
    pepper = API_KEY_PEPPER.encode("utf-8") if API_KEY_PEPPER else b"smartlearn-default-pepper"
    digest = hmac.new(pepper, api_key.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8")


def verify_api_key(plain_key: str, hashed_key: str) -> bool:
    """验证 API Key（恒定时间比较）

    P0-3: 使用 hmac.compare_digest 防止时序攻击
    """
    computed = hash_api_key(plain_key)
    return hmac.compare_digest(computed, hashed_key)


def rotate_api_key(old_key: str) -> str:
    """轮转 API Key：生成新 key

    注意：调用方需将旧 key 标记为失效（更新数据库 status 字段）
    """
    return generate_api_key()
