# SmartLearn AI Backend API

智能学习系统后端API服务，基于NestJS + Prisma构建的多学科智能学习平台。

## 技术栈

- **框架**: NestJS 10
- **语言**: TypeScript 5
- **ORM**: Prisma 5
- **数据库**: PostgreSQL
- **认证**: JWT + Passport
- **API文档**: Swagger
- **验证**: class-validator

## 项目结构

```
src/
├── main.ts                    # 应用入口
├── app.module.ts              # 根模块
├── common/                    # 公共模块
│   ├── decorators/            # 自定义装饰器
│   ├── guards/                # 守卫
│   └── prisma/                # Prisma服务
└── modules/                   # 业务模块
    ├── users/                 # 用户模块
    ├── auth/                  # 认证模块
    ├── questions/             # 题库模块
    ├── subjects/              # 学科模块
    ├── knowledge-points/      # 知识点模块
    ├── learning-records/      # 学习记录模块
    ├── review/                # 复习系统模块
    ├── study-plan/            # 备考规划模块
    ├── vocabulary/            # 单词模块
    ├── achievements/          # 成就系统模块
    ├── real-exam/             # 真题模块
    └── exercise-books/        # 习题册模块
```

## 功能模块

### 1. 用户模块 (users)
- 用户注册、登录
- 个人信息管理
- 密码修改
- 用户统计

### 2. 题库模块 (questions)
- 题目CRUD操作
- 多种题型支持（单选、多选、填空、简答等）
- 题目分类和标签
- 题目搜索
- 答题提交和判题

### 3. 学习记录模块 (learning-records)
- 答题记录追踪
- 学习进度统计
- 每日学习数据
- 学科进度分析

### 4. 知识点模块 (knowledge-points)
- 知识点树形结构
- 知识点依赖关系
- 掌握度追踪
- 知识点关联题目

### 5. 复习系统模块 (review)
- SM-2遗忘曲线算法
- 复习任务调度
- 复习统计
- 遗忘曲线可视化

### 6. 备考规划模块 (study-plan)
- 考试规划创建
- 每日计划生成
- 学习建议
- 进度追踪

### 7. 学科模块 (subjects)
- 多学科支持（数学、政治、英语、专业课）
- 学科统计

### 8. 单词模块 (vocabulary)
- 单词库管理
- 记忆卡片
- 单词复习
- 学习统计

### 9. 成就系统模块 (achievements)
- 成就定义
- 成就解锁
- 徽章系统
- 进度追踪

### 10. 真题模块 (real-exam)
- 历年真题管理
- 模拟考试
- 成绩统计

### 11. 习题册模块 (exercise-books)
- 习题册管理（660题、880题等）
- 进度追踪
- 练习记录

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartlearn?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
PORT=3000
```

### 3. 初始化数据库

```bash
# 生成Prisma客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# (可选) 打开Prisma Studio
npm run prisma:studio
```

### 4. 启动服务

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

### 5. 访问API文档

启动服务后访问：http://localhost:3000/api-docs

## API接口概览

### 认证相关
- `POST /users/register` - 用户注册
- `POST /users/login` - 用户登录
- `GET /auth/verify` - 验证Token

### 用户相关
- `GET /users/profile` - 获取用户信息
- `PUT /users/profile` - 更新用户信息
- `PUT /users/password` - 修改密码
- `GET /users/stats` - 获取用户统计

### 题库相关
- `GET /questions` - 获取题目列表
- `GET /questions/:id` - 获取题目详情
- `POST /questions` - 创建题目
- `POST /questions/:id/submit` - 提交答案

### 复习相关
- `GET /review/tasks/today` - 获取今日复习任务
- `POST /review/tasks/:id/submit` - 提交复习结果
- `GET /review/stats` - 获取复习统计

### 备考规划
- `POST /study-plan` - 创建备考计划
- `GET /study-plan/active` - 获取当前计划
- `GET /study-plan/:id/overview` - 获取计划概览

## 数据库模型

主要数据表：
- `users` - 用户表
- `subjects` - 学科表
- `questions` - 题目表
- `knowledge_points` - 知识点表
- `learning_records` - 学习记录表
- `review_tasks` - 复习任务表
- `study_plans` - 备考计划表
- `vocabularies` - 单词表
- `achievements` - 成就表
- `exam_papers` - 真题试卷表
- `exercise_books` - 习题册表

## 开发命令

```bash
# 开发
npm run start:dev          # 启动开发服务器
npm run lint               # 代码检查
npm run format             # 代码格式化

# 测试
npm run test               # 单元测试
npm run test:e2e           # E2E测试
npm run test:cov           # 测试覆盖率

# 数据库
npm run prisma:generate    # 生成Prisma客户端
npm run prisma:migrate     # 运行迁移
npm run prisma:studio      # 打开Prisma Studio
```

## 许可证

MIT License
