#!/bin/bash
# ──────────────────────────────────────────────────────────────
# SmartLearn AI - HF Spaces 容器启动脚本
# ──────────────────────────────────────────────────────────────
# HF Spaces 以 UID 1000 非 root 运行,不使用 supervisord
# 用 shell 后台启动三个进程,输出到 stdout/stderr 供 HF 日志捕获
# ──────────────────────────────────────────────────────────────

echo "================================================"
echo "  SmartLearn AI - HF Spaces 启动中..."
echo "================================================"

cd /app

# ── 1. 注入 AI_ENGINE_API_KEY 到 nginx 配置 ──
echo "[1/4] 注入 AI_ENGINE_API_KEY..."
if [ -n "$AI_ENGINE_API_KEY" ]; then
    sed "s/__AI_ENGINE_API_KEY__/${AI_ENGINE_API_KEY}/g" /app/nginx.conf > /etc/nginx/nginx.conf
    echo "  API Key 已注入"
else
    cp /app/nginx.conf /etc/nginx/nginx.conf
    echo "  ⚠️  AI_ENGINE_API_KEY 未设置,/word-games 反代鉴权将失败"
fi

# ── 2. 启动三个进程（后台,输出重定向到 stdout/stderr）──
echo "[2/4] 启动 nginx + api + ai-engine..."

# nginx: 前台模式 (nginx -g "daemon off;" 自带 stdout 输出)
nginx -g "daemon off;" 2>&1 &
NGINX_PID=$!
echo "  nginx 已启动 (PID $NGINX_PID)"

# api: uvicorn (1 worker 节省内存)
PYTHONPATH=/app uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --proxy-headers 2>&1 &
API_PID=$!
echo "  api 已启动 (PID $API_PID)"

# ai-engine: uvicorn (1 worker)
PYTHONPATH=/app/ai-engine uvicorn app.main:app --app-dir /app/ai-engine --host 127.0.0.1 --port 8001 --workers 1 --proxy-headers 2>&1 &
AI_PID=$!
echo "  ai-engine 已启动 (PID $AI_PID)"

# ── 3. 后台异步执行 alembic 迁移 + 初始化管理员 ──
# 注意: 输出直接到 stdout/stderr(不重定向到 init.log),便于 HF logs 诊断
echo "[3/4] 后台执行 alembic 迁移 + 初始化管理员..."
(
  cd /app
  echo "--- alembic upgrade head ---"
  PYTHONPATH=/app timeout 120 alembic upgrade head 2>&1
  alembic_rc=$?
  if [ $alembic_rc -eq 0 ]; then
    echo "  ✅ alembic 迁移完成"
  else
    echo "  ⚠️  alembic 迁移失败(退出码 $alembic_rc)"
  fi
  echo "--- seed.py ---"
  PYTHONPATH=/app timeout 30 python scripts/seed.py 2>&1
  seed_rc=$?
  if [ $seed_rc -eq 0 ]; then
    echo "  ✅ seed.py 完成"
  else
    echo "  ⚠️  seed.py 失败(退出码 $seed_rc)"
  fi
) &

# ── 4. 等待任一进程退出则停止全部 ──
echo "[4/4] 服务运行中"
echo "================================================"
echo "  服务: nginx:7860 + api:8000 + ai-engine:8001"
echo "  保活: /keepalive"
echo "================================================"

# 捕获信号,优雅退出
trap "kill $NGINX_PID $API_PID $AI_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# 等待任一进程退出
wait -n $NGINX_PID $API_PID $AI_PID
EXIT_CODE=$?
echo "⚠️  某个进程已退出 (exit $EXIT_CODE),停止全部服务..."
kill $NGINX_PID $API_PID $AI_PID 2>/dev/null
exit 1
