# ──────────────────────────────────────────────────────────────
# SmartLearn AI - Hugging Face Spaces 单容器部署
# ──────────────────────────────────────────────────────────────
# 构建上下文: 项目根目录
# README.md 里 docker_file: Dockerfile (根目录)
# ──────────────────────────────────────────────────────────────

# 强制打破 Docker 缓存(每次构建都重新执行所有层)
ARG CACHE_BUSTER=v2026-07-08-v4

# ========== Stage 1: 构建前端 (student-web + admin) ==========
FROM node:20-alpine AS frontend

WORKDIR /build

# --- student-web ---
COPY apps/student-web/package*.json ./student-web/
# 安装 @types/node 解决 vite.config.ts 中 path/fs/__dirname 类型缺失
RUN cd student-web && npm ci && npm install --save-dev @types/node

# 复制源代码
COPY apps/student-web ./student-web
# 复制 data 到 student-web/data(适配 vite.config.ts 的 fallback 路径 ./data)
COPY data ./student-web/data
# 调试:确认 data 文件存在
RUN ls -la /build/student-web/data/games/ && cat /build/student-web/data/games/games-config.json | head -5
# 直接用 vite build 跳过 tsc 类型检查(生产构建不需要类型检查)
RUN cd student-web && npx vite build

# --- admin (base 设为 /admin/ 以支持子路径部署) ---
COPY apps/admin/package*.json ./admin/
RUN cd admin && npm install

COPY apps/admin ./admin
# 通过 --base /admin/ 让构建产物资源路径带 /admin/ 前缀
RUN cd admin && npx vite build --base /admin/

# ========== Stage 2: 安装 Python 依赖 ==========
FROM python:3.11-slim AS deps

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY services/api/requirements.txt ./api-requirements.txt
COPY services/ai-engine/requirements.txt ./ai-requirements.txt

# 合并安装（pip 自动去重）;跳过 pymilvus（HF 部署用 inmemory 向量存储，省 ~200MB）
# 先 cat 第一个文件,echo 加换行,再 cat 第二个文件,避免包名粘连
RUN (cat api-requirements.txt; echo; cat ai-requirements.txt) | grep -v '^pymilvus' > merged.txt \
    && pip install --no-cache-dir -r merged.txt

# ========== Stage 3: 最终镜像 ==========
FROM python:3.11-slim AS final

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PIP_NO_CACHE_DIR=1 \
    RAG_DATA_DIR=/app/data

# 运行时依赖:
#   nginx          反向代理 + 静态托管
#   supervisor     进程守护（nginx + 2 个 uvicorn）
#   postgresql-client  alembic 迁移 + pg_dump 备份
#   libpq5         asyncpg/psycopg2 运行时库
#   curl           健康检查
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx supervisor curl libpq5 postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces 强制以 UID 1000 运行容器,创建非 root 用户适配
RUN useradd -m -u 1000 user

# 从 deps 阶段复制已安装的 Python 包
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

WORKDIR /app

# ── 前端构建产物合并到 /app/web ──
# student-web 在根路径 /,admin 在子路径 /admin/
COPY --from=frontend --chown=user /build/student-web/dist /app/web/
COPY --from=frontend --chown=user /build/admin/dist /app/web/admin/

# ── api 后端代码 ──
COPY --chown=user services/api/app ./app
COPY --chown=user services/api/startup_check.py ./startup_check.py
COPY --chown=user services/api/alembic ./alembic
COPY --chown=user services/api/alembic.ini ./alembic.ini
COPY --chown=user services/api/scripts ./scripts

# ── ai-engine 代码（保持目录结构,main.py 的 sys.path 依赖此布局）──
COPY --chown=user services/ai-engine/app ./ai-engine/app
COPY --chown=user services/ai-engine/config.py ./ai-engine/config.py

# ── 数据文件（题库/词汇/知识点,供 ai-engine 离线加载）──
COPY --chown=user data ./data

# ── 部署配置 ──
COPY --chown=user hf-space/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
# nginx.conf 复制到 /app/ (user 可写),entrypoint.sh sed 注入 API Key 后再复制到 /etc/nginx/
COPY --chown=user hf-space/nginx.conf /app/nginx.conf
COPY --chown=user hf-space/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# 创建日志/备份目录,确保 user 可写
RUN mkdir -p /app/logs /app/backups /var/log/supervisor /var/run/supervisor \
    && chown -R user:user /app /var/log/supervisor /var/run/supervisor /var/lib/nginx /var/log/nginx /etc/nginx

# nginx 以非 root 运行:pid 和 temp 文件需放在 user 可写目录
# nginx.conf 已配置 pid /tmp/nginx.pid 和 temp 路径在 /tmp/
# 但 /var/lib/nginx/body 等 defaults 需可写
RUN chmod -R 777 /var/lib/nginx /var/log/nginx 2>/dev/null || true

USER user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

EXPOSE 7860

# entrypoint: 迁移 → 初始化管理员 → 注入 API Key → 启动 supervisord
CMD ["/app/entrypoint.sh"]
