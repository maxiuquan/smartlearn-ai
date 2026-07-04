# SmartLearn AI —— 第三轮全面复审(重点:游戏化模块)

<aside>
🎯

**一句话:** 上一轮的 4 个问题(删 NestJS 残留、修 `offline_mode`、注释 Milvus、收紧 DEBUG/CORS)已**全部确认修复** ✅。但本轮针对你选中的**游戏化模块**深挖,发现一个真正卡上线的问题:**25 款游戏有配置、有策划、有出题逻辑,但没有前端、且出题接口没挂载**——学生现在无处可玩。另外 ai-engine 内部还残留两套目录/两个 `main.py`。

</aside>

> 基于最新提交 [`3937158`](https://github.com/maxiuquan/smartlearn-ai/commit/3937158)(7/4 21:15),`main` 与 `master` 已同步到同一提交 ✅(上轮提的分支分叉已解决)。
> 

## 一、✅ 本轮已确认的修复(commit 3937158)

逐条看了实际代码:

| 上轮遗留项 | 状态 | 证据 |
| --- | --- | --- |
| P0 `services/api` 双技术栈混杂 | ✅ 已解决 | 删除 63 个 NestJS/Prisma 文件;根目录已无 `package.json`/`prisma`;`services/` 现在只剩 `api/`(Python FastAPI+SQLAlchemy+Alembic)与 `ai-engine/` |
| P1 `offline_mode` 逻辑 bug | ✅ 已修 | `config.py`:`return not self.has_any_provider`,不再只看 `OPENAI_API_KEY` |
| P1 Milvus 部署了不用 | ✅ 已处理 | `docker-compose.yml` 注释掉 etcd/minio/milvus,初期用 inmemory,省 3~4GB |
| P2 ai-engine 宽松默认 | ✅ 已收紧 | `DEBUG=False`;`CORS_ORIGINS` 改为 [localhost](http://localhost) 白名单(3000/3001/5173) |

---

## 二、🎮 游戏化模块专项审查(你选中的部分)

我把这块拆成四层来看:

### ✅ 策划 & 配置层 —— 优秀

`data/games/games-config.json`(32KB)定义得非常专业,25 款齐备:

| 分类 | 数量 | 示例 |
| --- | --- | --- |
| 英语单词/词汇 | 16 | 词义消消乐、拼写蜂、词根词缀树、语境速填、长难句拆解、词汇PK擂、单词接龙、同反义连线… |
| 数学 | 4 | — |
| 跨科目/社交 | 5 | — |

每款都有 `learning_goal`/`core_mechanisms`/`data_sources`/`difficulty_levels`/`session`(时长、生命、连击)/`rewards`(XP/金币/倍率)/`props`(道具)/`leaderboard`/`tech_notes`/`business_value`/`stage`。这一层可以直接指导开发。

### ✅ 单词进度统一 —— 数据源已统一

你之前特别要求「16 款英语游戏共享同一套单词进度」——配置里多款游戏的 `data_sources` 都指向同一批 `vocabulary/kaoyan-words.json`、`roots.json`、`synonyms.json`,数据源是统一的 ✅。(但进度的真正统一靠后端 `user_word_progress` 表/接口,这属 api 层,建议你自查是否已建)

### 🔴 前端层 —— 缺失(卡上线的头号问题)

`apps/` 下**只有 `admin/`**(管理后台),页面只有 `user`/`word`/`workbook`,**没有任何游戏前端组件,也没有学生端 App**。

配置里 `tech_notes` 写的「用 Canvas/DOM 实现拖拽」「D3.js 树图」「TTS 发音」——这些都是**待实现的说明,不是实现本身**。根目录有 `capacitor.config`(想打包成 App),但没有被打包的学生端代码。

> **结论:** 25 款游戏目前 = 策划文档 + JSON 配置 + 后端出题逻辑,**玩家真正交互的界面一个都没写**。这是距离“上线”最大的缺口。
> 

### 🟠 后端出题层 —— 写了但没挂载

`services/ai-engine/services/word_games_service.py`(18KB)出题逻辑体量很大,但它在旧的 `ai-engine/routers/word_games_router.py` 里——而 **实际启动的 `app/main.py` 只 `include_router` 了 chat/rag/study/media/moderation/prompt 六个,根本没挂载旧的 `routers/`**。也就是说单词游戏出题接口目前根本调不到——就算前端做好了也拿不到题。详见下一节 P1。

---

## 三、🔴 其他全面发现

### 🟠 P1 —— ai-engine 内部两套目录 / 两个 `main.py`,9 个 service 成孤儿

ai-engine 里共存两套结构:

- **新栈(真正在跑)**:`ai-engine/app/`——`app/main.py` + `app/routers`(chat/rag/study/media/moderation/prompt)+ `app/services`(llm_service/rag_service)+ `app/providers`。
- **旧栈(孤儿)**:`ai-engine/main.py`(4.7KB)+ `ai-engine/routers/`(ability_assessment/daily_planning/forgetting_curve/grading/handwriting/knowledge_graph/learning_path/recommendation/**word_games**)+ `ai-engine/services/`(9 个,包括 grading 19.6KB、word_games 18KB)+ `ai-engine/models/`(9 个)。

问题:`app/main.py` 完全没挂载旧 `routers/` 那一套。所以**能力评估、遗忘曲线、作业批改、推荐、单词游戏出题这 9 块逻辑虽然写了且体量很大,却没被任何 FastAPI 应用挂载暴露**,等于死代码。

> **建议:** 二选一——把旧 `routers/` 迁进 `app/routers/` 并在 `app/main.py` 统一 `include_router`;或删掉旧栈只保留真用的。尤其单词游戏出题必须挂载,否则游戏模块无法闭环。
> 

### 🟡 P2 —— 大数据文件随仓库提交,建议 Git LFS

`data/questions/math-full.json` 3.6MB、`english-full.json` 2.2MB。这是你明确定下的「真题开发时写入」,属有意为之,**不算问题**。但 5.8MB+ 的 JSON 直接进 git,以后仓库会越来越重、clone 变慢——建议改用 **Git LFS** 管理。提醒而非硬伤。

### 🔎 需你自查

- `services/api` 是否已有**统一的单词进度表/接口**(支撑 16 款英语游戏共享进度);以及游戏得分/排行榜是否有写入接口。
- api 层与前端仍无自动化测试(测试目前只覆盖 ai-engine)。

---

## 四、👍 值得肯定

- **上轮问题收尾彻底**——不是打补丁,而是真删掉 63 个残留文件、真修逻辑 bug。
- **游戏配置层专业度很高**——game-config 把学习目标/机制/奖励/数据源/技术实现要点都想清楚了,前端照着写即可。
- **分支已同步**——`main`/`master` 现在指向同一提交,上轮提的分叉问题解决了。

<aside>
🚀

**距上线还差两块硬骨头,优先级排序:** ①(P0)写 25 款游戏的**学生端前端**(至少先做几款主力词汇游戏跑通闭环)→ ②(P1)把 ai-engine 旧 `routers/`(尤其单词游戏出题)挂载到 `app`,消除双 `main.py` → ③确认 api 有统一单词进度/排行榜接口 → ④(P2)大数据文件转 Git LFS。前两项不做,游戏模块无法真正上线。

</aside>