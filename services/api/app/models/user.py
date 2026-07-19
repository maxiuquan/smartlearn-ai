"""User ORM model."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    """用户表。

    role: user / teacher / admin / super_admin
    status: active / banned / deleted（P1-4.7 软删除）
    vip_level: 0=普通, 1=基础, 2=高级, 3=至尊 (由 admin 手动调整)
    vip_expire_at: VIP 过期时间，NULL 表示永久或非 VIP
    ai_quota_daily_override: 覆盖 subscriptions.ai_quota_daily，NULL 表示走订阅默认值
    deleted_at: 软删除时间戳；非 NULL 时该用户被视为已删除（PII 已匿名化）
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    wechat_openid: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)

    # 角色与状态
    role: Mapped[str] = mapped_column(String(20), server_default="user", nullable=False)
    status: Mapped[str] = mapped_column(String(20), server_default="active", nullable=False, index=True)

    # 资料
    nickname: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # VIP / 会员（管理员手动调整）
    vip_level: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False, index=True)
    vip_expire_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ai_quota_daily_override: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # P1-4.7: 软删除字段
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} role={self.role} status={self.status}>"

    # ── 便捷属性 ──
    @property
    def is_admin(self) -> bool:
        return self.role in ("admin", "super_admin")

    @property
    def is_super_admin(self) -> bool:
        return self.role == "super_admin"

    @property
    def is_banned(self) -> bool:
        return self.status == "banned"

    @property
    def is_deleted(self) -> bool:
        """P1-4.7: 是否已被软删除。"""
        return self.status == "deleted" or self.deleted_at is not None

    @property
    def display_name(self) -> str:
        """用于日志/列表展示的名称。"""
        return self.nickname or self.email or self.phone or f"user_{self.id}"
