# SmartLearn AI — VPS 部署指南

本文档介绍如何在 VPS (Linux) 上从零部署 SmartLearn AI 生产环境。适用于首次部署与日常运维。

> 项目使用 Docker Compose 编排，包含 FastAPI + PostgreSQL + Redis + Nginx + 多个前端服务，全部通过容器运行，无需在宿主机安装 Python/Node.js。

---

## 目录

1. [环境要求](#1-环境要求)
2. [域名与 DNS](#2-域名与-dns)
3. [首次部署](#3-首次部署)
4. [HTTPS 配置](#4-https-配置)
5. [日常运维](#5-日常运维)
6. [备份与恢复](#6-备份与恢复)
7. [可选功能配置](#7-可选功能配置)
8. [管理后台访问](#8-管理后台访问)
9. [防火墙建议](#9-防火墙建议)
10. [常见问题](#10-常见问题)

---

## 1. 环境要求

### 1.1 服务器配置

| 项目       | 最低要求          | 推荐              |
| ---------- | ----------------- | ----------------- |
| 操作系统   | Ubuntu 22.04 / Debian 12 | Ubuntu 24.04 LTS |
| CPU        | 2 核              | 4 核              |
| 内存       | 2 GB              | 4 GB              |
| 磁盘       | 20 GB SSD         | 50 GB SSD         |
| 带宽       | 5 Mbps            | 10 Mbps           |

> ⚠️ 启用 Milvus 向量数据库时，内存需 ≥ 8 GB。

### 1.2 必装软件

- **Docker Engine** ≥ 24.0
- **Docker Compose v2** (内置 `docker compose` 子命令)
- **git**
- **curl / wget**

安装 Docker (Ubuntu/Debian):

```bash
# 官方一键脚本
curl -fsSL https://get.docker.com | sudo bash

# 将当前用户加入 docker 组 (免 sudo)
sudo usermod -aG docker $USER
newgrp docker

# 验证
docker --version
docker compose version
```

### 1.3 端口准备

| 端口 | 用途              | 是否对外开放 |
| ---- | ----------------- | ------------ |
| 80   | HTTP (含 ACME 验证) | ✅ 是         |
| 443  | HTTPS             | ✅ 是         |
| 22   | SSH               | ✅ 是         |
| 5432 | PostgreSQL        | ❌ 否         |
| 6379 | Redis             | ❌ 否         |

---

## 2. 域名与 DNS

### 2.1 主域名

将主域名 A 记录指向 VPS 公网 IP:

```
your-domain.com       A    <VPS_IP>
www.your-domain.com   A    <VPS_IP>
```

### 2.2 可选子域名 (按需)

如需独立子域名访问各端，可添加:

```
api.your-domain.com    A    <VPS_IP>   # API 服务
ai.your-domain.com     A    <VPS_IP>   # AI 引擎
admin.your-domain.com  A    <VPS_IP>   # 管理后台
```

> 默认配置采用**路径路由** (`/api`、`/ai`、`/admin`、`/m`)，单域名即可访问所有服务，子域名非必需。

### 2.3 验证 DNS 解析

```bash
dig your-domain.com +short
# 或
ping your-domain.com
```

返回的 IP 应为 VPS 公网 IP。

---

## 3. 首次部署

### 3.1 拉取代码

```bash
cd /opt
sudo git clone <repo-url> smartlearn
cd smartlearn
```

### 3.2 配置环境变量

```bash
cp .env.example .env
nano .env   # 或使用 vim/vscode
```

**必须修改的字段** (改为强随机值，不要使用占位符):

| 字段                | 说明                       | 生成方式                        |
| ------------------- | -------------------------- | ------------------------------- |
| `POSTGRES_PASSWORD` | 数据库密码 (≥12 位)        | `openssl rand -base64 24`       |
| `REDIS_PASSWORD`    | Redis 密码 (≥12 位)        | `openssl rand -base64 24`       |
| `JWT_SECRET`        | JWT 签名密钥 (≥32 位)      | `openssl rand -hex 32`          |
| `MINIO_ACCESS_KEY`  | MinIO 访问密钥             | `openssl rand -hex 16`          |
| `MINIO_SECRET_KEY`  | MinIO 秘钥                 | `openssl rand -hex 32`          |
| `CORS_ORIGINS`      | 允许的前端源 (逗号分隔)    | `https://your-domain.com`       |
| `ENVIRONMENT`       | 改为 `production`          | `production`                    |
| `DEBUG`             | 改为 `false`               | `false`                         |

**可选字段** (按需配置，留空不影响启动):

- AI 供应商: `GLM_API_KEY` / `DEEPSEEK_API_KEY` / `SILICONFLOW_API_KEY` 等
- 支付: `WECHAT_*` / `ALIPAY_*`
- 短信: `SMS_*`
- 邮件: `SMTP_*`
- 对象存储: `OSS_*`
- HTTPS: `DOMAIN` / `CERTBOT_EMAIL`

### 3.3 一键部署

```bash
bash scripts/deploy.sh
```

脚本会自动完成:

1. ✅ 检查 `.env`、Docker、必要环境变量
2. ✅ 创建必要目录 (`backups/`、`infra/nginx/ssl/`、`infra/nginx/certbot/www/`)
3. ✅ 构建并启动所有服务
4. ✅ 等待数据库 healthy
5. ✅ 运行 `alembic upgrade head` 数据库迁移
6. ✅ 运行 `python scripts/import_all.py` 导入初始数据
7. ✅ 交互式创建超级管理员
8. ✅ 申请 HTTPS 证书 (若配置了 `DOMAIN`)
9. ✅ 打印部署完成摘要

#### 常用参数

```bash
# 跳过初始数据导入 (适合二次部署)
bash scripts/deploy.sh --skip-import

# 跳过 HTTPS 申请 (稍后手动配置)
bash scripts/deploy.sh --skip-ssl

# 跳过创建超管 (已有超管时)
bash scripts/deploy.sh --skip-admin

# 全部跳过 (仅启动服务+迁移)
bash scripts/deploy.sh --skip-import --skip-ssl --skip-admin

# 指定域名 (覆盖 .env)
bash scripts/deploy.sh --domain=your-domain.com
```

### 3.4 创建超级管理员

若部署时跳过了创建超管，可随时手动创建:

```bash
# 交互式
bash scripts/create-admin.sh

# 直接传参
bash scripts/create-admin.sh admin@your-domain.com 'MyP@ssw0rd123'

# 含手机号
bash scripts/create-admin.sh admin@your-domain.com 'MyP@ssw0rd123' 13800000000
```

> 若邮箱已存在，脚本会自动将该用户**升级为 super_admin** 并重置密码，可用于忘记密码时的紧急重置。

---

## 4. HTTPS 配置

### 4.1 自动申请 (推荐)

1. 在 `.env` 中设置:

   ```
   DOMAIN=your-domain.com
   CERTBOT_EMAIL=admin@your-domain.com
   ```

2. 确保 DNS 已解析且 80 端口可访问 (用于 Let's Encrypt 验证)。

3. 运行 certbot 容器:

   ```bash
   docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml \
     --profile certbot run --rm certbot
   ```

4. 将 nginx 的 ssl 证书路径指向 Let's Encrypt 证书，并 reload:

   ```bash
   # 证书位置: /etc/letsencrypt/live/your-domain.com/
   # 若 nginx 配置使用 ./infra/nginx/ssl/，可建立软链:
   ln -sf /etc/letsencrypt/live/your-domain.com/fullchain.pem infra/nginx/ssl/fullchain.pem
   ln -sf /etc/letsencrypt/live/your-domain.com/privkey.pem   infra/nginx/ssl/privkey.pem

   # reload nginx
   docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml \
     exec nginx nginx -s reload
   ```

### 4.2 自动续期

Let's Encrypt 证书有效期 90 天，建议设置 cron 自动续期:

```bash
# 编辑 root 的 crontab
sudo crontab -e

# 添加以下行 (每月 1 号凌晨 3 点续期 + reload nginx)
0 3 1 * * cd /opt/smartlearn && docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml --profile certbot run --rm certbot && docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec nginx nginx -s reload
```

### 4.3 使用已有证书

若已有 SSL 证书 (如商业证书)，将 `fullchain.pem` 和 `privkey.pem` 放到 `infra/nginx/ssl/` 目录即可，nginx 配置已指向该路径。

---

## 5. 日常运维

### 5.1 常用命令

```bash
# Compose 命令前缀
export DC="docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml"

# 查看服务状态
$DC ps

# 查看实时日志
$DC logs -f                     # 全部
$DC logs -f api                 # 仅 API
$DC logs -f ai-engine           # 仅 AI 引擎
$DC logs -f nginx               # 仅 Nginx
$DC logs --tail=100 api         # 最近 100 行

# 重启某服务
$DC restart api

# 进入容器 shell
$DC exec api /bin/bash
$DC exec db /bin/sh

# 查看资源占用
$DC stats
```

### 5.2 更新版本

```bash
cd /opt/smartlearn
git pull

# 重新构建并启动 (会自动热更新)
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d --build

# 如有新的数据库迁移
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api alembic upgrade head
```

### 5.3 数据库迁移

```bash
# 升级到最新版本
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api alembic upgrade head

# 查看当前版本
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api alembic current

# 查看迁移历史
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api alembic history
```

### 5.4 重新导入数据

```bash
# 全部导入
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api python scripts/import_all.py

# 单独导入
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api python scripts/import_knowledge.py
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api python scripts/import_questions.py
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api python scripts/import_vocabulary.py
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api python scripts/seed.py
```

---

## 6. 备份与恢复

### 6.1 手动备份

```bash
bash scripts/backup.sh
```

备份文件: `backups/YYYYMMDD_HHMMSS.sql.gz`

可指定连接参数:

```bash
DB_HOST=db DB_USER=smartlearn_user DB_PASSWORD=xxx DB_NAME=smartlearn \
  bash scripts/backup.sh
```

### 6.2 自动备份 (db-backup 服务)

生产 compose 已内置 `db-backup` 服务 (基于 `postgres:16-alpine` + `crond`)，默认每天 02:00 自动备份，保留 7 天。

启动自动备份服务 (后台常驻):

```bash
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml \
  --profile backup up -d db-backup
```

调整备份计划 (在 `.env` 中):

```
BACKUP_CRON=0 2 * * *        # 每天凌晨 2 点 (默认)
BACKUP_RETAIN_DAYS=7         # 保留 7 天 (默认)
```

查看备份日志:

```bash
docker logs smartlearn-db-backup
cat backups/backup.log
```

### 6.3 恢复备份

```bash
# 恢复最近的备份 (会提示确认)
bash scripts/restore.sh latest

# 恢复指定备份
bash scripts/restore.sh 20260705_120000.sql.gz

# 恢复绝对路径
bash scripts/restore.sh /path/to/backup.sql.gz
```

> ⚠️ 恢复操作会**覆盖现有数据**，执行前会要求输入 `yes` 确认。建议先停掉 API 服务再恢复。

### 6.4 备份策略建议

| 备份类型 | 频率        | 保留期 | 位置             |
| -------- | ----------- | ------ | ---------------- |
| 自动备份 | 每天 02:00  | 7 天   | VPS `backups/`   |
| 手动备份 | 升级前      | 永久   | 本地 + 异地      |
| 异地备份 | 每周        | 4 周   | OSS / 其他服务器 |

建议将 `backups/` 目录定期同步到对象存储或其他服务器，防止 VPS 故障导致备份丢失:

```bash
# 示例: 同步到阿里云 OSS
ossutil cp -r backups/ oss://your-bucket/smartlearn-backups/ --recursive
```

---

## 7. 可选功能配置

以下功能**不配置也能正常运行**，仅对应功能不可用。配置后需重启 API 服务生效:

```bash
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml restart api
```

### 7.1 支付 (微信/支付宝)

在 `.env` 中配置:

```
# 微信支付
WECHAT_APP_ID=wx...
WECHAT_MCH_ID=...
WECHAT_API_KEY=...

# 支付宝
ALIPAY_APP_ID=...
ALIPAY_PRIVATE_KEY=...
ALIPAY_PUBLIC_KEY=...
```

留空 = 不启用支付功能。

### 7.2 短信 (SMS)

```
SMS_ACCESS_KEY=...
SMS_SECRET_KEY=...
SMS_SIGN_NAME=SmartLearn
```

留空 = 不启用短信验证码功能 (注册/登录将使用邮箱验证)。

### 7.3 邮件 (SMTP)

```
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=noreply@your-domain.com
SMTP_PASS=...
```

留空 = 不启用邮件功能 (邮箱注册/找回密码不可用)。

### 7.4 对象存储 (OSS)

```
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
OSS_ACCESS_KEY=...
OSS_SECRET_KEY=...
OSS_BUCKET=smartlearn
```

留空 = 文件/头像使用本地存储。

### 7.5 AI 供应商

至少配置一个即可启用 AI 功能:

```
# OpenAI 兼容
OPENAI_API_KEY=sk-...
OPENAI_API_BASE=https://api.openai.com/v1

# 或国产替代 (推荐)
GLM_API_KEY=...                  # 智谱 AI (有免费额度)
DEEPSEEK_API_KEY=...             # DeepSeek
SILICONFLOW_API_KEY=...          # 硅基流动 (嵌入/TTS)
```

留空 = AI 聊天/出题/向量检索功能不可用，但学习/做题等基础功能正常。

---

## 8. 管理后台访问

### 8.1 访问地址

```
https://your-domain.com/admin
```

(若未启用 HTTPS，则使用 `http://<VPS_IP>/admin`)

### 8.2 登录账号

使用 [3.4 节](#34-创建超级管理员) 创建的超级管理员账号登录:

- 邮箱: 创建时输入的邮箱
- 密码: 创建时输入的密码
- 角色: `super_admin` (拥有全部权限)

### 8.3 忘记超管密码

可在 VPS 上重置:

```bash
bash scripts/create-admin.sh admin@your-domain.com 'NewPassword123'
```

脚本会将该邮箱用户升级为 super_admin 并重置密码。

---

## 9. 防火墙建议

### 9.1 UFW 配置 (Ubuntu)

```bash
# 默认拒绝入站
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 开放必要端口
sudo ufw allow 22/tcp        # SSH (建议改为非默认端口)
sudo ufw allow 80/tcp        # HTTP (含 ACME 验证)
sudo ufw allow 443/tcp       # HTTPS

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status verbose
```

### 9.2 重要原则

- ❌ **不要**对外暴露 `5432` (PostgreSQL)
- ❌ **不要**对外暴露 `6379` (Redis)
- ❌ **不要**对外暴露 `8000/8001` (API/AI 引擎)
- ❌ **不要**对外暴露 `3000/3001/5173` (前端开发端口)
- ✅ 仅通过 Nginx (80/443) 对外提供服务
- ✅ 数据库/缓存仅允许容器内网访问

### 9.3 SSH 加固

```bash
# 修改 SSH 端口
sudo nano /etc/ssh/sshd_config
# Port 22222

# 禁用密码登录 (配置好密钥后再禁用)
# PasswordAuthentication no

sudo systemctl restart sshd
```

### 9.4 Fail2ban (可选)

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

---

## 10. 常见问题

### 10.1 端口被占用

**现象**: `docker compose up` 报错 `bind: address already in use`

**排查**:

```bash
# 查看占用端口的进程
sudo lsof -i :80
sudo lsof -i :443

# 停止占用进程 (如 Apache/Nginx)
sudo systemctl stop apache2
sudo systemctl disable apache2

# 或修改本项目的端口 (在 .env 中)
NGINX_HTTP_PORT=8080
NGINX_HTTPS_PORT=8443
```

### 10.2 数据库迁移失败

**现象**: `alembic upgrade head` 报错

**排查**:

```bash
# 查看数据库当前版本
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api alembic current

# 查看迁移历史
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml exec api alembic history

# 查看具体错误日志
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml logs --tail=200 api
```

**解决**:

- 若是表已存在错误: 检查是否重复执行迁移，可标记为已应用 `alembic stamp <revision>`
- 若是连接错误: 检查 db 容器是否 healthy
- 若是字段冲突: 备份数据后回滚到上一版本 `alembic downgrade -1`

### 10.3 忘记超管密码

```bash
bash scripts/create-admin.sh admin@your-domain.com 'NewPassword123'
```

脚本会重置该邮箱用户的密码并升级为 super_admin。

### 10.4 容器无法启动

```bash
# 查看具体错误
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml logs <服务名>

# 查看容器状态
docker ps -a | grep smartlearn

# 重新构建镜像
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml build --no-cache <服务名>
```

### 10.5 HTTPS 证书申请失败

**原因 1: DNS 未生效**

```bash
dig your-domain.com +short
# 应返回 VPS 公网 IP
```

**原因 2: 80 端口不通**

```bash
# 检查防火墙
sudo ufw status

# 检查 80 端口是否被占用
sudo lsof -i :80
```

**原因 3: Let's Encrypt 限流**

Let's Encrypt 每周对同一域名有申请次数限制 (5 次/周)。若多次失败，可先用自签证书过渡，或使用 `--staging` 测试。

### 10.6 磁盘空间不足

```bash
# 查看磁盘占用
df -h

# 清理 Docker 无用资源
docker system prune -a --volumes
# ⚠️ 注意: 此命令会删除未使用的卷，包括数据库数据，谨慎使用!

# 清理旧备份
find backups/ -name "*.sql.gz" -mtime +7 -delete

# 清理大日志
docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml logs --tail=0 -f  # 不再追加
```

### 10.7 内存不足 (OOM)

```bash
# 查看内存占用
free -h
docker stats

# 添加 swap (临时缓解)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

如长期内存不足，建议升级 VPS 配置或减少服务副本数 (修改 `infra/docker/docker-compose.prod.yml` 中的 `replicas`)。

### 10.8 服务无法访问

排查顺序:

1. **容器是否运行**: `docker compose ps` — 所有服务应为 `Up` 状态
2. **健康检查**: `docker inspect smartlearn-api --format='{{.State.Health.Status}}'` — 应为 `healthy`
3. **Nginx 配置**: `$DC exec nginx nginx -t` — 应返回 `syntax is ok`
4. **网络连通**: `curl -I http://localhost/` — 应返回 301 或 200
5. **API 健康**: `curl http://localhost/health` — 应返回 200
6. **日志**: `docker compose logs --tail=100 <服务名>`

---

## 附录：项目目录结构

```
/opt/smartlearn/
├── docker-compose.yml                    # 基础 compose
├── infra/docker/docker-compose.prod.yml  # 生产覆盖
├── .env                                  # 环境变量 (从 .env.example 复制)
├── scripts/
│   ├── deploy.sh                         # 一键部署
│   ├── backup.sh                         # 数据库备份
│   ├── restore.sh                        # 数据库恢复
│   └── create-admin.sh                   # 创建超管
├── backups/                              # 备份文件
├── infra/nginx/
│   ├── nginx.conf
│   ├── conf.d/
│   ├── ssl/                              # SSL 证书
│   └── certbot/www/                      # ACME 验证目录
└── ...
```

## 附录：常用 Compose 命令速查

```bash
# 定义别名
alias dcprod="docker compose -f docker-compose.yml -f infra/docker/docker-compose.prod.yml"

dcprod up -d                              # 启动所有服务
dcprod up -d --build                      # 重新构建并启动
dcprod down                               # 停止所有服务
dcprod restart api                        # 重启某服务
dcprod ps                                 # 查看服务状态
dcprod logs -f api                        # 查看日志
dcprod exec api /bin/bash                 # 进入容器
dcprod exec api alembic upgrade head      # 跑迁移
dcprod exec api python scripts/import_all.py  # 导入数据
dcprod --profile certbot run --rm certbot # 申请 HTTPS 证书
dcprod --profile backup up -d db-backup   # 启动自动备份
dcprod stats                              # 查看资源占用
```

---

如有问题，请先查看 [常见问题](#10-常见问题) 章节，再查阅项目 README 或联系开发团队。
