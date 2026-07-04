# SmartLearn AI / LexiStrike —— 提交代码审查报告

<aside>
🚨

**一句话结论**:这次提交把**两个不同的项目合并进了同一个仓库**,但只有其中一套(LexiStrike:`client + server + admin`)真正接线并可运行;另一套(`services/api` NestJS + `services/ai-engine` Python + `apps/admin`)是**未接线的孤儿代码**。更关键的是——我们花大量篇幅写的《AI 能力接入全景方案》目前 **0% 落地**:代码里没有任何大模型调用,没有 RAG / embedding / 向量库 / 内容审核,所谓「AI」目前是**规则模板 + 统计算法**。距离「一次上线不迭代」还很远,当务之急是**先做减法、统一架构**。

</aside>

## 一、仓库整体判断

- 实际在跑的项目是 **LexiStrike Global**(`package.json` name = `lexi-strike-global`,workspaces 只含 `client / server / admin`,数据库名 `lexistrike`)。
- `docker-compose.yml` 只启动三样:`db`(Postgres)+ `api`(根 Dockerfile 构建的 **Express server**,端口 3001)+ `nginx`(托管 `client/dist`)。
- **`services/`(NestJS api + Python ai-engine)和 `apps/`(第二套 admin)既不在 workspaces,也不在 compose**,不参与构建与部署 → 属于合并进来但没用起来的死代码。
- 命名严重分裂:仓库叫 `smartlearn-ai`、代码叫 `LexiStrike`、文档叫 `SmartLearn AI`——三个身份。

| 目录 | 技术栈 | 是否接线 | 说明 |
| --- | --- | --- | --- |
| `server/` | Express + Prisma(TS) | ✅ 唯一在跑 | compose 的 api 就是它 |
| `client/` | 前端 | ✅ | nginx 托管 dist |
| `admin/` | React | ✅(workspace) | 老后台 |
| `services/api/` | NestJS + Prisma(TS) | ❌ 孤儿 | 另一套后端 + 另一份 schema |
| `services/ai-engine/` | Python FastAPI | ❌ 孤儿 | 纯算法,无 LLM |
| `apps/admin/` | React | ❌ 孤儿 | 第二套后台 |
| `electron/`  • capacitor | 桌面 / 移动壳 | ⚠️ | 依赖 client 构建 |

## 二、🔴 P0 阻断级(上线前必须解决)

1. **三套后端并存、只有一套接线** —— `server`(Express)与 `services/api`(NestJS)功能高度重叠(都做题库 / 知识点 / 用户 / 成就),却是两套独立实现 + 两份 Prisma schema(`server/prisma` 8.8KB vs `api/prisma` 22KB)。必须**二选一**并删掉另一套,否则数据模型与业务逻辑无法统一,每次改动都要改两遍且会漂移。
2. **《AI 能力接入全景方案》0% 落地** —— 这是最大落差:
    - `server/src/services/ai-analysis.ts`、`ai-guess.ts`:**没有任何大模型调用**,全是 Prisma 查询 + `Math.random()` 模板拼接(`generateArticleFromWords` 用固定英文段落模板、`generateWordQuestions` 随机组选项)。
    - `services/ai-engine/requirements.txt`:只有 `fastapi / numpy / scipy`,**没有 openai / langchain / 任何 LLM SDK**;`config.py` 无任何模型或密钥配置;`main.py` 明确写 OCR 是「模拟实现」。
    - 全仓库**没有** embedding、向量库(Milvus)、RAG、Moderation、GLM / DeepSeek / CogView / 硅基流动 的任何影子。
    - 即:多供应商路由、答疑 RAG、作文批改、内容安全等**目前都还是文档,不是代码**。
3. **数据以源码形式提交** —— `server/src/data/english-words-cet4.ts` 达 **990 KB**、`seed.ts` 达 **214 KB**,直接 import 进构建。会拖慢构建 / 吃内存、污染 diff、难维护。应改为数据文件 + 运行时 / 迁移导入。

## 三、🟠 P1 高优先级

