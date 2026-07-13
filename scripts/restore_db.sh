#!/usr/bin/env bash
# SmartLearn AI - PostgreSQL 恢复脚本
#
# 功能：
#   1. 从指定备份文件恢复数据库（smartlearn_*.sql.gz）
#   2. 支持 DATABASE_URL 或 PG* 环境变量
#   3. 恢复前确认（生产环境需 --yes 跳过）
#   4. 失败时退出非零码
#
# 兼容性：Linux / macOS / Git Bash on Windows
#
# 用法：
#   ./scripts/restore_db.sh backups/smartlearn_20250701_030000.sql.gz
#   ./scripts/restore_db.sh --yes backups/smartlearn_xxx.sql.gz     # 跳过确认
#   DATABASE_URL=... ./scripts/restore_db.sh backup.sql.gz
set -euo pipefail

# ----------------------------------------------------------------------------
# 配置
# ----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
PGHOST_VAL="${PGHOST:-}"
PGPORT_VAL="${PGPORT:-5432}"
PGUSER_VAL="${PGUSER:-postgres}"
PGPASSWORD_VAL="${PGPASSWORD:-}"
PGDATABASE_VAL="${PGDATABASE:-smartlearn}"
ASSUME_YES=0

# ----------------------------------------------------------------------------
# 日志辅助
# ----------------------------------------------------------------------------
log() {
    echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] [restore] $*"
}

err() {
    echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] [restore][ERROR] $*" >&2
}

# ----------------------------------------------------------------------------
# 解析参数
# ----------------------------------------------------------------------------
BACKUP_FILE=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        -y|--yes)
            ASSUME_YES=1
            shift
            ;;
        -h|--help)
            cat <<'EOF'
SmartLearn AI - 数据库恢复脚本

用法：
  restore_db.sh [--yes] <backup_file>

参数：
  -y, --yes    跳过确认提示（生产环境慎用）
  <backup_file>  备份文件路径（smartlearn_*.sql.gz）

环境变量：
  DATABASE_URL  优先使用（覆盖 PG* 字段）
  PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE  连接信息

示例：
  ./scripts/restore_db.sh backups/smartlearn_20250701_030000.sql.gz
  ./scripts/restore_db.sh --yes backups/smartlearn_xxx.sql.gz
EOF
            exit 0
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

if [[ -z "$BACKUP_FILE" ]]; then
    err "未指定备份文件"
    err "用法: $0 [--yes] <backup_file>"
    exit 1
fi

# 兼容相对路径
if [[ ! -f "$BACKUP_FILE" ]]; then
    # 尝试相对 repo root 解析
    if [[ -f "$REPO_ROOT/$BACKUP_FILE" ]]; then
        BACKUP_FILE="$REPO_ROOT/$BACKUP_FILE"
    else
        err "备份文件不存在: $BACKUP_FILE"
        exit 1
    fi
fi

# ----------------------------------------------------------------------------
# 前置检查
# ----------------------------------------------------------------------------
if ! command -v gunzip >/dev/null 2>&1; then
    err "gunzip 未安装"
    exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
    err "psql 未安装。请安装 PostgreSQL 客户端"
    exit 2
fi

# ----------------------------------------------------------------------------
# 解析 DATABASE_URL
# ----------------------------------------------------------------------------
PGENV_HOST="$PGHOST_VAL"
PGENV_PORT="$PGPORT_VAL"
PGENV_USER="$PGUSER_VAL"
PGENV_PWD="$PGPASSWORD_VAL"
PGENV_DB="$PGDATABASE_VAL"

if [[ -n "$DATABASE_URL" ]]; then
    log "从 DATABASE_URL 解析连接信息"
    url_no_scheme="${DATABASE_URL#*//}"
    creds_and_rest="$url_no_scheme"

    if [[ "$creds_and_rest" == *@* ]]; then
        creds="${creds_and_rest%%@*}"
        rest="${creds_and_rest#*@}"
        PGENV_USER="${creds%%:*}"
        if [[ "$creds" == *:* ]]; then
            PGENV_PWD="${creds#*:}"
        fi
    else
        rest="$creds_and_rest"
    fi

    db_part="${rest%%\?*}"
    if [[ "$db_part" == */* ]]; then
        hostport="${db_part%%/*}"
        PGENV_DB="${db_part#*/}"
    else
        hostport="$db_part"
    fi

    if [[ "$hostport" == *:* ]]; then
        PGENV_HOST="${hostport%%:*}"
        PGENV_PORT="${hostport#*:}"
    else
        PGENV_HOST="$hostport"
    fi
fi

if [[ -z "$PGENV_HOST" || -z "$PGENV_DB" || -z "$PGENV_USER" ]]; then
    err "数据库连接信息不完整"
    exit 3
fi

# ----------------------------------------------------------------------------
# 确认提示
# ----------------------------------------------------------------------------
log "目标数据库: host=$PGENV_HOST port=$PGENV_PORT user=$PGENV_USER db=$PGENV_DB"
log "备份文件:   $BACKUP_FILE"
log "WARNING: 恢复操作将覆盖目标数据库现有数据！"

if [[ "$ASSUME_YES" -eq 0 ]]; then
    echo ""
    read -r -p "确认要继续恢复吗？(输入 YES 继续，其他取消): " CONFIRM
    if [[ "$CONFIRM" != "YES" ]]; then
        log "用户取消恢复操作"
        exit 0
    fi
fi

# ----------------------------------------------------------------------------
# 执行恢复
# ----------------------------------------------------------------------------
export PGHOST="$PGENV_HOST"
export PGPORT="$PGENV_PORT"
export PGUSER="$PGENV_USER"
export PGPASSWORD="$PGENV_PWD"
export PGDATABASE="$PGENV_DB"

# 先 ping 一下，避免权限错误拖延到一半
log "测试数据库连接..."
if ! psql --no-password -c "SELECT 1" >/dev/null 2>&1; then
    err "无法连接数据库（host=$PGENV_HOST user=$PGENV_USER db=$PGENV_DB）"
    err "请检查 DATABASE_URL / PG* 环境变量"
    exit 4
fi
log "连接正常"

RESTORE_START_EPOCH=$(date +%s)
# 解压并恢复（备份已含 DROP IF EXISTS / CREATE 语句）
if gunzip -c "$BACKUP_FILE" | psql --no-password -v ON_ERROR_STOP=1 -q 2>"$REPO_ROOT/backups/.restore_error.log"; then
    RESTORE_END_EPOCH=$(date +%s)
    RESTORE_DURATION=$((RESTORE_END_EPOCH - RESTORE_START_EPOCH))
    log "恢复成功: duration=${RESTORE_DURATION}s"
    rm -f "$REPO_ROOT/backups/.restore_error.log"
    log "恢复流程结束 ✓"
    exit 0
else
    err "恢复失败，错误日志："
    cat "$REPO_ROOT/backups/.restore_error.log" >&2 || true
    rm -f "$REPO_ROOT/backups/.restore_error.log"
    exit 5
fi
