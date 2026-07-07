#!/usr/bin/env bash
# ============================================================
# SmartLearn AI - PostgreSQL 数据库恢复脚本
# ============================================================
# 用法:
#   bash scripts/restore.sh <备份文件名>        # 如 20260705_120000.sql.gz
#   bash scripts/restore.sh latest              # 恢复最近的备份
#   bash scripts/restore.sh /path/to/file.sql.gz
#
# 警告: 恢复操作会覆盖现有数据，请谨慎执行!
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
    exit 1
  fi
  export PGPASSWORD="$DB_PASSWORD"
  DB_CONN="host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME"
fi

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"

# ── 参数校验 ──
if [ $# -lt 1 ]; then
  error "用法: bash scripts/restore.sh <备份文件名|latest|文件路径>"
  error "示例:"
  error "  bash scripts/restore.sh 20260705_120000.sql.gz"
  error "  bash scripts/restore.sh latest"
  exit 1
fi

TARGET="$1"

# ── 解析备份文件路径 ──
if [ "$TARGET" = "latest" ]; then
  BACKUP_FILE="$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -n 1 || true)"
  if [ -z "$BACKUP_FILE" ]; then
    error "在 $BACKUP_DIR 中未找到任何 .sql.gz 备份文件"
    exit 1
  fi
  info "已选择最近备份: $BACKUP_FILE"
elif [[ "$TARGET" = /* ]]; then
  BACKUP_FILE="$TARGET"
else
  BACKUP_FILE="${BACKUP_DIR}/${TARGET}"
fi

# ── 校验文件存在 ──
if [ ! -f "$BACKUP_FILE" ]; then
  error "备份文件不存在: $BACKUP_FILE"
  error "可用备份:"
  ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | xargs -n1 basename 2>/dev/null || info "  (空)"
  exit 1
fi

if [ ! -s "$BACKUP_FILE" ]; then
  error "备份文件为空: $BACKUP_FILE"
  exit 1
fi

FILE_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"

# ── 二次确认 ──
echo ""
warn "============================================================"
warn "  ⚠️  恢复操作将覆盖数据库现有数据!"
warn "  备份文件: $BACKUP_FILE ($FILE_SIZE)"
warn "============================================================"
echo ""
read -r -p "确认要继续恢复吗? 输入 yes 继续，其他取消: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  info "已取消恢复操作"
  exit 0
fi

info "开始恢复数据库..."
info "  备份文件: $BACKUP_FILE ($FILE_SIZE)"

# ── 执行恢复 (gunzip 解压 + psql 导入) ──
if command -v psql >/dev/null 2>&1; then
  gunzip -c "$BACKUP_FILE" | psql "$DB_CONN" -v ON_ERROR_STOP=0
else
  COMPOSE="docker compose -f ${PROJECT_ROOT}/docker-compose.yml -f ${PROJECT_ROOT}/infra/docker/docker-compose.prod.yml"
  error "未找到 psql 命令，请通过 docker compose 调用:"
  error "  gunzip -c \"$BACKUP_FILE\" | $COMPOSE exec -T db psql \"\$DATABASE_URL\""
  exit 1
fi

unset PGPASSWORD 2>/dev/null || true

echo ""
ok "============================================================"
ok "  数据库恢复完成!"
ok "============================================================"
ok "  恢复来源: $BACKUP_FILE"
echo ""
info "建议执行以下检查:"
info "  1. 查看服务日志: docker compose logs -f api"
info "  2. 测试登录管理后台"
info "  3. 抽查关键数据是否完整"
