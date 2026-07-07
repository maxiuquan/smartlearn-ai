#!/usr/bin/env bash
# ============================================================
# SmartLearn AI - PostgreSQL 数据库备份脚本
# ============================================================
# 用法:
#   bash scripts/backup.sh                         # 使用环境变量默认值
#   DB_HOST=db DB_USER=xxx DB_PASSWORD=xxx bash scripts/backup.sh
#
# 备份文件: ./backups/YYYYMMDD_HHMMSS.sql.gz
# 保留策略: 默认保留最近 7 天 (可通过 BACKUP_RETAIN_DAYS 调整)
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

# ── 数据库连接 (优先使用 DATABASE_URL 单一连接串) ──
# 若设置了 DATABASE_URL，直接用它；否则从分散字段拼接
if [ -n "${DATABASE_URL:-}" ]; then
  DB_CONN="$DATABASE_URL"
else
  DB_HOST="${DB_HOST:-${POSTGRES_HOST:-${POSTGRES_SERVER:-db}}}"
  DB_PORT="${DB_PORT:-${POSTGRES_PORT:-5432}}"
  DB_USER="${DB_USER:-${POSTGRES_USER:-smartlearn_user}}"
  DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}"
  DB_NAME="${DB_NAME:-${POSTGRES_DB:-smartlearn}}"
  if [ -z "$DB_PASSWORD" ]; then
    error "DATABASE_URL 未设置，且 DB_PASSWORD/POSTGRES_PASSWORD 也为空"
    error "请在 .env 中配置 DATABASE_URL 或 POSTGRES_PASSWORD"
    exit 1
  fi
  export PGPASSWORD="$DB_PASSWORD"
  DB_CONN="host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME"
fi

# 保留天数 (默认 7 天)
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
mkdir -p "$BACKUP_DIR"

# 备份文件名: YYYYMMDD_HHMMSS.sql.gz
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${TIMESTAMP}.sql.gz"

info "开始备份 PostgreSQL 数据库..."
info "  目标:   $BACKUP_FILE"

# ── 执行 pg_dump 并压缩 ──
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DB_CONN" \
    --no-owner --no-privileges \
    --clean --if-exists \
    | gzip -9 > "$BACKUP_FILE"
else
  error "未找到 pg_dump 命令，请通过 docker compose 调用:"
  error "  docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec -T db \\"
  error "    pg_dump \"\$DATABASE_URL\" | gzip -9 > $BACKUP_FILE"
  exit 1
fi

unset PGPASSWORD 2>/dev/null || true

# ── 校验备份文件 ──
if [ ! -s "$BACKUP_FILE" ]; then
  error "备份文件为空，备份可能失败"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# 文件大小 (人类可读)
FILE_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
ok "备份完成: $BACKUP_FILE ($FILE_SIZE)"

# ── 清理过期备份 ──
info "清理超过 ${RETAIN_DAYS} 天的旧备份..."
DELETED_COUNT="$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +"$RETAIN_DAYS" -print -delete | wc -l)"
if [ "$DELETED_COUNT" -gt 0 ]; then
  ok "已清理 $DELETED_COUNT 个过期备份"
else
  info "无过期备份需要清理"
fi

# ── 列出当前所有备份 ──
info "当前备份列表:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | awk '{printf "  %s  %s\n", $5, $9}' || info "  (空)"

echo ""
ok "备份脚本执行完毕"
