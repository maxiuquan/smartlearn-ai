# SmartLearn AI —— 第二轮代码复审(master 分支整改验收)

<aside>
🎯

**总结:这轮是真干活,不是改文档。** 上一轮我提的 P0/P1 大部分已**真实落地整改**——AI 从「0% 只有文档」变成「真调用 LLM/RAG」,三套后端收敛成一套,安全默认值也补齐了。距离「能上线」已经很近。仍有 4 个需要收尾的点:`services/api` 里 Python 与 NestJS **两套技术栈混在一起**、Milvus **部署了但代码没接**、`config.py` 的 **offline 判断有逻辑 bug**、模型名默认值需在 `.env` 覆写。

</aside>

## 一、先说清楚:你的代码在 `master`,不在 `main`

这是我第一次没找到「新提交」的原因——两个分支分叉了:

| 分支 | 最新提交 | 时间 | 状态 |
| --- | --- | --- | --- |
| `main` | `241e217` | 7/3 07:34 | 旧代码(我上一轮审的) |
| `master` | `45748b5` | 7/4 08:14 | **你的整改在这里** |

`master` 上两个新提交:

- [`c096e64`](https://github.com/maxiuquan/smartlearn-ai/commit/c096e64)(7/3)清理旧 LexiStrike + 重写部署文档 + 加多供应商/向量库配置。
- [`45748b5`](https://github.com/maxiuquan/smartlearn-ai/commit/45748b5)(7/4,最新)游戏读配置全量化 + 补 70+ 测试 + 坐实 AI 真实调用。

<aside>
⚠️

**上线前务必处理:** `main` 还停在旧代码。请把 `master` 合并回 `main`(或把默认分支切成 `master`),否则协作者、CI/CD、`git clone` 默认拉到的都是那套被你废弃的旧代码。

</aside>

---

## 二、✅ 已验证的整改(逐条对照上一轮报告)

每条都看了实际代码,不是只信 commit message。

| 上轮问题 | 现状 | 证据(master 分支) |
| --- | --- | --- |
| 三套后端并存、只有一套接线 | ✅ 已收敛 | `c096e64` 删除 `client/`、Express `server/`、根 `admin/`、`electron/`、冗余 Dockerfile/脚本 |
| **AI 能力 0% 落地** | ✅ **已真实实现** | `requirements.txt` 新增 `openai==1.50.0`/`langchain`/`pymilvus`/`redis`/`httpx`;`openai_compat.py` 真调 `client.chat.completions.create()` 与 `client.embeddings.create()` |
| 多供应商路由(只在文档) | ✅ 已实现 | `providers/router.py` 的 `ROUTE_CONFIG`:数学→DeepSeek、英语/默认→GLM、嵌入/TTS/STT→SiliconFlow、图像→CogView(备 SiliconFlow)、审核→GLM,带主备切换+统计 |
| RAG 答疑(只在文档) | ✅ 已实现 | `services/rag_service.py` 真走 `router.generate_embeddings()`  • numpy 余弦检索,从 `data/` 加载知识点与题目 |
| 数据被当源码提交(990KB+214KB) | ✅ 已解决 | 随 `server/` 一起删除;改为 `data/*.json`  • `scripts/import_*.py` 导入,新 `seed.ts` 仅 3KB |
| 安全弱默认(密码/端口/CORS) | ✅ 已加固 | `docker-compose.yml`:DB/Redis/Milvus **端口不再暴露宿主机**;`POSTGRES_PASSWORD`/`REDIS_PASSWORD`/`JWT_SECRET`/MinIO 密钥全部 `${VAR:?err}` **强制设置**;Redis 加密码;加资源限制;CORS 默认 [localhost](http://localhost) 而非 `*` |
| 25 款游戏未落地(只 3.9KB) | ✅ 后端已补 | `games.py` 从写死 6 款改为读 `games-config.json` 全 25 款;`schemas/games.py` 扩展字段(category/learning_goal/stage 等) |
| 缺测试 | 🟡 部分 | `ai-engine/tests/` 新增 `test_router`/`test_llm_service`/`test_rag_service`/`conftest`(70+ 用例);但 api 层与前端仍无测试 |

---

## 三、🔴 仍需收尾的问题(新发现 / 遗留)

### 🔴 P0 —— `services/api` 里混着两套技术栈

`services/api/` 目录同时存在:

- **Python 栈(实际在跑)**:`app/models`、`app/schemas`、`app/tasks`(Celery)、`alembic/`、`requirements.txt`。docker-compose 的 `api` 服务跑的是 `celery -A app.celery_app`,即这套。
- **NestJS 栈(死代码残留)**:`nest-cli.json`、`package.json`、`src/modules/...`,以及 **`prisma/schema.prisma`(22KB)** + `prisma/seed.ts`。

也就是上一轮「两份 Prisma schema 冲突」变形成了:api 实际用 **SQLAlchemy + Alembic**,却还留着一整套 **Prisma + NestJS** 没删。

> **建议:** 二选一(既然实际跑 Python,就删掉 `nest-cli.json`/`package.json`/`src/modules`/`prisma/`)。否则新人一进来会被两套 ORM、两套入口搞晕,CI 也可能误构建。
> 

### 🟠 P1 —— Milvus 部署了,但代码根本没用

compose 起了 `milvus` + `minio` + `etcd` 一整套向量库依赖(吃 3~4GB 内存),但:

- `config.py` 默认 `VECTOR_STORE_TYPE=inmemory`,compose 也传的 `inmemory`;
- `rag_service.py` 全程用 numpy 内存数组做余弦检索,**从不 import pymilvus**。

> **建议:** 要么把 RAG 真接到 Milvus(数据量大了内存方案扛不住),要么上线初期先别起 milvus/minio/etcd 这三个容器,省一大半内存。别「起了不用」。
> 

### 🟠 P1 —— `config.py` 的 offline 判断有逻辑 bug

```python
@property
def offline_mode(self) -> bool:
    return not self.OPENAI_API_KEY   # ← 只看 OPENAI_API_KEY

@property
def has_any_provider(self) -> bool:
    return bool(self.OPENAI_API_KEY or self.GLM_API_KEY or ...)
```

你实际用 GLM/DeepSeek,不一定配 `OPENAI_API_KEY`。这种情况下 `offline_mode=True`(误判离线)而 `has_any_provider=True`(有供应商),两个判断互相打架。RAG 用的是 `has_any_provider`(所以会走在线,没事),但任何地方一旦用 `settings.offline_mode` 就会错误地进模拟模式。

> **建议:** 把 `offline_mode` 改成 `return not self.has_any_provider`,统一口径。
> 

### 🟡 P2 —— ai-engine 应用层仍是宽松默认

`config.py` 默认 `DEBUG=True`、`CORS_ORIGINS=["*"]`,而 compose 的 `ai-engine` 服务没传 `CORS_ORIGINS`/`DEBUG`,所以线上仍是 `*` + DEBUG。db/redis 那层安全做得很好,但这层漏了。→ 生产环境显式收紧。

### 🟡 P2 —— 模型名默认值与你的选型有出入

| 配置项 | 代码默认 | 你的选型 | 处理 |
| --- | --- | --- | --- |
| `GLM_MODEL` | `glm-4-flash` | GLM-4.7 Flash | `.env` 覆写确认 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | DeepSeek V4 Flash(最高端) | `.env` 覆写确认 |
| 嵌入 | `BAAI/bge-m3` | ✅ 一致 | — |
| 图像 | `cogview-3-flash` | ✅ 一致 | — |

### 🟡 P2/P3 —— 约定可后置的未落地项

- **Agnes(多模态/视频生成)**、**Gemini 2.5 离线内容** 尚未接入(这两项之前就说可后置)。
- **内容审核** 目前路由到 GLM 初筛,够用;要更严可再加国内第三方。

### 🔎 需要你自查(我抓取受限没能覆盖)

- **前端 25 款游戏是否每款真的可玩**——我只验证了后端 `games-config.json` + schema 层,没逐个看前端交互实现。
- **api 层与前端无自动化测试**——测试目前只覆盖 ai-engine。

---

## 四、👍 值得肯定

- **是改代码,不是改文档。** 上一轮我最担心的「AI 停留在 PPT」,这次实打实写了 provider 适配层 + 路由 + 主备切换 + 成本/延迟统计,结构干净、可扩展。
- **OpenAI 兼容封装做得对**——一个 `OpenAICompatProvider` 适配任意兼容供应商,离线自动回退 mock,健康检查齐全。
- **安全默认值处理专业**——`${VAR:?err}` 强制必填、内部端口不暴露,是正确的生产姿势。
- **架构收敛果断**——敢删旧 LexiStrike 一整套,比留着「以后再说」强得多。

<aside>
🚀

**离上线只差临门一脚。** 按优先级收尾:①(P0)清掉 `services/api` 的 NestJS/Prisma 残留,只留 Python 一套 → ②(P1)决定 Milvus 接还是先撤,并修 `offline_mode` 逻辑 → ③(P2)`.env` 填对模型名与密钥、收紧 ai-engine 的 CORS/DEBUG → ④ 合并 `master` 回 `main`。做完这几步,「一次上线」就现实了。

</aside>