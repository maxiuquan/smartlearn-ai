# SmartLearn AI - 智能学习平台

> ⚠️ 文档状态说明：本文档已根据 2026-07-08 全量代码审查与整改设计进行**事实校正**。所有数据规模、技术栈、部署拓扑均来自当前仓库真实状态，未做夸大。带「*规划中*」标记的部分尚未纳入生产编排。

## 项目简介

SmartLearn AI 是一个基于人工智能的智能学习平台，面向考研学生，整合知识点管理、智能题库、词汇学习、历年真题与习题样例、游戏化学习，并通过多 AI 供应商架构提供个性化学习路径与智能辅导。

## 核心功能

### 1. 知识点管理
- 学科知识体系覆盖数学（高等数学 / 线性代数 / 概率论）与英语
- 层级化知识点结构（章节 → 小节 → 知识点），支持依赖关系
- 知识点关联与学习进度追踪
- **287 个知识点**（`data/knowledge-points/*`，递归统计实际条目数）

### 2. 智能题库
- **数学 5026 题**（`data/questions/math-full.json`）
- **英语 3224 题**（`data/questions/english-full.json`）
- 另有 `math-examples.json`（50 道示例题，用于联调与演示）
- 智能推荐、错题本、薄弱点分析
- 题目解析与知识点关联（`knowledge_points` 字段引用 `kp-*` / `grammar-*`）

### 3. 词汇学习
- 目标词库：CET4 / 考研核心 **4541+** 词
- **当前已录入 3000+ 条**（CET4 核心词 2760 + 考研高频词 499 + 考研核心词 220 + 同义词/反义词 100 + 词频数据 200），持续扩充中
- 多种单词书、艾宾浩斯遗忘曲线复习（SRS）、词汇测试与评估
- 详见 `data/vocabulary/README.md`

### 4. 历年真题与习题（样例）
- 提供**数据 schema + 代表性样例**，便于对接与校验：
  - 真题：`data/exam-papers/math-sample.json`（3 套样例）、`english-sample.json`（2 套样例），配套 `schema.json`
  - 习题：`data/exercise-books/workbook-sample.json`（5 道样例），配套 `schema.json`
- 完整真题 / 习题库（大规模数据）为后续扩充计划，**当前样例仅作结构与字段示范，不含编造数据**

### 5. AI 智能辅导
- 多 AI 供应商架构（OpenAI / GLM / DeepSeek / SiliconFlow / CogView）
- 智能答疑（RAG 检索增强生成）
- 学习计划生成、知识点讲解与解题思路引导
- TTS / STT / 图像生成、内容安全审核

### 6. 游戏化学习
- **25 款学习游戏**（`data/games/games-config.json`：16 款英语单词游戏、4 款数学游戏、5 款跨科目 / 社交游戏）
- 统一单词进度系统、排行榜与段位、成就系统

