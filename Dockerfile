# ──────────────────────────────────────────────────────────────
# SmartLearn AI - Hugging Face Spaces 入口 Dockerfile
# HF Spaces SDK=Docker 要求 Dockerfile 必须在仓库根目录
# 本文件面向 HF 部署,本地开发请仍用 docker-compose.yml
# ──────────────────────────────────────────────────────────────

# ========== Stage 1: 构建前端 (student-web + admin) ==========
FROM node:20-alpine AS frontend

WORKDIR /build

COPY apps/student-web/package*.json ./student-web/
RUN cd student-web && npm ci
COPY apps/student-web ./student-web
COPY data ./data
RUN cd student-web && npm run build

COPY apps/admin/package*.json ./admin/
RUN cd admin && npm install
COPY apps/admin ./admin
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

RUN cat api-requirements.txt ai-requirements.txt | grep -v '^pymilvus' > merged.txt \
    && pip install --no-cache-dir -r merged.txt

# ========== Stage 3: 最终镜像 ==========
FROM python:3.11-slim AS final

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx supervisor curl libpq5 postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

WORKDIR /app

# ── 前端构建产物 ──
COPY --from=frontend /build/student-web/dist /app/web/
COPY --from=frontend /build/admin/dist /app/web/admin/

# ── api 后端代码 ──
COPY services/api/app ./app
COPY services/api/startup_check.py ./
COPY services/api/alembic ./alembic
COPY services/api/alembic.ini ./
COPY services/api/scripts ./scripts

# ── ai-engine 代码 ──
COPY services/ai-engine/app ./ai-engine/app
COPY services/ai-engine/config.py ./ai-engine/config.py

COPY data ./data

# ── 部署配置 ──
COPY hf-space/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY hf-space/nginx.conf /etc/nginx/nginx.conf
COPY hf-space/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

RUN mkdir -p /app/logs /app/backups

EXPOSE 7860

CMD ["/app/entrypoint.sh"]
