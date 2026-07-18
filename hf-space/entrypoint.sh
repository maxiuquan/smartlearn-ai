#!/bin/bash
# ──────────────────────────────────────────────────────────────
# SmartLearn AI - HF Spaces 容器启动脚本 (R9 容错版)
# ──────────────────────────────────────────────────────────────
# 改进: api/ai-engine 崩溃后自动重启,不再因单进程退出而全灭
# ──────────────────────────────────────────────────────────────

echo "================================================"
echo "  SmartLearn AI - HF Spaces 启动中..."
echo "================================================"

cd /app

export RAG_DATA_DIR=/app/data
echo "  RAG_DATA_DIR=$RAG_DATA_DIR"

# ── 1. 注入 AI_ENGINE_API_KEY 到 nginx 配置 ──
echo "[1/4] 注入 AI_ENGINE_API_KEY..."
if [ -n "$AI_ENGINE_API_KEY" ]; then
    sed "s/__AI_ENGINE_API_KEY__/${AI_ENGINE_API_KEY}/g" /app/nginx.conf > /etc/nginx/nginx.conf
    echo "  API Key 已注入"
else
    cp /app/nginx.conf /etc/nginx/nginx.conf
    echo "  ⚠️  AI_ENGINE_API_KEY 未设置"
fi

# ── 2. 启动 nginx (前台) ──
echo "[2/4] 启动 nginx + api + ai-engine..."

nginx -g "daemon off;" > /tmp/nginx.log 2>&1 &
NGINX_PID=$!
echo "  nginx 已启动 (PID $NGINX_PID)"

# ── 3. API 后端崩溃自动重启循环 ──
_restart_loop() {
    local name=$1; shift
    local cmd=$@
    while true; do
        echo "  → 启动 $name..."
        $cmd &
        local pid=$!
        wait $pid
        echo "  ⚠️  $name 退出 (pid=$pid, rc=$?), 5秒后重启..."
        sleep 5
    done
}

# api: uvicorn
_restart_loop "api" "PYTHONPATH=/app uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --proxy-headers" &
API_LOOP_PID=$!

# ai-engine: uvicorn
_restart_loop "ai-engine" "PYTHONPATH=/app/ai-engine uvicorn app.main:app --app-dir /app/ai-engine --host 127.0.0.1 --port 8001 --workers 1 --proxy-headers" &
AI_LOOP_PID=$!

# ── 4. 后台异步执行 alembic 迁移 + 初始化数据 ──
echo "[3/4] 后台执行 alembic 迁移 + 数据导入..."
(
  cd /app
  echo "--- alembic upgrade head ---"
  PYTHONPATH=/app timeout 180 alembic upgrade head 2>&1
  if [ $? -eq 0 ]; then echo "  ✅ alembic 迁移完成"; else echo "  ⚠️  alembic 迁移失败"; fi
  PYTHONPATH=/app timeout 300 python scripts/import_all.py 2>&1
  if [ $? -eq 0 ]; then echo "  ✅ 数据导入完成"; else echo "  ⚠️  数据导入失败"; fi
) &

# ── 5. 等待 nginx 退出（nginx 永远不会主动退出,进程树保活）──
echo "[4/4] 服务运行中"
echo "================================================"
echo "  服务: nginx:7860 + api:8000 + ai-engine:8001"
echo "  保活: /keepalive"
echo "================================================"

trap "kill $NGINX_PID $API_LOOP_PID $AI_LOOP_PID 2>/dev/null; exit 0" SIGTERM SIGINT

wait $NGINX_PID
echo "⚠️  nginx 退出,停止全部..."
kill $API_LOOP_PID $AI_LOOP_PID 2>/dev/null
exit 1
