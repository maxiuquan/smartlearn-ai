#!/bin/bash
# ──────────────────────────────────────────────────────────────
# SmartLearn AI - HF Spaces 容器启动脚本
# ──────────────────────────────────────────────────────────────
# 执行顺序:
#   1. 等待外部 PG 可连接（Aiven 冷启动可能需要几秒）
#   2. alembic upgrade head（数据库迁移）
#   3. 初始化管理员账号（幂等）
#   4. 注入 AI_ENGINE_API_KEY 到 nginx 配置
#   5. 启动 supervisord（管理 nginx + api + ai-engine）
# ──────────────────────────────────────────────────────────────
set -e

echo "================================================"
echo "  SmartLearn AI - HF Spaces 启动中..."
echo "================================================"

# ── 1. 等待外部 PostgreSQL 可连接 ──
# Aiven 免费档可能从睡眠中唤醒,首次连接需几秒
echo "[1/5] 等待 PostgreSQL 可连接..."
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if python -c "
import os, sys
try:
    import psycopg2
    url = os.environ.get('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://').replace('postgresql+psycopg://', 'postgresql://')
    conn = psycopg2.connect(url, connect_timeout=5)
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f'  等待中... ({e})', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null; then
        echo "  PostgreSQL 已连接"
        break
    fi
    RETRY=$((RETRY + 1))
    echo "  重试 $RETRY/$MAX_RETRIES..."
    sleep 2
done

if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "  ⚠️  PostgreSQL 连接超时,继续启动（迁移可能失败）"
fi

# ── 2. 执行数据库迁移 ──
echo "[2/5] 执行 alembic 迁移..."
cd /app
if alembic upgrade head; then
    echo "  迁移完成"
else
    echo "  ⚠️  迁移失败,继续启动（表可能已存在）"
fi

# ── 3. 初始化管理员账号（幂等） ──
echo "[3/5] 初始化管理员账号..."
python scripts/seed.py || echo "  ⚠️  管理员初始化失败（可能已存在）"

# ── 4. 注入 AI_ENGINE_API_KEY 到 nginx 配置 ──
echo "[4/5] 注入 AI_ENGINE_API_KEY..."
if [ -n "$AI_ENGINE_API_KEY" ]; then
    # API Key 由 openssl rand -hex 32 生成,仅含十六进制字符,sed 替换安全
    sed -i "s/__AI_ENGINE_API_KEY__/${AI_ENGINE_API_KEY}/g" /etc/nginx/nginx.conf
    echo "  API Key 已注入"
else
    echo "  ⚠️  AI_ENGINE_API_KEY 未设置,/word-games 反代鉴权将失败"
fi

# ── 5. 启动 supervisord ──
echo "[5/5] 启动 supervisord..."
echo "================================================"
echo "  服务启动: nginx:7860 + api:8000 + ai-engine:8001"
echo "  保活端点: /keepalive"
echo "================================================"
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
