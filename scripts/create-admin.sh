#!/usr/bin/env bash
# ============================================================
# SmartLearn AI - 创建超级管理员账号脚本
# ============================================================
# 用法:
#   bash scripts/create-admin.sh                                 # 交互式输入
#   bash scripts/create-admin.sh admin@example.com MyP@ssw0rd    # 直接传参
#   bash scripts/create-admin.sh admin@example.com MyP@ssw0rd 13800000000
#
# 行为:
#   - 若邮箱已存在: 升级为 super_admin 并更新密码
#   - 若邮箱不存在: 创建新 super_admin 用户
# ============================================================
set -euo pipefail

# ── 颜色输出 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Compose 命令
COMPOSE="docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml"

# ── 收集参数 ──
EMAIL="${1:-}"
PASSWORD="${2:-}"
PHONE="${3:-}"

if [ -z "$EMAIL" ]; then
  read -r -p "请输入管理员邮箱: " EMAIL
  if [ -z "$EMAIL" ]; then
    error "邮箱不能为空"
    exit 1
  fi
fi

if [ -z "$PASSWORD" ]; then
  # 交互式输入 (隐藏输入)
  read -r -s -p "请输入管理员密码 (≥8 位): " PASSWORD
  echo ""
  if [ -z "$PASSWORD" ]; then
    error "密码不能为空"
    exit 1
  fi
  if [ "${#PASSWORD}" -lt 8 ]; then
    error "密码长度不足 8 位"
    exit 1
  fi
  read -r -s -p "请再次输入密码确认: " PASSWORD_CONFIRM
  echo ""
  if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
    error "两次输入的密码不一致"
    exit 1
  fi
fi

# 简单校验邮箱格式
if ! echo "$EMAIL" | grep -qE '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
  error "邮箱格式不正确: $EMAIL"
  exit 1
fi

# 校验密码长度
if [ "${#PASSWORD}" -lt 8 ]; then
  error "密码长度不足 8 位"
  exit 1
fi

info "将为 $EMAIL 创建/升级超级管理员账号..."

# ── 转义单引号 (防止 Python 代码注入) ──
escape_sq() {
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
}

EMAIL_ESC="$(escape_sq "$EMAIL")"
PASSWORD_ESC="$(escape_sq "$PASSWORD")"
PHONE_ESC="$(escape_sq "$PHONE")"

# ── 在 api 容器中执行 Python 代码创建/升级用户 ──
# 使用 ORM (app.models.user.User + app.core.security.hash_password)
# 通过 asyncio 运行异步 session
PYTHON_CODE=$(cat <<'PYEOF'
import asyncio
import sys

from sqlalchemy import select

from app.db.session import async_session_factory
from app.models.user import User
from app.core.security import hash_password

EMAIL = "__EMAIL__"
PASSWORD = "__PASSWORD__"
PHONE = "__PHONE__" or None


async def main():
    async with async_session_factory() as session:
        # 查找同 email 用户
        result = await session.execute(select(User).where(User.email == EMAIL))
        user = result.scalar_one_or_none()

        if user is None:
            # 创建新超管
            user = User(
                email=EMAIL,
                phone=PHONE,
                password_hash=hash_password(PASSWORD),
                role="super_admin",
                status="active",
                nickname="SuperAdmin",
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print(f"[OK] 已创建超级管理员: id={user.id} email={user.email}")
        else:
            # 升级为 super_admin 并更新密码
            user.role = "super_admin"
            user.status = "active"
            user.password_hash = hash_password(PASSWORD)
            if PHONE:
                user.phone = PHONE
            if not user.nickname:
                user.nickname = "SuperAdmin"
            await session.commit()
            await session.refresh(user)
            print(f"[OK] 已升级现有用户为超级管理员: id={user.id} email={user.email}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"[ERROR] {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)
PYEOF
)

# 替换占位符
PYTHON_CODE="${PYTHON_CODE//__EMAIL__/$EMAIL_ESC}"
PYTHON_CODE="${PYTHON_CODE//__PASSWORD__/$PASSWORD_ESC}"
PYTHON_CODE="${PYTHON_CODE//__PHONE__/$PHONE_ESC}"

# ── 在 api 容器内执行 ──
if ! $COMPOSE exec -T api python -c "$PYTHON_CODE"; then
  error "创建超管失败，请检查 api 容器是否正常运行"
  error "可手动排查:"
  error "  $COMPOSE logs --tail=50 api"
  exit 1
fi

echo ""
ok "============================================================"
ok "  超级管理员账号已就绪!"
ok "============================================================"
echo "  登录邮箱: $EMAIL"
if [ -n "$PHONE" ]; then
  echo "  手机号:   $PHONE"
fi
echo "  角色:     super_admin"
echo ""
info "登录入口:"
info "  管理后台: https://your-domain.com/admin"
info "  (请将 your-domain.com 替换为实际域名)"
echo ""
warn "⚠️  请妥善保管密码，建议立即在管理后台修改为更强密码"
warn "⚠️  此处显示的密码不会写入任何日志文件"
