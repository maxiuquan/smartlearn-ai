# SmartLearn AI - 智能学习平台

## 项目简介

SmartLearn AI 是一个基于人工智能的智能学习平台，专为考研学生设计。平台整合了知识点管理、智能题库、词汇学习、历年真题分析、游戏化学习等功能，通过多 AI 供应商架构提供个性化学习路径和智能辅导。

## 核心功能

### 1. 知识点管理
- 完整的学科知识体系（高等数学、线性代数、概率论、英语）
- 层级化的知识点结构，支持依赖关系
- 知识点关联与学习进度追踪
- 287 个知识点，覆盖数学和英语核心考点

### 2. 智能题库
- 8300+ 精选题目（数学 5575 题、英语 3224 题）
- 智能推荐算法，基于能力评估
- 错题本与薄弱点分析
- 题目解析与知识点关联（100% 引用完整性）

### 3. 词汇学习
- 考研核心词汇库（4541 CET4 单词 + 考研词汇）
- 多种单词书支持
- 艾宾浩斯遗忘曲线复习（SRS 算法）
- 词汇测试与评估

### 4. 历年真题
- 数学与英语历年真题分类
- 答题技巧总结
- 出题规律分析
- 模拟考试功能

### 5. AI 智能辅导
- 多 AI 供应商架构（OpenAI / GLM / DeepSeek / SiliconFlow / CogView）
- 智能答疑系统（RAG 检索增强生成）
- 学习计划生成
- 知识点讲解与解题思路引导
- TTS 语音合成、STT 语音识别、图像生成
- 内容安全审核

