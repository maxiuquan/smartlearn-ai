# VPS 部署 + 管理后台完整化设计方案

**日期**: 2026-07-05
**状态**: 已批准，实施中

## 背景与问题

1. 管理后台前端 (`apps/admin`) 已完整，但**后端 admin API 完全缺失**（无 `/users/*`、`/system/*`、`/auth/me` 等），前端调用全部 404
2. 支付/短信/邮件仅在 `.env.example` 声明，**代码零实现**，`config.py` 未读取这些字段
3. `services/api/app/models/` 为空，`auth.py` 用原始 SQL，无可复用 ORM
4. `users` 表缺 `status`/`vip_level`/`last_login_at` 等列，无法支持"管理员手动加权限/VIP/角色/配额"
5. 无 `get_current_admin_user` 依赖，无 role 校验
6. 已有 `docker-compose.prod.yml` / README 部署章节 / nginx 配置（含 `/admin` 路由），但缺 certbot 自动化、备份 cron、一键脚本

## 目标

- **A. 可选模块不阻塞启动**：支付/短信/邮件未配置时，应用正常启动；admin 能登录、能手动改用户角色/VIP/配额/状态
- **B. 全套管理后端 API**：让 `apps/admin` 前端所有页面可用
- **C. VPS 部署交付物**：文档 + 一键脚本 + 完善 compose + 自动 HTTPS + 备份

## 设计

### 1. 数据库迁移 (alembic 002)

`users` 表加列：
- `nickname` VARCHAR(100) nullable
- `avatar` VARCHAR(500) nullable
- `status` VARCHAR(20) default 'active' not null（active/banned）
- `last_login_at` DateTime nullable
- `vip_level` Integer default 0 not null
- `vip_expire_at` DateTime nullable
- `ai_quota_daily_override` Integer nullable（NULL 表示走订阅默认值）

复用现有 `subscriptions`（会员计划）、`audit_logs`（管理员操作留痕）。

### 2. ORM 模型 (`services/api/app/models/`)

新建文件：`user.py`、`subscription.py`、`audit_log.py`、`question.py`、`knowledge_point.py`、`vocab.py`、`game.py`、`__init__.py` 导出全部。

替换 `auth.py` 中的 `Table()` 原始 SQL。

### 3. 认证增强

- `core/security.py`：`create_access_token` 已支持 `extra_claims`，在 `auth.py` 调用时传入 `{"role": user.role, "status": user.status}`
- `core/deps.py` 新增：
  - `get_current_user`：返回完整 User 对象（查库、验 status=banned 时拒登）
  - `get_current_admin_user`：role ∈ {admin, super_admin}
  - `get_current_super_admin`：role == super_admin
- `api/v1/auth.py` 新增：
  - `GET /auth/me` 返回当前用户完整信息
  - `POST /auth/logout`（JWT 无状态，仅前端清 token；记录 audit log）
  - `POST /auth/change-password`
- 修复 `register`/`login` 写入 `nickname`/`last_login_at`、JWT 带 role claim

### 4. Admin API 模块

| 文件 | 端点 |
|---|---|
| `api/v1/users.py` | GET /users（列表分页搜索）、GET /users/{id}、POST /users（创建）、PUT /users/{id}（更新基本信息）、POST /users/{id}/ban、POST /users/{id}/enable、DELETE /users/{id}、POST /users/{id}/reset-password、PUT /users/{id}/role、PUT /users/{id}/vip（等级+有效期）、PUT /users/{id}/ai-quota、GET /users/{id}/stats、POST /users/import、GET /users/export |
| `api/v1/system.py` | GET /system/config、PUT /system/config、GET /system/info、GET /system/logs、POST /system/clear-cache、GET /system/backups、POST /system/backup、POST /system/restore/{id}、POST /system/test-email、POST /system/test-sms |
| `api/v1/statistics.py` | GET /statistics/overview、GET /statistics/users |
| `api/v1/audit.py` | GET /audit-logs（分页搜索） |

所有写操作记录到 `audit_logs`（actor=用户名、action、target、details JSONB）。

业务管理端点（创建/更新/删除）追加到现有 `knowledge.py`/`questions.py`/`vocab.py`/`games.py`，需 admin 依赖。

### 5. 可选服务占位 (`services/api/app/services/`)

- `feature_flags.py`：`is_payment_enabled()` / `is_sms_enabled()` / `is_email_enabled()` / `is_oss_enabled()` / `get_feature_status()`
- `payment_service.py`：`PaymentService`，未配置时 `is_enabled=False`，`create_order` raise `FeatureNotEnabledError`
- `sms_service.py`：同上
- `email_service.py`：同上
- `core/config.py` 加 Optional 字段：`WECHAT_APP_ID/MCH_ID/API_KEY`、`ALIPAY_APP_ID/PRIVATE_KEY/PUBLIC_KEY`、`SMS_ACCESS_KEY/SECRET_KEY/SIGN_NAME`、`SMTP_HOST/PORT/USER/PASS/FROM`、`OSS_*`

启动时 `_startup_security_check` 对未配置的可选模块只 warning，不 raise。

### 6. 前端增强 (`apps/admin/src/`)

- `pages/user/UserDetail.tsx`：加「修改角色」「修改 VIP 等级+有效期」「修改 AI 配额」「重置密码」按钮 + 弹窗表单
- `pages/user/UserList.tsx`：加批量禁用/启用
- `stores/authStore.ts` + `App.tsx` `ProtectedRoute`：加 role 校验（非 admin 跳转登录页 + 提示）
- `pages/system/SystemSettings.tsx`：邮件/短信测试按钮根据 `feature_status` 显示「未配置」徽标；隐藏不可用功能
- `services/authService.ts`：`LoginParams.username` 兼容（前端可传 phone 或 email）
- `services/userService.ts`：补 `resetPassword`/`updateRole`/`updateVip`/`updateAiQuota` 调用
- `services/systemService.ts`：补 `getFeatureStatus`

### 7. VPS 部署交付物

| 文件 | 内容 |
|---|---|
| `infra/docker/docker-compose.prod.yml` | 完善：certbot 服务、db-backup cron 服务、所有 volumes、healthcheck |
| `infra/nginx/conf.d/default.conf` | 保留 `/admin` 路由（不加 IP 白名单，由前端登录守卫） |
| `scripts/deploy.sh` | 一键：检查 .env、docker compose up -d、申请 HTTPS、跑迁移、导数据、创建超管 |
| `scripts/backup.sh` | 数据库备份脚本（保留 7 天） |
| `scripts/restore.sh` | 恢复脚本 |
| `scripts/create-admin.sh` | 创建超管账号脚本 |
| `docs/VPS_DEPLOY.md` | 完整 VPS 部署指南 |
| `.env.example` | 更新：明确标注必填/可选 |

### 8. 关键约束

- **支付/短信/邮件未配置时**：app 正常启动；admin 能登录；admin 能手动改用户权限/角色/VIP/配额
- 所有管理员写操作记录到 `audit_logs`
- 迁移可回滚（alembic downgrade）
- 不破坏现有 6 个业务路由

## 实施顺序

1. 数据库迁移 + ORM 模型（基础，其他依赖）
2. config.py + deps.py + security.py + auth.py（认证增强）
3. 可选服务占位（独立）
4. Admin API（依赖 1+2）
5. 注册路由
6. 前端增强（依赖 4）
7. VPS 部署交付物（独立，可与 4-6 并行）
