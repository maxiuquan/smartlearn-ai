# SmartLearn AI Engine

智能学习平台的AI引擎服务，提供个性化学习推荐、能力评估、知识图谱等核心AI能力。

## 功能模块

### 1. 智能推题引擎 (Recommendation)
根据用户能力模型智能推荐题目：
- 分析用户能力水平
- 考虑知识点掌握度
- 平衡难度和挑战性
- 多策略推荐支持

### 2. 遗忘曲线算法 (Forgetting Curve)
艾宾浩斯遗忘曲线实现：
- 计算记忆保持率
- 生成复习时间表
- 确定复习优先级
- 动态调整复习间隔

### 3. 能力评估 (Ability Assessment)
用户能力等级评估：
- IRT-like能力计算模型
- 多维度能力分析
- 置信度评估
- 提升建议生成

### 4. 知识图谱 (Knowledge Graph)
知识点依赖关系图：
- 知识节点管理
- 前置/依赖关系
- 拓扑排序学习顺序
- 路径规划

### 5. 手写识别 (Handwriting)
OCR识别接口（模拟实现）：
- 文字识别
- 数学公式检测
- 多语言支持
- 实时识别

### 6. 智能批改 (Grading)
答案批改与错误分析：
- 多题型支持
- 错误类型识别
- 步骤分析
- 改进建议

### 7. 学习路径生成 (Learning Path)
前置知识点链与学习路径：
- 前置知识分析
- 学习步骤生成
- 进度追踪
- 自适应调整

### 8. 每日规划 (Daily Planning)
智能分配每日学习任务：
- 复习任务安排
- 薄弱知识点练习
- 新知识学习
- 趣味游戏

### 9. 单词游戏 (Word Games)
趣味单词游戏逻辑：
- 多种游戏类型
- 积分系统
- 排行榜
- 徽章奖励

## 技术栈

- **Python**: 3.11+
- **Web框架**: FastAPI
- **数据验证**: Pydantic
- **数学计算**: NumPy, SciPy
- **异步支持**: aiohttp, httpx

## 项目结构

```
ai-engine/
├── main.py                 # 主入口文件
├── config.py               # 配置文件
├── requirements.txt        # 依赖列表
├── README.md               # 项目文档
├── models/                 # 数据模型层
│   ├── __init__.py
│   ├── recommendation.py   # 推题模型
│   ├── forgetting_curve.py # 遗忘曲线模型
│   ├── ability_assessment.py # 能力评估模型
│   ├── knowledge_graph.py  # 知识图谱模型
│   ├── handwriting.py      # 手写识别模型
│   ├── grading.py          # 批改模型
│   ├── learning_path.py    # 学习路径模型
│   ├── daily_planning.py   # 每日规划模型
│   └── word_games.py       # 单词游戏模型
├── services/               # 服务层
│   ├── __init__.py
│   ├── recommendation_service.py
│   ├── forgetting_curve_service.py
│   ├── ability_assessment_service.py
│   ├── knowledge_graph_service.py
│   ├── handwriting_service.py
│   ├── grading_service.py
│   ├── learning_path_service.py
│   ├── daily_planning_service.py
│   └── word_games_service.py
└── routers/                # 路由层
    ├── __init__.py
    ├── recommendation_router.py
    ├── forgetting_curve_router.py
    ├── ability_assessment_router.py
    ├── knowledge_graph_router.py
    ├── handwriting_router.py
    ├── grading_router.py
    ├── learning_path_router.py
    ├── daily_planning_router.py
    └── word_games_router.py
```

## 快速开始

### 1. 安装依赖

```bash
cd ai-engine
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 开发模式
python main.py

# 或使用 uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 端点

### 智能推题
- `POST /recommendation/get` - 获取推荐题目

### 遗忘曲线
- `POST /forgetting-curve/schedule` - 获取复习计划
- `POST /forgetting-curve/update` - 更新记忆状态
- `GET /forgetting-curve/curve-data` - 获取曲线数据

### 能力评估
- `POST /ability/assess` - 评估用户能力
- `POST /ability/batch-assess` - 批量评估
- `GET /ability/levels` - 获取等级说明

### 知识图谱
- `POST /knowledge-graph/get` - 获取知识图谱
- `POST /knowledge-graph/prerequisites` - 获取前置知识
- `GET /knowledge-graph/subjects` - 获取科目列表

### 手写识别
- `POST /handwriting/recognize` - 识别手写内容
- `POST /handwriting/realtime` - 实时识别
- `GET /handwriting/languages` - 获取支持语言

### 智能批改
- `POST /grading/grade` - 批改答案
- `POST /grading/batch-grade` - 批量批改
- `POST /grading/analyze-errors` - 分析错误模式
- `GET /grading/error-types` - 获取错误类型

### 学习路径
- `POST /learning-path/generate` - 生成学习路径
- `POST /learning-path/update-progress` - 更新进度
- `POST /learning-path/adapt` - 自适应调整
- `GET /learning-path/{path_id}` - 获取路径详情

### 每日规划
- `POST /daily-planning/create` - 创建每日计划
- `POST /daily-planning/update` - 更新计划进度
- `POST /daily-planning/weekly` - 创建周计划
- `GET /daily-planning/{plan_id}` - 获取计划详情

### 单词游戏
- `POST /word-games/start` - 开始游戏
- `POST /word-games/submit` - 提交答案
- `GET /word-games/summary/{session_id}` - 获取游戏总结
- `POST /word-games/leaderboard` - 获取排行榜
- `GET /word-games/game-types` - 获取游戏类型

## 配置说明

可通过环境变量或 `.env` 文件配置：

```env
# 服务配置
APP_NAME=SmartLearn AI Engine
APP_VERSION=1.0.0
DEBUG=true
HOST=0.0.0.0
PORT=8000

# 遗忘曲线配置
FORGETTING_BASE=2.0
FORGETTING_DECAY=0.3

# 能力评估配置
ABILITY_LEVELS=10
MIN_QUESTIONS_FOR_ASSESSMENT=5

# 推荐配置
RECOMMENDATION_BATCH_SIZE=10
DIFFICULTY_ADJUSTMENT_FACTOR=0.1

# 学习路径配置
DEFAULT_DAILY_GOAL=20
MASTERY_THRESHOLD=0.8
```

## 核心算法

### 艾宾浩斯遗忘曲线

```
R = e^(-t/S)
```

其中：
- R: 记忆保持率
- t: 时间（天）
- S: 记忆稳定性参数

### 能力评估模型

基于IRT-like简化模型：

```
ability = weighted_score / total_weight
```

考虑因素：
- 题目难度权重
- 答题时间因子
- 正确率

### 推荐策略

根据用户能力选择策略：
- `基础巩固策略`: ability < 0.3
- `稳步提升策略`: 0.3 <= ability < 0.5
- `突破进阶策略`: 0.5 <= ability < 0.7
- `高阶拓展策略`: ability >= 0.7

## 开发指南

### 添加新模块

1. 在 `models/` 创建数据模型
2. 在 `services/` 创建服务逻辑
3. 在 `routers/` 创建API路由
4. 在 `main.py` 注册路由

### 运行测试

```bash
pytest tests/
```

## 许可证

MIT License
