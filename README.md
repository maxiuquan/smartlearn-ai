# SmartLearn AI - 智能学习平台

## 项目简介

SmartLearn AI 是一个基于人工智能的智能学习平台，专为考研学生设计。平台整合了知识点管理、智能题库、词汇学习、历年真题分析等功能，通过AI技术提供个性化学习路径和智能辅导。

## 核心功能

### 1. 知识点管理
- 完整的学科知识体系（高等数学、线性代数、概率论等）
- 层级化的知识点结构
- 知识点关联与依赖关系
- 学习进度追踪

### 2. 智能题库
- 海量精选题目（数学、英语、专业课等）
- 智能推荐算法
- 错题本与薄弱点分析
- 题目解析与知识点关联

### 3. 词汇学习
- 考研核心词汇库
- 多种单词书支持
- 艾宾浩斯遗忘曲线复习
- 词汇测试与评估

### 4. 历年真题
- 真题分类与标签
- 答题技巧总结
- 出题规律分析
- 模拟考试功能

### 5. AI智能辅导
- 智能答疑系统
- 学习计划生成
- 知识点讲解
- 解题思路引导

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端层 (Frontend)                      │
├─────────────────┬─────────────────┬─────────────────────┤
│   移动端 Web    │    管理后台     │     用户端 Web       │
│   (React)       │    (Vue.js)     │     (Next.js)        │
└─────────────────┴─────────────────┴─────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    API 网关层 (Nginx)                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    服务层 (Services)                      │
├─────────────────┬─────────────────┬─────────────────────┤
│   API Service   │   AI Engine     │   Task Scheduler    │
│   (FastAPI)     │   (LangChain)   │   (Celery)          │
└─────────────────┴─────────────────┴─────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    数据层 (Data)                          │
├─────────────────┬─────────────────┬─────────────────────┤
│   PostgreSQL    │     Redis       │   Vector Store      │
│   (主数据库)    │   (缓存/队列)   │   (向量存储)        │
└─────────────────┴─────────────────┴─────────────────────┘
```

## 项目结构

```
smartlearn-ai/
├── data/                          # 数据文件
│   ├── knowledge-points/          # 知识点数据
│   │   ├── math.json              # 高等数学知识点
│   │   ├── linear-algebra.json    # 线性代数知识点
│   │   └── probability.json       # 概率论知识点
│   ├── questions/                 # 题目数据
│   │   └── math-examples.json     # 数学示例题目
│   ├── vocabulary/                # 词汇数据
│   │   ├── kaoyan-words.json      # 考研核心词汇
│   │   └── word-books.json        # 单词书配置
│   ├── exam-papers/               # 历年真题
│   └── exercise-books/            # 习题册数据
├── infra/                         # 基础设施配置
│   ├── docker/                    # Docker配置
│   │   ├── docker-compose.yml     # 服务编排
│   │   ├── Dockerfile.api         # API服务镜像
│   │   ├── Dockerfile.ai-engine   # AI引擎镜像
│   │   ├── Dockerfile.mobile      # 移动端构建
│   │   ├── Dockerfile.admin       # 管理后台构建
│   │   └── .env.example           # 环境变量示例
│   └── nginx/                     # Nginx配置
│       ├── nginx.conf             # 主配置
│       └── conf.d/                # 站点配置
│           ├── api.conf           # API代理
│           └── frontend.conf      # 前端配置
├── README.md                      # 项目说明
├── Makefile                       # 常用命令
└── .gitignore                     # Git忽略配置
```

## 快速开始

### 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- Make (可选)

### 安装部署

1. 克隆项目
```bash
git clone https://github.com/smartlearn-ai/smartlearn-ai.git
cd smartlearn-ai
```

2. 配置环境变量
```bash
cp infra/docker/.env.example infra/docker/.env
# 编辑 .env 文件，配置必要的环境变量
```

3. 启动服务
```bash
# 使用 Makefile
make up

# 或直接使用 docker-compose
cd infra/docker
docker-compose up -d
```

4. 访问服务
- API文档: http://localhost:8000/docs
- 管理后台: http://localhost:3000
- 移动端: http://localhost:3001

### 常用命令

```bash
make up          # 启动所有服务
make down        # 停止所有服务
make logs        # 查看日志
make build       # 构建镜像
make migrate     # 运行数据库迁移
make test        # 运行测试
make lint        # 代码检查
```

## 数据导入

```bash
# 导入知识点数据
make import-knowledge

# 导入题目数据
make import-questions

# 导入词汇数据
make import-vocabulary

# 导入所有数据
make import-all
```

## API文档

启动服务后，访问以下地址查看API文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 开发指南

### 本地开发

1. 安装依赖
```bash
# API服务
cd services/api
pip install -r requirements.txt

# AI引擎
cd services/ai-engine
pip install -r requirements.txt
```

2. 启动开发服务器
```bash
make dev
```

### 代码规范

- Python: 遵循 PEP 8 规范，使用 Black 格式化
- JavaScript/TypeScript: 使用 ESLint + Prettier
- 提交信息: 遵循 Conventional Commits 规范

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request。请确保：

1. 代码通过所有测试
2. 遵循代码规范
3. 提交信息清晰明确

## 联系方式

- 项目主页: https://github.com/smartlearn-ai
- 问题反馈: https://github.com/smartlearn-ai/issues
