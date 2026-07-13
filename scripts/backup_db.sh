#!/usr/bin/env bash
# SmartLearn AI - PostgreSQL 备份脚本
#
# 功能：
#   1. 从 DATABASE_URL 解析连接信息（或回退 PG* 环境变量）
#   2. 使用 pg_dump + gzip 输出到 backups/smartlearn_{timestamp}.sql.gz
#   3. 保留最近 N 个备份（默认 7），自动清理更旧的
#   4. 失败时退出非零码，便于 cron / CI 检测
#
# 兼容性：Linux / macOS / Git Bash on Windows
#
# 用法：
#   ./scripts/backup_db.sh                     # 直接运行
#   DATABASE_URL=... ./scripts/backup_db.sh    # 指定连接串
#   KEEP=14 ./scripts/backup_db.sh             # 保留 14 个
#
# cron 调度（每天凌晨 3 点）：
#   0 3 * * * cd /path/to/repo && ./scripts/backup_db.sh >> /var/log/smartlearn-backup.log 2>&1
set -euo pipefail

# ----------------------------------------------------------------------------
# 配置（环境变量可覆盖）
# ----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
KEEP="${KEEP:-7}"
DATABASE_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
PGHOST_VAL="${PGHOST:-}"
PGPORT_VAL="${PGPORT:-5432}"
PGUSER_VAL="${PGUSER:-postgres}"
PGPASSWORD_VAL="${PGPASSWORD:-}"
PGDATABASE_VAL="${PGDATABASE:-smartlearn}"

# 时间戳（兼容 BSD date 和 GNU date）
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/smartlearn_${TIMESTAMP}.sql.gz"

# ----------------------------------------------------------------------------
# 日志辅助
# ----------------------------------------------------------------------------
log() {
    echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] [backup] $*"
}

err() {
    echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] [backup][ERROR] $*" >&2
}

# ----------------------------------------------------------------------------
# 前置检查
# ----------------------------------------------------------------------------
if ! command -v pg_dump >/dev/null 2>&1; then
    err "pg_dump 未安装。请安装 PostgreSQL 客户端："
    err "  Ubuntu/Debian: apt-get install -y postgresql-client"
    err "  macOS: brew install libpq && brew link --force libpq"
    err "  Windows(Git Bash): 安装 PostgreSQL 后将 bin 加入 PATH"
    exit 2
fi

if ! command -v gzip >/dev/null 2>&1; then
    err "gzip 未安装"
    exit 2
fi

mkdir -p "$BACKUP_DIR"

# ----------------------------------------------------------------------------
# 解析 DATABASE_URL（postgresql://user:pwd@host:port/dbname?sslmode=...）
# ----------------------------------------------------------------------------
PGENV_HOST="$PGHOST_VAL"
PGENV_PORT="$PGPORT_VAL"
PGENV_USER="$PGUSER_VAL"
PGENV_PWD="$PGPASSWORD_VAL"
PGENV_DB="$PGDATABASE_VAL"

if [[ -n "$DATABASE_URL" ]]; then
    log "从 DATABASE_URL 解析连接信息"
    # 去掉 scheme
    url_no_scheme="${DATABASE_URL#*//}"
    # 拆出 user:pwd@host:port/dbname?params
    creds_and_rest="$url_no_scheme"

    # user:pwd
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

    # host:port/dbname?params
    db_part="${rest%%\?*}"   # 去掉 query string
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
    err "数据库连接信息不完整（host/user/dbname 至少一个为空）"
    err "  请设置 DATABASE_URL 或 PGHOST/PGUSER/PGDATABASE"
    exit 3
fi

log "目标数据库: host=$PGENV_HOST port=$PGENV_PORT user=$PGENV_USER db=$PGENV_DB"
log "备份文件:   $BACKUP_FILE"

# ----------------------------------------------------------------------------
# 执行备份
# ----------------------------------------------------------------------------
export PGHOST="$PGENV_HOST"
export PGPORT="$PGENV_PORT"
export PGUSER="$PGENV_USER"
export PGPASSWORD="$PGENV_PWD"
export PGDATABASE="$PGENV_DB"

# pg_dump 选项：
#   --no-owner        不写 OWNER 子句（恢复时用当前用户）
#   --no-privileges   不写 GRANT/REVOKE
#   --clean           生成 DROP 语句，便于恢复时覆盖
#   --if-exists       DROP IF EXISTS，避免首次恢复报错
#   --format=custom   custom 二进制格式（与 gzip 配合）
# 这里用 plain text + gzip，便于人工检查
BACKUP_START_EPOCH=$(date +%s)
if pg_dump \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --no-password \
    "$PGDATABASE" 2>"$BACKUP_DIR/.last_error.log" | gzip -9 > "$BACKUP_FILE"; then
    BACKUP_END_EPOCH=$(date +%s)
    BACKUP_DURATION=$((BACKUP_END_EPOCH - BACKUP_START_EPOCH))
    FILE_SIZE=$(wc -c < "$BACKUP_FILE" 2>/dev/null || echo 0)
    log "备份成功: duration=${BACKUP_DURATION}s size=${FILE_SIZE} bytes"
else
    err "pg_dump 失败，错误日志："
    cat "$BACKUP_DIR/.last_error.log" >&2 || true
    rm -f "$BACKUP_FILE" "$BACKUP_DIR/.last_error.log"
    exit 4
fi

rm -f "$BACKUP_DIR/.last_error.log"

# ----------------------------------------------------------------------------
# 清理过期备份（保留最近 KEEP 个）
# ----------------------------------------------------------------------------
CLEANED=0
# 列出所有备份文件（按修改时间倒序，最新在前）
mapfile -t BACKUP_LIST < <(ls -1t "$BACKUP_DIR"/smartlearn_*.sql.gz 2>/dev/null || true)
TOTAL=${#BACKUP_LIST[@]}
if (( TOTAL > KEEP )); then
    log "清理过期备份: total=$TOTAL keep=$KEEP"
    for f in "${BACKUP_LIST[@]:$KEEP}"; do
        [[ -z "$f" ]] && continue
        rm -f "$f"
        CLEANED=$((CLEANED + 1))
        log "  已删除: $f"
    done
fi
log "清理完成: deleted=$CLEANED kept=$((TOTAL - CLEANED))"

log "备份流程结束 ✓"
exit 0
