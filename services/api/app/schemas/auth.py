"""认证相关 Pydantic schemas"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """用户注册请求"""

    phone: Optional[str] = Field(None, max_length=20, pattern=r"^1[3-9]\d{9}$")
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=6, max_length=128)
    nickname: Optional[str] = Field(None, max_length=100)

    model_config = {"extra": "forbid"}


class LoginRequest(BaseModel):
    """用户登录请求.

    前端可传 username（自动判断为 phone 或 email）或直接传 phone/email。
    """

    username: Optional[str] = Field(
        None, description="手机号或邮箱（兼容前端 username 字段）"
    )
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=1)

    model_config = {"extra": "forbid"}


class TokenResponse(BaseModel):
    """JWT Token 响应"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token 过期时间（秒）")


class RefreshRequest(BaseModel):
    """刷新 Token 请求

    P1 修复 (2026-07-20): refresh_token 改为 Optional,
    因为前端通过 HttpOnly Cookie 自动携带 refresh_token, body 传 {} 即可。
    原必填字段导致 Pydantic 解析失败返回 422, 使页面刷新后无法保持登录态。
    """

    refresh_token: Optional[str] = None


class WechatLoginRequest(BaseModel):
    """微信登录请求"""

    code: str = Field(..., description="微信授权 code")


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""

    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


class UserProfileResponse(BaseModel):
    """用户信息响应"""

    id: int
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    status: str = "active"
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    vip_level: int = 0
    vip_expire_at: Optional[datetime] = None
    ai_quota_daily_override: Optional[int] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
