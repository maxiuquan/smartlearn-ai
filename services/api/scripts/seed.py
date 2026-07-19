"""
填充初始数据（默认超级管理员账号等）

用法: python scripts/seed.py
前置条件: 已执行 `alembic upgrade head` 创建表结构。

设计依据: 整改设计-2026-07-08 B2（P0-6）
- 删除原 achievements 裸建表（CREATE TABLE）与 psycopg2 直接写库
- 改为经 ORM 模型（User）写入与现有 schema 一致的初始数据
- 角色由 users.role 字符串字段承载（user/teacher/admin/super_admin），
  无独立角色表，故仅创建管理员账号，不创建角色记录
- 幂等：账号已存在则跳过
"""
import os
import sys
import logging

# 将 services/api 加入 sys.path，以便 `import app`
API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# 初始管理员账号（密码可通过环境变量覆盖；默认仅用于本地/演示初始化）
# 注意: 默认邮箱使用 .io TLD（避免 Pydantic EmailStr 拒绝 .local 等保留 TLD）
ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@smartlearn.io")
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "Admin@12345678")
ADMIN_NICKNAME = os.environ.get("SEED_ADMIN_NICKNAME", "系统管理员")


def main() -> None:
    with SessionLocal() as db:
        existing = db.execute(
            select(User).where(User.email == ADMIN_EMAIL)
        ).scalar_one_or_none()
        if existing is not None:
            # 账号已存在: 同步密码(支持通过 SEED_ADMIN_PASSWORD 环境变量重置密码)
            new_hash = hash_password(ADMIN_PASSWORD)
            if existing.password_hash != new_hash:
                existing.password_hash = new_hash
                existing.role = "super_admin"
                existing.status = "active"
                if ADMIN_NICKNAME:
                    existing.nickname = ADMIN_NICKNAME
                db.commit()
                logger.info("[UPDATE] 管理员账号 %s 密码已同步", ADMIN_EMAIL)
            else:
                logger.info("[SKIP] 管理员账号 %s 已存在，密码未变", ADMIN_EMAIL)
            return

        admin = User(
            email=ADMIN_EMAIL,
            nickname=ADMIN_NICKNAME,
            password_hash=hash_password(ADMIN_PASSWORD),
            role="super_admin",
            status="active",
        )
        db.add(admin)
        db.commit()
        logger.info("[OK] 已创建初始超级管理员账号: %s (role=super_admin)", ADMIN_EMAIL)

        if ADMIN_PASSWORD == "Admin@12345678":
            logger.warning(
                "⚠️  使用了默认初始管理员密码，请尽快通过管理后台修改，"
                "或设置环境变量 SEED_ADMIN_PASSWORD 自定义强密码。"
            )


if __name__ == "__main__":
    main()