### 7. 学生端 Web（student-web）
- 仪表盘（Dashboard）：学习概览、进度追踪
- 词汇学习（VocabLearning）：艾宾浩斯复习、SRS 间隔重复
- 题目练习（QuestionPractice）：智能推荐、错题回顾
- AI 导师（AITutor）：实时问答、RAG 知识检索增强
- 游戏大厅（GameHall）：25 款学习游戏入口
- 单词游戏（WordGame）/ 数学游戏（MathGame）/ 跨科目游戏（CrossSubjectGame）
- 历年真题（PastExam）：真题样例浏览与练习
- 个人中心（Profile）：学习统计、成就展示

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端层 (Frontend)                          │
├───────────────┬───────────────┬───────────────┬─────────────┤
│    admin      │  student-web  │  mobile (*)   │ web(*)/      │
│ (React+AntD)  │ (React+Vite)  │ (RN+Expo,规划中)│ mobile-web(*),规划中 │
└───────────────┴───────────────┴───────────────┴─────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            Nginx 反向代理（默认 80；443 为可选覆盖）            │
│  健康检查: GET /nginx-health → 200                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    服务层 (Services)                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│   API Service   │   AI Engine     │   异步任务               │
│   (FastAPI)     │  (FastAPI+RAG)  │  (Celery Worker/Beat)   │
│   Port 8000     │   Port 8001     │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据层 (Data)                              │
├───────────────┬───────────────┬───────────────┬─────────────┤
│  PostgreSQL   │    Redis      │    Milvus     │   MinIO     │
│  (主数据库)   │  (缓存/队列)  │  (向量存储)   │  (对象存储)  │
└───────────────┴───────────────┴─────────────────────────────┘
```

> （*）`mobile`（React Native + Expo）、`web`（用户端 Next.js）、`mobile-web`（移动端 Web）当前为**规划中**，未纳入 `docker-compose.yml` 生产编排，避免空壳服务导致构建失败。

### 真实技术栈（已校正）
| 层 | 技术 | 说明 |
|----|------|------|
| API 服务 | **FastAPI**（Python） | 无 NestJS；REST + Pydantic |
| AI 引擎 | **FastAPI + RAG** | 检索增强生成、多供应商抽象层 |
| 管理后台 admin | **React + Ant Design** | （非 Vue） |
| 学生端 student-web | **React + Vite** | 经 nginx 80 暴露 |
| 移动端 mobile | React Native + Expo | 规划中 |
| 反向代理 | nginx:alpine | 默认 80，443 可选覆盖 |
| 数据库 | PostgreSQL + Redis | 主库 + 缓存 / 消息 |
| 向量 / 对象存储 | Milvus + MinIO | 向量检索 / 文件存储 |

## 项目结构

```
smartlearn-ai/
├── apps/                              # 前端应用
│   ├── admin/                         # 管理后台 (React + Ant Design)
│   ├── student-web/                   # 学生端 Web (React + Vite)
│   ├── mobile/                        # 移动端 (React Native + Expo，*规划中*)
│   ├── web/                           # 用户端 Web (Next.js，*规划中*)
│   └── mobile-web/                    # 移动端 Web (React，*规划中*)
├── data/                              # 数据文件
│   ├── knowledge-points/              # 知识点 (math/linear-algebra/probability/english.json，共 287)
│   ├── questions/                     # 题目 (math-full.json 5026 / english-full.json 3224 / math-examples.json 50)
│   ├── vocabulary/                    # 词汇 (3000+ 条，含 README.md 说明)
│   ├── exam-papers/                   # 真题样例 + schema (math-sample/english-sample/schema)
│   ├── exercise-books/                # 习题样例 + schema (workbook-sample/schema)
│   ├── games/                         # 25 款游戏配置 + 排行榜配置
│   ├── formulas.json                  # 数学公式库
│   └── roots.json                     # 词根词缀库
├── services/                          # 后端服务
│   ├── api/                           # API 服务 (FastAPI)
│   │   ├── app/                       # 应用代码 (routers/core/db/models/schemas/tasks/main.py)
│   │   ├── alembic/                   # 数据库迁移
│   │   ├── scripts/                   # 数据导入 / 初始化脚本（容器内 /app/scripts）
│   │   │   ├── seed.py
│   │   │   ├── import_knowledge.py
│   │   │   ├── import_questions.py
│   │   │   ├── import_vocabulary.py
│   │   │   └── import_all.py
│   │   ├── Dockerfile.api
│   │   └── requirements.txt
│   └── ai-engine/                     # AI 引擎 (FastAPI + RAG)
│       ├── app/ (routers/providers/main.py)
│       ├── Dockerfile.ai-engine
│       └── requirements.txt
├── infra/                             # 基础设施
│   ├── docker/                        # 覆盖配置 (dev / prod / ssl 可选覆盖)
│   └── nginx/                         # nginx 配置 (nginx.conf + conf.d/ + ssl/)
├── docs/                              # 文档
├── docker-compose.yml                 # 主编排（不含 web/mobile-web）
├── infra/docker/                      # 覆盖配置（dev / prod / 可选 ssl 叠加 docker-compose.ssl.yml）
├── Makefile                           # 常用命令
├── .env.example                       # 环境变量模板（含必填密钥）
├── .gitignore
└── README.md
```

## 部署指南

### 环境要求
- Docker 20.10+ / Docker Compose 2.0+
- Make（可选，命令封装）
- 域名（生产环境 HTTPS 需要）

### 安全基线：缺失密钥即 fail-fast（重要）
生产环境**不允许使用不安全默认值**。以下密钥在 `docker-compose.yml` 中以 `:?err` 声明，**缺失将导致对应容器启动失败**：
- `JWT_SECRET`（API 鉴权签名密钥）
- `AI_ENGINE_API_KEY`（AI 引擎调用密钥，默认 `AI_ENGINE_AUTH_ENABLED=true` 启用鉴权）
- `POSTGRES_PASSWORD`、`REDIS_PASSWORD`
- `MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`

`AI_ENGINE_AUTH_ENABLED` 默认为 `true`，API 访问 AI 引擎需携带合法 API Key。缺失密钥时容器直接退出，**不会**以空密钥或 mock 模式静默运行。

复制模板并填写后再启动：
```bash
cp .env.example .env
# 必须设置上述所有 :?err 变量；可用 openssl rand -hex 32 生成强随机值
```

### 本地开发（Docker Compose）
```bash
# 1. 准备环境变量
cp .env.example .env
#   编辑 .env，至少填写 POSTGRES_PASSWORD / REDIS_PASSWORD / JWT_SECRET / AI_ENGINE_API_KEY