1. **25 款游戏未落地** —— `server/src/routes/english-games.ts` 仅 3.9KB,远撑不起文档里的 25 款;`ai-engine/word_games` 是孤儿。当前游戏化只是雏形。
2. **缺测试** —— 在跑的 `server` 没有测试目录;`ai-engine` 虽列了 pytest 但本身没接线。活跃代码里测试基本缺位,谈不上「一次上线不迭代」。
3. **安全弱默认** —— `JWT_SECRET` 默认 `change-me`、`POSTGRES_PASSWORD` 默认 `postgres`、Postgres `5432` 直接对宿主暴露;生产缺密钥强校验。
4. **CORS 过宽** —— Express 默认 `origin:'*'`;FastAPI 更是 `allow_origins:['*']` + `allow_credentials:True`(无效且危险的组合)。生产需按域名白名单。

## 四、🟡 P2 中优先级 / 清理

- `ai-engine` `DEBUG=True` 默认 + `reload` 打开,不宜作为生产默认。
- 之前发现的数据 bug 仍需复查:`math` 题库 solution 口水话残留、答案 / 解析矛盾、孤立知识点引用(建议对 `data/knowledge-points/math.json` 与题库跑一致性校验)。
- 两套 admin(`admin/` 与 `apps/admin/`)择一删除。
- 根目录同时有 `capacitor.config.json` 与 `capacitor.config.ts`,确认保留其一。

## 五、文档承诺 vs 实际(对照)

| 能力 | 文档方案 | 实际代码 | 状态 |
| --- | --- | --- | --- |
| 多 AI 供应商路由 | GLM/DeepSeek/CogView/硅基流动 按能力×科目 | 无任何 LLM 调用 | ❌ 未实现 |
| RAG 答疑 | Embeddings + Milvus + Chat + 引用 | 无 embedding / 向量库 | ❌ 未实现 |
| 作文批改 / 长难句 | Chat 批改 | 模板 / 规则 | ❌ 未实现 |
| 内容安全 | Moderation | 无 | ❌ 未实现 |
| 掌握度 / 复习(SRS) | IRT + 遗忘曲线 | `mastery-engine`/`review-scheduler` | ✅ 已实现 |
| 错题诊断 / 推荐 | 规则 + AI | 规则版已实现(无 AI) | 🟡 部分 |
| 统一后端 / 数据模型 | 单一 API | 三套后端两份 schema | ❌ 冲突 |

## 六、做得不错的地方(别全盘否定)

- `server` 分层清晰:routes / services / middleware 齐全,有 rateLimiter、securityHeaders、errorHandler、requestLogger。
- **掌握度与复习是真本事**:`mastery-engine`(IRT θ + 衰减)、`review-scheduler`、`recommendation-engine` 是实打实的算法实现,是产品核心壁垒。
- `ai-engine`(即便孤儿)FastAPI 结构规范、模块划分清楚,若要做 AI 网关是不错的骨架。
- 三端打包(Electron + Capacitor)链路已通。

## 七、建议的收敛路线(先减后加)

1. **定架构、做减法**:二选一后端(建议保留在跑的 `server`,或整体迁到 NestJS `services/api`,但只能留一套),删除另一套 + 多余 admin + 无关配置,统一到一份 Prisma schema。
2. **统一品牌**:SmartLearn / LexiStrike 定一个,改齐 repo / package / DB / 文档。
3. **把 AI 从文档变成代码**:先落 P0 最小闭环——在 `ai-engine` 接 1 个 OpenAI 兼容供应商(先 GLM)跑通「答疑 Chat + bge-m3 embedding + 一个向量库」,再按《全景方案》优先级铺开。当前 ai-engine 没有任何 LLM 依赖,等于从零开始。
4. **数据出源码**:大词表 / seed 移出 `src`,改数据文件 + 迁移脚本。
5. **补测试 + 收紧安全**:核心算法(mastery / review)先上单测;生产禁用弱默认密钥、收紧 CORS、不外暴露 5432。

<aside>
🎯

**优先级一句话**:先「合体收敛」(删掉孤儿的一套后端与前端、统一 schema 与品牌),再「补真 AI」(把全景方案的 P0 最小闭环真正写进 ai-engine)。在这两件事完成前,「一次上线不迭代」不现实。

</aside>