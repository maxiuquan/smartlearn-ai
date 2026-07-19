"""认证会话模型 (P0-2).

记录每次登录的会话元数据，支持设备管理、全部退出、管理员强制下线。
Refresh Token 哈希持久化存储，用于服务端校验与撤销。
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuthSession(Base):
    """用户认证会话记录.

    每次 login/register/refresh 创建一条记录。
    sid 字段与 JWT 中的 sid claim 对应，用于会话级撤销。
    """
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    session_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False, comment="JWT sid claim")
    refresh_token_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="Refresh Token 哈希（HMAC）")

    # 设备/客户端信息
    device_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="设备名称")
    device_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True, comment="设备标识")
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment="登录 IP")

    # 状态
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False, index=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    revoke_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="logout/password_changed/admin_revoke/revoke_all")

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    last_active_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="会话过期时间")

    def __repr__(self) -> str:
        return f"<AuthSession id={self.id} user_id={self.user_id} sid={self.session_id[:8]}... revoked={self.is_revoked}>"
