#!/usr/bin/env bash
# ============================================================
# SmartLearn AI - 一键部署脚本 (VPS 生产环境)
# ============================================================
# 用法:
#   bash scripts/deploy.sh                      # 完整部署
#   bash scripts/deploy.sh --skip-import        # 跳过数据导入
#   bash scripts/deploy.sh --skip-ssl           # 跳过 HTTPS 申请
#   bash scripts/deploy.sh --skip-admin         # 跳过创建超管
#   bash scripts/deploy.sh --skip-import --skip-ssl --skip-admin
#
# 前置条件:
#   - 已安装 Docker 与 Docker Compose v2
#   - 已配置好 .env 文件 (DATABASE_URL / REDIS_URL / JWT_SECRET 等)
#   - 域名 A 记录已指向本机 IP (如需 HTTPS)
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

# ── 参数解析 ──
SKIP_IMPORT=0
SKIP_SSL=0
SKIP_ADMIN=0
DOMAIN=""

for arg in "$@"; do
  case "$arg" in
    --skip-import) SKIP_IMPORT=1 ;;
    --skip-ssl)    SKIP_SSL=1 ;;
    --skip-admin)  SKIP_ADMIN=1 ;;
    --domain=*)    DOMAIN="${arg#*=}" ;;
    --help|-h)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      warn "未知参数: $arg (忽略)"
      ;;
  esac
done

# 项目根目录 (脚本位于 scripts/ 下)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Compose 命令 ──
COMPOSE="docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml"

info "项目根目录: $PROJECT_ROOT"

# ============================================================
# 1. 检查 .env 文件
# ============================================================
if [ ! -f .env ]; then
  warn "未找到 .env 文件，从 .env.example 复制..."
  if [ -f .env.example ]; then
    cp .env.example .env
    error "已生成 .env，请先编辑填入真实配置后重新运行本脚本:"
    error "  nano .env"
    error "重点设置: DATABASE_URL / REDIS_URL / JWT_SECRET / CORS_ORIGINS"
    exit 1
  else
    error ".env 与 .env.example 均不存在，请先创建 .env"
    exit 1
  fi
fi
ok ".env 文件存在"

# ============================================================
# 2. 检查 Docker 环境
# ============================================================
if ! command -v docker >/dev/null 2>&1; then
  error "未检测到 docker，请先安装 Docker: https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  error "未检测到 docker compose v2，请升级 Docker 或安装 docker-compose-plugin"
  exit 1
fi
ok "Docker 与 Docker Compose v2 已就绪"

# ============================================================
# 3. 检查必要环境变量 (非空且非占位符)
# ============================================================
# 加载 .env 中的变量 (不覆盖已存在的)
set -a
# shellcheck disable=SC1091
. ./.env
set +a

check_secret() {
  local name="$1"
  local val="${!name:-}"
  if [ -z "$val" ]; then
    error "$name 未设置，请编辑 .env"
    exit 1
  fi
  case "$val" in
    change-me-*|your-*|your_*|changeme|password|secret)
      error "$name 仍为占位符 ($val)，请改为强随机值"
      exit 1
      ;;
  esac
}

check_secret DATABASE_URL
check_secret REDIS_URL
check_secret JWT_SECRET
ok "必要密钥校验通过"

if [ -z "${CORS_ORIGINS:-}" ]; then
  warn "CORS_ORIGINS 未设置，建议在 .env 中配置为实际域名"
fi

# ============================================================
# 4. 创建必要目录
# ============================================================
info "创建必要目录..."
mkdir -p backups
mkdir -p infra/nginx/ssl
mkdir -p infra/nginx/certbot/www
mkdir -p data
ok "目录就绪: backups/ infra/nginx/ssl/ infra/nginx/certbot/www/"

# ============================================================
# 5. 构建并启动服务
# ============================================================
info "构建并启动服务 (可能需要几分钟)..."
$COMPOSE up -d --build
ok "服务已启动"

# ============================================================
# 6. 等待数据库 healthy
# ============================================================
info "等待数据库就绪 (最多 120 秒)..."
for i in $(seq 1 60); do
  status="$(docker inspect --format='{{.State.Health.Status}}' smartlearn-db 2>/dev/null || echo "starting")"
  if [ "$status" = "healthy" ]; then
    ok "数据库已就绪"
    break
  fi
  if [ "$i" = "60" ]; then
    error "数据库健康检查超时，请检查日志: docker logs smartlearn-db"
    exit 1
  fi
  printf "."
  sleep 2
