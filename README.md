---
title: Xuexi
emoji: 📚
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
docker_file: hf-space/Dockerfile
pinned: false
---

# SmartLearn AI - Hugging Face Spaces 部署

## 架构

单容器内通过 `supervisord` 管理 3 个进程:
- **nginx** :7860 — 反向代理 + 静态托管（唯一对外端口）
- **uvicorn api** :8000 — FastAPI 业务后端
- **uvicorn ai-engine** :8001 — AI 引擎（RAG/游戏/对话）

## 外部依赖（需在 Secrets 配置）

| 服务 | 用途 | 申请地址 |
|---|---|---|
| Aiven PostgreSQL | 业务数据持久化 | https://aiven.io/postgresql |
| Upstash Redis | 系统配置缓存 | https://upstash.com/ |
| Upstash QStash | 定时保活 HF + PG | https://upstash.com/qstash |
| GLM / DeepSeek | AI 供应商（至少1个） | https://open.bigmodel.cn/ |

## 保活链

```
Upstash QStash Cron (每5分钟)
  └── GET /keepalive
       ├── 保活 HF Space（防睡眠）
       ├── 查询 PG（保活 Aiven）
       └── 查询 Redis（保活 Upstash）
```

## 配置步骤

1. 在 HF 创建 Space（SDK=Docker）
2. Settings → Repository secrets 填入环境变量（见 .env.example）
3. 推送代码到 HF Space 仓库
4. 在 Upstash QStash 配置定时任务:
   - URL: `https://<你的用户名>-smartlearn.hf.space/keepalive`
   - 频率: 每5分钟
