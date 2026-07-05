"""AuditLog ORM model — 管理员操作审计日志."""
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    """审计日志表（管理员所有写操作均记录）。

    actor: 操作者展示名（如 admin@x.com）
    actor_id: 操作者 user_id（便于按管理员筛选）
    action: 动作类型（如 user.ban / user.role.update / system.config.update）
    target: 操作目标（如 user:42）
    details: 详细变更内容（JSONB）
    """

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    actor_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} action={self.action} target={self.target}>"
