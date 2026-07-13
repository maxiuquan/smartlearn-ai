# ──────────────────────────────────────────────────────────────
# SmartLearn AI - Hugging Face Spaces 单容器部署
# ──────────────────────────────────────────────────────────────
# 构建上下文: 项目根目录
# README.md 里 docker_file: Dockerfile (根目录)
# ──────────────────────────────────────────────────────────────

# 强制打破 Docker 缓存(每次构建都重新执行所有层)
ARG CACHE_BUSTER=v2026-07-13-v24

# ========== Stage 1: 构建前端 (student-web + admin) ==========
# P1-05: 固定基础镜像到具体版本，避免浮动 tag 导致构建不可复现
FROM node:20.18-alpine AS frontend

WORKDIR /build

# --- student-web ---
COPY apps/student-web/package*.json ./student-web/
# P1-05: @types/node 已加入 package.json devDependencies，只需 npm ci
RUN cd student-web && npm ci

# 复制源代码
COPY apps/student-web ./student-web
# 复制 data 到 student-web/data(适配 vite.config.ts 的 fallback 路径 ./data)
COPY data ./student-web/data
# 调试:确认 data 文件存在
RUN ls -la /build/student-web/data/games/ && cat /build/student-web/data/games/games-config.json | head -5
# P1-05: 使用 npm run build（tsc -b 类型检查 + vite build），不再跳过类型检查
RUN cd student-web && npm run build

# --- admin (base 设为 /admin/ 以支持子路径部署) ---
COPY apps/admin/package*.json ./admin/
# P1-05: admin 统一使用 npm ci（已有 package-lock.json）
RUN cd admin && npm ci

COPY apps/admin ./admin
# P1-05: 使用 npm run build（tsc -b 类型检查 + vite build --base /admin/）
RUN cd admin && npm run build -- --base /admin/

# ========== Stage 2: 安装 Python 依赖 ==========
# P1-05: 固定 Python 基础镜像版本
FROM python:3.11.10-slim AS deps

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
# 使用 CACHE_BUSTER 强制打破 deps 阶段缓存（确保 sympy 等新依赖被安装）
ARG CACHE_BUSTER
RUN echo "Cache bust (deps): $CACHE_BUSTER" && (cat api-requirements.txt; echo; cat ai-requirements.txt) | grep -v '^pymilvus' > merged.txt \
    && pip install --no-cache-dir -r merged.txt

# ========== Stage 3: 最终镜像 ==========
# P1-05: 固定 Python 基础镜像版本
FROM python:3.11.10-slim AS final

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

# P1-05: 移除 chmod -R 777，使用最小权限替代
# nginx.conf 已配置 pid /tmp/nginx.pid 和 temp 路径在 /tmp/，
# /var/lib/nginx/body 等 defaults 已由上方 chown -R user:user 授予 user 用户所有权
RUN mkdir -p /var/lib/nginx/body && chown -R user:user /var/lib/nginx/body

USER user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

EXPOSE 7860

# entrypoint: 迁移 → 初始化管理员 → 注入 API Key → 启动 supervisord
CMD ["/app/entrypoint.sh"]