done

# ============================================================
# 7. 运行数据库迁移
# ============================================================
info "运行数据库迁移 (alembic upgrade head)..."
$COMPOSE exec -T api alembic upgrade head
ok "数据库迁移完成"

# ============================================================
# 8. (可选) 数据导入
# ============================================================
if [ "$SKIP_IMPORT" = "1" ]; then
  warn "已跳过数据导入 (--skip-import)"
else
  info "导入初始数据 (知识点/题目/词汇/成就)..."
  if $COMPOSE exec -T api python scripts/import_all.py; then
    ok "数据导入完成"
  else
    warn "数据导入出现失败项，请查看上方日志；可稍后手动重跑:"
    warn "  $COMPOSE exec api python scripts/import_all.py"
  fi
fi

# ============================================================
# 9. (可选) 创建超级管理员
# ============================================================
if [ "$SKIP_ADMIN" = "1" ]; then
  warn "已跳过创建超管 (--skip-admin)"
else
  info "即将创建超级管理员账号..."
  if [ -x scripts/create-admin.sh ]; then
    bash scripts/create-admin.sh
  else
    warn "scripts/create-admin.sh 不存在或不可执行，请手动创建超管"
  fi
fi

# ============================================================
# 10. (可选) 申请 HTTPS 证书
# ============================================================
if [ "$SKIP_SSL" = "1" ]; then
  warn "已跳过 HTTPS 申请 (--skip-ssl)"
else
  # DOMAIN 优先级: 命令行参数 > .env 文件 (已在 step 3 加载)
  # 若仍未设置，尝试从 .env 显式读取 (兼容 .env 中含注释/引号的情况)
  if [ -z "$DOMAIN" ]; then
    DOMAIN="$(grep -E '^DOMAIN=' .env 2>/dev/null | cut -d= -f2- | tr -d '"'\''[:space:]' || true)"
  fi

  if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "your-domain.com" ]; then
    warn "未配置 DOMAIN，跳过 HTTPS 申请"
    warn "如需启用 HTTPS，请在 .env 设置 DOMAIN=your-domain.com 后执行:"
    warn "  $COMPOSE --profile certbot run --rm certbot"
  else
    info "为域名 $DOMAIN 申请 HTTPS 证书..."
    export DOMAIN
    if $COMPOSE --profile certbot run --rm certbot; then
      ok "HTTPS 证书申请完成"
      info "请将 nginx ssl 路径指向 Let's Encrypt 证书并 reload nginx:"
      info "  $COMPOSE exec nginx nginx -s reload"
    else
      warn "HTTPS 申请失败，可稍后手动重试:"
      warn "  DOMAIN=$DOMAIN $COMPOSE --profile certbot run --rm certbot"
    fi
  fi
fi

# ============================================================
# 11. 部署完成摘要
# ============================================================
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  SmartLearn AI 部署完成!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "访问地址:"
if [ -n "${DOMAIN:-}" ] && [ "$DOMAIN" != "your-domain.com" ]; then
  echo "  Web 前端:    https://$DOMAIN/"
  echo "  管理后台:    https://$DOMAIN/admin"
  echo "  API 文档:    https://$DOMAIN/docs"
  echo "  移动端 Web:  https://$DOMAIN/m"
else
  echo "  Web 前端:    http://<VPS_IP>/"
  echo "  管理后台:    http://<VPS_IP>/admin"
  echo "  API 文档:    http://<VPS_IP>/docs"
  echo "  移动端 Web:  http://<VPS_IP>/m"
fi
echo ""
echo "常用命令:"
echo "  查看服务状态:  $COMPOSE ps"
echo "  查看实时日志:  $COMPOSE logs -f api"
echo "  重启某服务:    $COMPOSE restart api"
echo "  手动备份数据库: bash scripts/backup.sh"
echo "  恢复数据库:    bash scripts/restore.sh latest"
echo ""
echo "备份位置:    $(pwd)/backups/"
echo "日志位置:    docker volumes (api-logs / ai-logs / nginx-logs)"
echo ""
if [ "$SKIP_SSL" = "1" ] || [ -z "${DOMAIN:-}" ] || [ "$DOMAIN" = "your-domain.com" ]; then
  warn "HTTPS 未启用，建议尽快配置域名并申请证书"
fi
if [ "$SKIP_ADMIN" = "1" ]; then
  warn "尚未创建超级管理员，请运行: bash scripts/create-admin.sh"
fi
echo -e "${GREEN}部署脚本执行完毕。${NC}"