### 6. 游戏化学习
- 25 款学习游戏（16 款英语单词游戏、4 款数学游戏、5 款跨科目/社交游戏）
- 统一单词进度系统
- 排行榜与段位系统
- 成就系统

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端层 (Frontend)                          │
├───────────────┬───────────────┬───────────────┬─────────────┤
│  mobile-web   │    admin      │     web       │   mobile    │
│  (React)      │  (Vue.js)     │  (Next.js)    │ (React Native)│
└───────────────┴───────────────┴───────────────┴─────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Nginx 反向代理                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    服务层 (Services)                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│   API Service   │   AI Engine     │   异步任务               │
│   (FastAPI)     │   (FastAPI)     │   (Celery Worker/Beat)  │
│   Port 8000     │   Port 8001     │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据层 (Data)                              │
├───────────────┬───────────────┬───────────────┬─────────────┤
│  PostgreSQL   │    Redis      │    Milvus     │   MinIO     │
│  (主数据库)   │  (缓存/队列)  │  (向量存储)   │  (对象存储)  │
└───────────────┴───────────────┴───────────────┴─────────────┘
```

## 项目结构

```
smartlearn-ai/
├── apps/                              # 前端应用
│   ├── admin/                         # 管理后台 (Vue.js + Vite)
│   │   ├── src/
│   │   │   ├── pages/                 # 页面 (dashboard, knowledge, question, word, user...)
│   │   │   ├── components/            # 组件 (StatCard, Chart, KnowledgeTreeSelect...)
│   │   │   ├── services/              # API 服务层
│   │   │   └── stores/                # 状态管理
│   │   ├── Dockerfile.admin
│   │   └── package.json
│   ├── mobile/                        # 移动端 (React Native)
│   │   ├── src/
│   │   │   ├── screens/               # 页面 (auth, home, knowledge, learn, word, profile)
│   │   │   ├── components/            # 组件 (common, question, word)
│   │   │   ├── services/              # API 服务层
│   │   │   └── stores/                # 状态管理
│   │   ├── App.tsx
│   │   └── package.json
│   ├── mobile-web/                    # 移动端 Web 版 (React)
│   │   ├── Dockerfile.mobile
│   │   └── package.json
│   └── web/                           # 用户端 Web (Next.js)
│       ├── Dockerfile.web
│       └── package.json
├── data/                              # 数据文件
│   ├── knowledge-points/              # 知识点数据
│   │   ├── math.json                  # 高等数学知识点
│   │   ├── linear-algebra.json        # 线性代数知识点
│   │   ├── probability.json           # 概率论知识点
│   │   └── english.json               # 英语知识点
│   ├── questions/                     # 题目数据
│   │   ├── math-full.json             # 数学完整题库 (5575题)
│   │   ├── math-examples.json         # 数学示例题目
│   │   └── english-full.json          # 英语完整题库 (3224题)
│   ├── vocabulary/                    # 词汇数据
│   │   ├── kaoyan-words.json          # 考研核心词汇
│   │   ├── word-books.json            # 单词书配置
│   │   ├── word-frequency.json        # 词频数据
│   │   └── synonyms.json              # 同义词数据
│   ├── exam-papers/                   # 历年真题
│   │   ├── math-real-exams.json
│   │   ├── english-real-exams.json
│   │   └── schema.json
│   ├── exercise-books/                # 习题册数据
│   │   ├── math-exercise-books.json
│   │   ├── english-exercise-books.json
│   │   └── schema.json
│   ├── games/                         # 游戏配置
│   │   ├── games-config.json          # 25款游戏配置
│   │   └── leaderboard-config.json    # 排行榜配置
│   ├── formulas.json                  # 数学公式库
│   └── roots.json                     # 词根词缀库
├── services/                          # 后端服务
│   ├── api/                           # API 服务 (FastAPI + NestJS)
│   │   ├── app/
│   │   │   ├── api/v1/                # API 路由 (auth, games, knowledge, questions, vocab)
│   │   │   ├── core/                  # 核心模块 (config, security, deps)
│   │   │   ├── db/                    # 数据库会话
│   │   │   ├── models/                # 数据模型
│   │   │   ├── schemas/               # Pydantic 模式
│   │   │   ├── tasks/                 # Celery 异步任务
│   │   │   ├── main.py                # FastAPI 入口
│   │   │   └── celery_app.py          # Celery 配置
│   │   ├── alembic/                   # 数据库迁移
│   │   ├── src/                       # NestJS 模块
│   │   │   └── modules/               # (achievements, auth, knowledge-points, questions,
│   │   │                              #  vocabulary, real-exam, study-plan, users...)
│   │   ├── scripts/                   # 数据导入脚本
│   │   ├── Dockerfile.api
│   │   └── requirements.txt
│   └── ai-engine/                     # AI 引擎服务 (FastAPI)
│       ├── app/
│       │   ├── routers/               # API 路由
│       │   │   ├── chat_router.py     # 对话接口
│       │   │   ├── rag_router.py      # RAG 检索增强
│       │   │   ├── study_router.py    # 学习计划
│       │   │   ├── media_router.py    # TTS/STT/图像生成
│       │   │   ├── moderation_router.py  # 内容审核
│       │   │   └── prompt_router.py   # Prompt 模板管理
│       │   ├── providers/             # AI 供应商抽象层
│       │   └── main.py                # FastAPI 入口
│       ├── Dockerfile.ai-engine
│       └── requirements.txt
├── infra/                             # 基础设施配置
│   ├── docker/                        # Docker 开发/生产覆盖配置
│   │   ├── docker-compose.dev.yml     # 开发环境覆盖
│   │   └── docker-compose.prod.yml    # 生产环境覆盖
│   └── nginx/                         # Nginx 配置
│       ├── nginx.conf                 # 主配置
│       └── conf.d/                    # 站点配置
├── scripts/                           # 工具脚本
│   ├── import_knowledge.py            # 导入知识点
│   ├── import_questions.py            # 导入题目
│   ├── import_vocabulary.py           # 导入词汇
│   ├── import_all.py                  # 导入全部数据
│   ├── seed.py                        # 初始数据填充
│   ├── verify-kp-refs.ts              # 验证知识点引用完整性
│   ├── validate-data.ts               # 数据校验
│   ├── generate-math-questions.ts     # 数学题目生成
│   ├── generate-english-questions.ts  # 英语题目生成
│   ├── generate-cet4-words.ts         # CET4 词汇生成
│   └── fix-kp-refs.ts                 # 知识点引用修复
├── docs/                              # 项目文档
│   ├── SmartLearn AI —— 商业可用级完善方案（精读版）.md
│   └── SmartLearn AI —— AI 能力接入全景方案.md
├── docker-compose.yml                 # Docker Compose 编排（主配置）
├── Makefile                           # 常用命令
├── .env                               # 环境变量（开发环境）
├── .env.example                       # 环境变量模板
├── .gitignore
└── README.md
```

## 快速开始

### 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- Make (可选)

### 安装部署

1. 克隆项目
```bash
git clone https://github.com/maxiuquan/smartlearn-ai.git
cd smartlearn-ai
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的密钥和密码
# 至少需要设置 POSTGRES_PASSWORD、REDIS_PASSWORD、JWT_SECRET、MINIO_ACCESS_KEY、MINIO_SECRET_KEY
```

3. 启动服务
```bash
# 使用 Makefile
make up

