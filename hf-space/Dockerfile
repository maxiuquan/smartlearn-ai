# ──────────────────────────────────────────────────────────────
# SmartLearn AI - Hugging Face Spaces 单容器部署
# ──────────────────────────────────────────────────────────────
# 构建上下文: 项目根目录
# HF Space Settings → SDK=Docker, Dockerfile path=hf-space/Dockerfile
# ──────────────────────────────────────────────────────────────

# 强制打破 Docker 缓存(每次构建都重新执行所有层)
ARG CACHE_BUSTER=v2026-07-14-v29

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

# 使用 CACHE_BUSTER 强制打破 deps 阶段缓存（确保 sympy 等新依赖被安装）
ARG CACHE_BUSTER
RUN echo "Cache bust (deps): $CACHE_BUSTER" && cat api-requirements.txt ai-requirements.txt | grep -v '^pymilvus' > merged.txt \
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

# 从 deps 阶段复制已安装的 Python 包
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

WORKDIR /app

# 使用 CACHE_BUSTER 强制打破后续 COPY 层的缓存
ARG CACHE_BUSTER
RUN echo "Cache bust: $CACHE_BUSTER"

# ── 前端构建产物合并到 /app/web ──
# student-web 在根路径 /,admin 在子路径 /admin/
COPY --from=frontend /build/student-web/dist /app/web/
COPY --from=frontend /build/admin/dist /app/web/admin/

# ── api 后端代码 ──
COPY services/api/app ./app
COPY services/api/startup_check.py ./startup_check.py
COPY services/api/alembic ./alembic
COPY services/api/alembic.ini ./alembic.ini
COPY services/api/scripts ./scripts

# ── ai-engine 代码（保持目录结构,main.py 的 sys.path 依赖此布局）──
COPY services/ai-engine/app ./ai-engine/app
COPY services/ai-engine/config.py ./ai-engine/config.py

# ── 数据文件（题库/词汇/知识点,供 ai-engine 离线加载）──
COPY data ./data

# ── 部署配置 ──
COPY hf-space/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY hf-space/nginx.conf /etc/nginx/nginx.conf
COPY hf-space/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# 创建日志/备份目录
RUN mkdir -p /app/logs /app/backups

EXPOSE 7860

# entrypoint: 迁移 → 初始化管理员 → 注入 API Key → 启动 supervisord
CMD ["/app/entrypoint.sh"]
