"""AuditLog ORM model — 管理员操作审计日志.

安全策略（P1 安全加固）:
    审计日志为仅追加（append-only）数据。任何 UPDATE 或 DELETE 操作均被禁止，
    以保证审计记录的完整性与不可篡改性。

    代码层强制:
      - 所有写入均通过 `db.add(AuditLog(...))` + `db.commit()` 插入新行
      - 审计日志 API（/api/v1/audit-logs/）仅提供 GET 查询，不提供 PUT/PATCH/DELETE
      - 本模型不提供任何 update/delete 便捷方法

    数据库层强制（建议）:
      - 生产环境应通过 PostgreSQL REVOKE UPDATE, DELETE ON audit_logs FROM app_role
      - 或创建 BEFORE UPDATE / BEFORE DELETE 触发器 RAISE EXCEPTION 阻止修改
"""
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    """审计日志表（管理员所有写操作均记录）。

    ⚠️ 仅追加（append-only）: 禁止 UPDATE / DELETE。
    一旦写入即不可修改、不可删除，确保审计链完整。

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
