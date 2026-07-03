"""认证相关 Pydantic schemas"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """用户注册请求"""

    phone: Optional[str] = Field(None, max_length=20, pattern=r"^1[3-9]\d{9}$")
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=6, max_length=128)

    model_config = {"extra": "forbid"}


class LoginRequest(BaseModel):
    """用户登录请求"""

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
    """刷新 Token 请求"""

    refresh_token: str


class WechatLoginRequest(BaseModel):
    """微信登录请求"""

    code: str = Field(..., description="微信授权 code")


class UserProfileResponse(BaseModel):
    """用户信息响应"""

    id: int
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}