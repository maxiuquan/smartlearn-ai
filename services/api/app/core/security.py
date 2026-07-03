"""
SmartLearn AI - 安全模块
密码哈希、JWT 令牌管理、API Key 轮转
"""
import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from passlib.context import CryptContext
from jose import JWTError, jwt

# ── 密码哈希 ──
# 使用 bcrypt 作为默认哈希算法
# 如果 bcrypt 不可用，则降级为 argon2
pwd_context = CryptContext(
    schemes=["bcrypt", "argon2"],
    deprecated="auto",
    bcrypt__rounds=12,
)

# ── JWT 配置 ──
JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_ACCESS_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("JWT_REFRESH_EXPIRE_DAYS", "7"))


def hash_password(password: str) -> str:
    """使用 bcrypt/argon2 哈希密码"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码是否匹配哈希值"""
    return pwd_context.verify(plain_password, hashed_password)


def needs_rehash(hashed_password: str) -> bool:
    """检查密码哈希是否需要更新（如算法轮次变更）"""
    return pwd_context.needs_update(hashed_password)


# ── JWT 令牌 ──


def create_access_token(
    subject: str,
    extra_claims: Optional[dict] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    创建 JWT Access Token

    Args:
        subject: 令牌主体 (通常是 user_id)
        extra_claims: 额外的 JWT claims
        expires_delta: 自定义过期时间，默认使用环境变量配置

    Returns:
        编码的 JWT 字符串
    """
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET 环境变量未设置")

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    if extra_claims:
        to_encode.update(extra_claims)

    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    创建 JWT Refresh Token

    Args:
        subject: 令牌主体 (通常是 user_id)
        expires_delta: 自定义过期时间

    Returns:
        编码的 JWT 字符串
    """
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET 环境变量未设置")

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
    }

    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    解码并验证 JWT 令牌

    Returns:
        (payload, error_message)
        成功时 payload 为 dict 且 error_message 为 None
        失败时 payload 为 None 且 error_message 包含错误描述
    """
    if not JWT_SECRET:
        return None, "JWT_SECRET 未配置"

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "令牌已过期"
    except jwt.JWTClaimsError:
        return None, "令牌 claims 无效"
    except JWTError:
        return None, "令牌验证失败"


def decode_access_token(token: str) -> Tuple[Optional[dict], Optional[str]]:
    """解码并验证 Access Token，额外检查 token type"""
    payload, error = decode_token(token)
    if error:
        return None, error
    if payload and payload.get("type") != "access":
        return None, "令牌类型错误 (需要 access token)"
    return payload, None


def decode_refresh_token(token: str) -> Tuple[Optional[dict], Optional[str]]:
    """解码并验证 Refresh Token，额外检查 token type"""
    payload, error = decode_token(token)
    if error:
        return None, error
    if payload and payload.get("type") != "refresh":
        return None, "令牌类型错误 (需要 refresh token)"
    return payload, None


# ── API Key 管理 ──


def generate_api_key(prefix: str = "sk") -> str:
    """
    生成安全的 API Key

    格式: {prefix}-{32字节随机hex}

    Args:
        prefix: 密钥前缀，默认 'sk'

    Returns:
        格式化的 API Key 字符串
    """
    random_part = secrets.token_hex(32)
    return f"{prefix}-{random_part}"


def hash_api_key(api_key: str) -> str:
    """
    使用 SHA-256 哈希 API Key (用于存储)

    Args:
        api_key: 明文 API Key

    Returns:
        SHA-256 哈希值
    """
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def verify_api_key(plain_key: str, hashed_key: str) -> bool:
    """
    验证 API Key 是否匹配存储的哈希值

    Args:
        plain_key: 用户提供的明文 API Key
        hashed_key: 数据库中存储的哈希值

    Returns:
        是否匹配
    """
    return hash_api_key(plain_key) == hashed_key


def rotate_api_key(old_key: str) -> str:
    """
    轮转 API Key: 生成新密钥并返回

    Args:
        old_key: 旧的 API Key (用于日志标识)

    Returns:
        新的 API Key
    """
    new_key = generate_api_key()
    return new_key