# 2. 启动（热重载 + 暴露数据库端口）
make dev

# 3. 迁移 + 导入数据
make migrate
make import-all
```

访问地址：
- API 文档: http://localhost:8000/docs
- AI 引擎文档: http://localhost:8001/docs
- 管理后台 admin: http://localhost:3000
- 学生端 Web: http://localhost （student-web，经 nginx 80；`/nginx-health` 为健康检查）

> 用户端 `web`（:3001）与 `mobile-web`（:3001）为*规划中*，当前未编排，请勿直接访问。

### VPS 单机部署
```bash
cp .env.example .env
# 生成强密码: openssl rand -hex 32 → JWT_SECRET / AI_ENGINE_API_KEY
#            openssl rand -hex 16 → POSTGRES_PASSWORD / REDIS_PASSWORD / MINIO_*

docker compose up -d
make migrate
make import-all
```
- 生产建议关闭 `DEBUG`，`ENVIRONMENT=production`
- 仅开放 80/443，启用防火墙

### HTTPS（可选覆盖）
默认 nginx 仅监听 80。启用 443 需提供证书并叠加可选覆盖：
```bash
# 将证书放入 infra/nginx/ssl/（fullchain.pem / privkey.pem）
docker compose -f docker-compose.yml -f infra/docker/docker-compose.ssl.yml up -d
```
未提供证书时请勿挂载 ssl 覆盖，避免 nginx 因缺失证书文件崩溃。

### Supabase 混合部署（可选）
生产可将 PostgreSQL / Auth / Storage 托管至 Supabase，VPS 仅运行应用层：
```bash
docker compose up -d api ai-engine celery-worker celery-beat nginx
make migrate && make import-all
```

### 常用命令
```bash
make up              # 启动所有服务
make down            # 停止所有服务
make restart         # 重启
make build           # 构建镜像
make ps              # 服务状态

make logs-api        # API 日志
make logs-ai         # AI 引擎日志
make logs-student    # 学生端 Web 日志
make logs-admin      # 管理后台日志

make migrate         # 数据库迁移
make seed            # 初始数据
make import-kp       # 导入知识点
make import-q        # 导入题目
make import-vocab    # 导入词汇
make import-all      # 导入全部

make test / lint / format / shell-api / shell-ai
make backup / restore / clean
```

## AI 供应商配置
| 供应商 | 用途 | 环境变量 |
|--------|------|----------|
| OpenAI | 通用 LLM / 嵌入 | `OPENAI_API_KEY` |
| GLM (智谱 AI) | 默认聊天主供应商 | `GLM_API_KEY` |
| DeepSeek | 高难度数学 | `DEEPSEEK_API_KEY` |
| SiliconFlow | 嵌入 / TTS / STT | `SILICONFLOW_API_KEY` |
| CogView (智谱 AI) | 图像生成 | `COGVIEW_API_KEY` |

至少配置一个供应商即可启用 AI 功能。

## 游戏模块
平台内置 **25 款**学习游戏（`data/games/games-config.json`）：
- 英语单词游戏 16 款、数学游戏 4 款、跨科目 / 社交游戏 5 款
- 排行榜配置：`data/games/leaderboard-config.json`

## API 文档
- API 服务 (8000): Swagger `http://localhost:8000/docs`，ReDoc `http://localhost:8000/redoc`
  - `/api/v1/auth`、`/api/v1/knowledge`、`/api/v1/questions`、`/api/v1/vocab`、`/api/v1/games`、`/api/v1/wrong-questions`
- AI 引擎 (8001): Swagger `http://localhost:8001/docs`
  - `/chat`、`/rag/query`、`/rag/explain`、`/rag/similar`、`/study/plan`、`/media/tts`、`/media/stt`、`/media/image`、`/moderation`、`/prompts`

## 开发指南
### 本地依赖
```bash
cd services/api && pip install -r requirements.txt
cd services/ai-engine && pip install -r requirements.txt
```
### 代码规范
- Python: PEP 8
- TypeScript: ESLint + Prettier
- 提交信息: Conventional Commits

## 数据校验
数据导入脚本（`services/api/scripts/`）在导入时会校验知识点引用完整性（`knowledge_points` 必须存在于 `data/knowledge-points/*`）。真题 / 习题样例遵循 `data/exam-papers/schema.json`、`data/exercise-books/schema.json`。

## 许可证
MIT License

## 贡献指南
欢迎提交 Issue 与 Pull Request。请确保代码通过测试、遵循规范、提交信息清晰。

## 联系方式
- 项目主页: https://github.com/maxiuquan/smartlearn-ai
- 问题反馈: https://github.com/maxiuquan/smartlearn-ai/issues