# 或直接使用 docker compose
docker compose --env-file .env up -d
```

4. 运行数据库迁移
```bash
make migrate
```

5. 导入数据
```bash
make import-all
```

6. 访问服务
- API 文档: http://localhost:8000/docs
- AI 引擎文档: http://localhost:8001/docs
- 管理后台: http://localhost:3000
- Web 前端: http://localhost:3000 (通过 Nginx)
- 移动端 Web: http://localhost:3001

### 常用命令

```bash
# 服务管理
make up              # 启动所有服务
make down            # 停止所有服务
make restart         # 重启所有服务
make build           # 构建所有镜像
make rebuild         # 重新构建并启动
make ps              # 查看服务状态

# 日志查看
make logs            # 查看所有日志
make logs-api        # 查看 API 服务日志
make logs-ai         # 查看 AI 引擎日志
make logs-mobile     # 查看移动端日志
make logs-admin      # 查看管理后台日志

# 数据管理
make migrate         # 运行数据库迁移
make seed            # 填充初始数据
make import-kp       # 导入知识点数据
make import-q        # 导入题目数据
make import-vocab    # 导入词汇数据
make import-all      # 导入所有数据

# 开发调试
make dev             # 启动开发环境（热重载）
make test            # 运行测试
make lint            # 代码检查
make format          # 代码格式化
make shell-api       # 进入 API 容器
make shell-ai        # 进入 AI 引擎容器

# 备份恢复
make backup          # 备份数据库
make restore         # 恢复数据
make clean           # 清理无用数据
```

## AI 供应商配置

SmartLearn AI 支持多 AI 供应商架构，按需配置即可：

| 供应商 | 用途 | 环境变量 |
|--------|------|----------|
| OpenAI | 通用 LLM / 嵌入 | `OPENAI_API_KEY` |
| GLM (智谱 AI) | 默认聊天主供应商 | `GLM_API_KEY` |
| DeepSeek | 高难度数学问题 | `DEEPSEEK_API_KEY` |
| SiliconFlow (硅基流动) | 嵌入 / TTS / STT | `SILICONFLOW_API_KEY` |
| CogView (智谱 AI) | 图像生成 | `COGVIEW_API_KEY` |

至少配置一个供应商即可启用 AI 功能。未配置任何 API Key 时，AI 引擎将运行在离线模式（使用模拟响应）。

## 游戏模块

平台内置 25 款学习游戏：

| 类别 | 游戏数量 | 示例 |
|------|---------|------|
| 英语单词游戏 | 16 | 单词拼写、词义匹配、单词雨、听音选词、闪卡速记 |
| 数学游戏 | 4 | 速算挑战、公式配对、几何拼图、函数绘图 |
| 跨科目/社交游戏 | 5 | 知识竞赛、组队挑战、排行榜对战、每日挑战、成就收集 |

游戏配置位于 `data/games/games-config.json`，排行榜配置位于 `data/games/leaderboard-config.json`。

## API 文档

启动服务后，访问以下地址查看 API 文档：

### API 服务 (Port 8000)
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

主要端点：
- `/api/v1/auth` - 认证
- `/api/v1/knowledge` - 知识点管理
- `/api/v1/questions` - 题库管理
- `/api/v1/vocab` - 词汇学习
- `/api/v1/games` - 游戏管理
- `/api/v1/wrong-questions` - 错题本

### AI 引擎 (Port 8001)
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

主要端点：
- `/chat` - AI 对话
- `/rag/query` - 知识库检索
- `/rag/explain` - 知识点讲解
- `/rag/similar` - 相似题目检索
- `/study/plan` - 学习计划生成
- `/media/tts` - 文本转语音
- `/media/stt` - 语音转文本
- `/media/image` - 图像生成
- `/moderation` - 内容审核
- `/prompts` - Prompt 模板管理

## 开发指南

### 本地开发

1. 安装依赖
```bash
# API 服务
cd services/api
pip install -r requirements.txt

# AI 引擎
cd services/ai-engine
pip install -r requirements.txt
```

2. 启动开发环境（热重载）
```bash
make dev
```

### 开发环境覆盖

开发环境使用 `infra/docker/docker-compose.dev.yml` 覆盖配置，自动挂载源代码目录并启用热重载，同时暴露数据库和 Redis 端口到宿主机。

### 代码规范

- Python: 遵循 PEP 8 规范
- TypeScript: 使用 ESLint + Prettier
- 提交信息: 遵循 Conventional Commits 规范

## 数据校验

项目包含完整的数据质量保障脚本：

```bash
# 验证知识点引用完整性
npx tsx scripts/verify-kp-refs.ts

# 数据格式校验
npx tsx scripts/validate-data.ts
```

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request。请确保：

1. 代码通过所有测试
2. 遵循代码规范
3. 提交信息清晰明确

## 联系方式

- 项目主页: https://github.com/maxiuquan/smartlearn-ai
- 问题反馈: https://github.com/maxiuquan/smartlearn-ai/issues