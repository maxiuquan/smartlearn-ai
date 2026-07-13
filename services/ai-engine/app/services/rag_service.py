"""
RAG (Retrieval Augmented Generation) 服务

从知识库中检索相关知识内容和相似题目，为 LLM 提供上下文增强。
通过多供应商 AI 路由层获取嵌入向量（全局统一使用 SiliconFlow BAAI/bge-m3）。

嵌入方法为 async（通过路由层异步调用），检索方法也为 async。
初始化方法保持同步，内部使用 asyncio.run() 调用异步嵌入。

## P1-02 整改（R2 报告）
- 批处理 embedding：按 Provider 上限分块（默认 64 条/批），带指数退避、并发限制（信号量）、失败重试（最多 3 次）
- Corpus manifest（语料清单）：记录文件 hash、数据版本、chunk 数、embedding 模型、维度、索引构建时间
- Readiness 检查（就绪门禁）：is_ready() 基础检查 + check_readiness() 黄金样本验证
- 引用可见性：检索结果增加 source_id / data_version / embedding_model 字段
- 离线评测框架：evaluate() 输出 Recall@K / MRR / 引用正确率 / 无依据回答率
"""

import asyncio
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np

# 添加项目根目录到路径，以便导入 config
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import settings
from app.providers.router import get_router


# ─── 数据路径 ───────────────────────────────────────────────
# P0-05: 使用环境变量强制指定数据路径，禁止从 parents[n] 猜测
# Docker 环境: /app/data；开发环境: 项目根目录/data
_DATA_DIR_ENV = os.environ.get("RAG_DATA_DIR", "")
if _DATA_DIR_ENV:
    DATA_DIR = Path(_DATA_DIR_ENV)
else:
    # 回退: 从当前文件向上查找 data 目录（开发环境）
    _project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    DATA_DIR = _project_root / "data"
KNOWLEDGE_POINTS_DIR = DATA_DIR / "knowledge-points"
QUESTIONS_DIR = DATA_DIR / "questions"


# ─── P1-02: 批处理与重试常量 ────────────────────────────────
# 批处理默认大小（SiliconFlow bge-m3 通常支持 <=64 条/批）
_DEFAULT_EMBED_BATCH_SIZE: int = 64
# 并发批次限制（asyncio.Semaphore）
_DEFAULT_EMBED_CONCURRENCY: int = 4
# 指数退避参数：base_delay=1s, max_delay=30s, max_retries=3
_RETRY_BASE_DELAY: float = 1.0
_RETRY_MAX_DELAY: float = 30.0
_RETRY_MAX_ATTEMPTS: int = 3


class RAGService:
    """RAG 知识检索服务"""

    def __init__(self) -> None:
        self._knowledge_chunks: list[dict[str, Any]] = []
        self._question_chunks: list[dict[str, Any]] = []
        self._knowledge_embeddings: np.ndarray | None = None
        self._question_embeddings: np.ndarray | None = None
        self._embedding_dim: int = settings.EMBEDDING_DIMENSIONS
        self._initialized: bool = False
        self._router = get_router()
        # P0-03: 防止并发首请求触发多次构建
        self._init_lock: asyncio.Lock = asyncio.Lock()

        # P1-02: 批处理 embedding 配置
        self._embed_batch_size: int = _DEFAULT_EMBED_BATCH_SIZE
        self._embed_concurrency: int = _DEFAULT_EMBED_CONCURRENCY

        # P1-02: 语料清单（corpus manifest）
        self._data_version: str = ""
        self._corpus_manifest: dict[str, Any] | None = None
        self._index_built_at: float = 0.0

        # P1-02: 黄金检索样本（用于就绪门禁与离线评测）
        # 硬编码标准中文知识查询，验证检索结果非空
        self._golden_samples: list[dict[str, Any]] = [
            {"query": "什么是极限", "expected_keywords": ["极限", "limit"]},
            {"query": "导数的定义", "expected_keywords": ["导数", "derivative"]},
            {"query": "什么是连续函数", "expected_keywords": ["连续", "continuous"]},
            {"query": "什么是积分", "expected_keywords": ["积分", "integral"]},
            {"query": "什么是微积分基本定理", "expected_keywords": ["微积分", "基本定理"]},
        ]

    # ── 初始化 ──────────────────────────────────────────────

    async def initialize(self) -> None:
        """加载所有知识数据并构建索引（异步）

        P0-05: 重写为真正的 async 初始化，禁止在 async 上下文中调用 asyncio.run()。
        P0-03: 加 asyncio.Lock 防止并发首请求触发多次构建。
        P1-02: 完成后构建 corpus manifest（语料清单）。
        """
        if self._initialized:
            return
        async with self._init_lock:
            # double-check：拿到锁后再次确认（其他并发任务可能已完成初始化）
            if self._initialized:
                return
            # P0-05: 启动时打印规范化路径和语料数量摘要
            print(f"   RAG DATA_DIR = {DATA_DIR}")
            print(f"   知识点目录: {KNOWLEDGE_POINTS_DIR} (exists={KNOWLEDGE_POINTS_DIR.exists()})")
            print(f"   题目目录: {QUESTIONS_DIR} (exists={QUESTIONS_DIR.exists()})")
            self._load_knowledge_points()
            self._load_questions()
            await self._build_embeddings()
            # P1-02: 构建语料清单
            self._index_built_at = time.time()
            self._data_version = self._compute_data_version()
            self._corpus_manifest = self._build_manifest()
            self._initialized = True
            print(
                f"RAG 服务已初始化: {len(self._knowledge_chunks)} 个知识点, "
                f"{len(self._question_chunks)} 道题目 (data_version={self._data_version})"
            )
            if len(self._knowledge_chunks) == 0 and len(self._question_chunks) == 0:
                print("⚠️  警告: RAG 语料为 0，请检查 DATA_DIR 路径配置")

    def _load_knowledge_points(self) -> None:
        """从 JSON 文件加载知识点，展平为 chunks"""
        self._knowledge_chunks = []
        if not KNOWLEDGE_POINTS_DIR.exists():
            print(f"警告: 知识点目录不存在: {KNOWLEDGE_POINTS_DIR}")
            return
        for filename in os.listdir(KNOWLEDGE_POINTS_DIR):
            if not filename.endswith(".json"):
                continue
            filepath = KNOWLEDGE_POINTS_DIR / filename
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                continue

            subject = data.get("subject", "")
            subject_code = data.get("subject_code", "")
            for chapter in data.get("chapters", []):
                chapter_name = chapter.get("name", "")
                for section in chapter.get("sections", []):
                    section_name = section.get("name", "")
                    for point in section.get("points", []):
                        chunk = {
                            "id": point.get("id", ""),
                            "name": point.get("name", ""),
                            "description": point.get("description", ""),
                            "keywords": point.get("keywords", []),
                            "difficulty": point.get("difficulty", 1),
                            "importance": point.get("importance", 1),
                            "subject": subject,
                            "subject_code": subject_code,
                            "chapter": chapter_name,
                            "section": section_name,
                            "text": (
                                f"{subject} - {chapter_name} - {section_name} - "
                                f"{point.get('name', '')}: {point.get('description', '')}"
                            ),
                        }
                        self._knowledge_chunks.append(chunk)

    def _load_questions(self) -> None:
        """从 JSON 文件加载题目"""
        self._question_chunks = []
        if not QUESTIONS_DIR.exists():
            print(f"警告: 题目目录不存在: {QUESTIONS_DIR}")
            return
        for filename in os.listdir(QUESTIONS_DIR):
            if not filename.endswith(".json"):
                continue
            filepath = QUESTIONS_DIR / filename
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                continue

            # 兼容两种格式：数组格式 (math-full.json) 和对象格式 (english-full.json)
            if isinstance(data, list):
                questions = data
                subject = ""
            elif isinstance(data, dict):
                subject = data.get("subject", "")
                questions = data.get("questions", [])
            else:
                continue

            if not isinstance(questions, list):
                continue

            for q in questions:
                if not isinstance(q, dict):
                    continue
                chunk = {
                    "id": q.get("id", ""),
                    "type": q.get("type", ""),
                    "difficulty": q.get("difficulty", 1),
                    "title": q.get("title", ""),
                    "content": q.get("content", ""),
                    "answer": q.get("answer", ""),
                    "solution": q.get("solution", ""),
                    "tags": q.get("tags", []),
                    "knowledge_points": q.get("knowledge_points", []),
                    "subject": subject,
                    "text": (
                        f"{q.get('title', '')} {q.get('content', '')} "
                        f"{' '.join(q.get('tags', []))}"
                    ),
                }
                self._question_chunks.append(chunk)

    async def _build_embeddings(self) -> None:
        """构建文本嵌入向量（异步）

        P0-05: 重写为真正的 async 方法，禁止使用 asyncio.run()。
        P1-02: 通过 _embed_texts 批处理生成嵌入向量。
        """
        use_ai = settings.has_any_provider

        # 构建知识点嵌入
        if self._knowledge_chunks:
            if use_ai:
                self._knowledge_embeddings = await self._embed_texts(
                    [c["text"] for c in self._knowledge_chunks]
                )
            else:
                self._knowledge_embeddings = self._simple_keyword_embed(
                    [c["text"] for c in self._knowledge_chunks],
                    [c.get("keywords", []) for c in self._knowledge_chunks],
                )
        else:
            self._knowledge_embeddings = np.array([]).reshape(0, self._embedding_dim)

        # 构建题目嵌入
        if self._question_chunks:
            if use_ai:
                self._question_embeddings = await self._embed_texts(
                    [c["text"] for c in self._question_chunks]
                )
            else:
                self._question_embeddings = self._simple_keyword_embed(
                    [c["text"] for c in self._question_chunks],
                    [c.get("tags", []) for c in self._question_chunks],
                )
        else:
            self._question_embeddings = np.array([]).reshape(0, self._embedding_dim)

    # ── 嵌入方法（P1-02: 批处理 + 重试 + 并发限制） ───────────

    async def _embed_texts(self, texts: list[str]) -> np.ndarray:
        """异步：使用路由层生成文本嵌入（批处理 + 指数退避重试 + 并发限制）

        P1-02: 按 Provider 上限分块（默认 64 条/批），使用 asyncio.Semaphore
        限制并发批次数；单批失败按指数退避重试（base=1s, max=30s, retries=3）。

        Args:
            texts: 待嵌入的文本列表

        Returns:
            np.ndarray: 嵌入向量矩阵，shape=(len(texts), embedding_dim)
        """
        if not texts:
            return np.array([]).reshape(0, self._embedding_dim)

        # 离线模式直接走关键词向量（保持原有回退语义）
        if not settings.has_any_provider:
            return self._simple_keyword_embed(texts, [[] for _ in texts])

        # 按批大小切片
        batch_size = max(1, self._embed_batch_size)
        batches: list[list[str]] = [
            texts[i : i + batch_size] for i in range(0, len(texts), batch_size)
        ]

        # 并发信号量：限制同时进行的批次数
        semaphore = asyncio.Semaphore(max(1, self._embed_concurrency))

        # 并发执行所有批次
        tasks = [self._embed_batch(batch, semaphore) for batch in batches]
        batch_results: list[np.ndarray] = await asyncio.gather(*tasks)

        # 沿 axis=0 拼接所有批次的嵌入矩阵
        return np.concatenate(batch_results, axis=0).astype(np.float32)

    async def _embed_batch(
        self,
        texts: list[str],
        semaphore: asyncio.Semaphore,
    ) -> np.ndarray:
        """处理单个 embedding 批次，带指数退避重试和并发限制

        P1-02: 单批调用路由层 generate_embeddings；失败后按指数退避重试，
        最多 3 次重试（共 4 次尝试）；全部失败则回退到关键词向量。

        Args:
            texts: 本批文本列表
            semaphore: 并发限制信号量

        Returns:
            np.ndarray: 本批嵌入矩阵，shape=(len(texts), embedding_dim)
        """
        last_exc: Exception | None = None
        async with semaphore:
            # 共 1 + _RETRY_MAX_ATTEMPTS 次尝试（首次 + 3 次重试）
            for attempt in range(_RETRY_MAX_ATTEMPTS + 1):
                try:
                    embeddings = await self._router.generate_embeddings(texts)
                    return np.array(embeddings, dtype=np.float32)
                except Exception as e:
                    last_exc = e
                    if attempt < _RETRY_MAX_ATTEMPTS:
                        # 指数退避：1s, 2s, 4s ... 不超过 30s
                        delay = min(
                            _RETRY_BASE_DELAY * (2 ** attempt),
                            _RETRY_MAX_DELAY,
                        )
                        print(
                            f"⚠️  批处理 embedding 失败 (尝试 {attempt + 1}/"
                            f"{_RETRY_MAX_ATTEMPTS + 1})，{delay:.1f}s 后重试: {e}"
                        )
                        await asyncio.sleep(delay)
            # 所有重试均失败 -> 回退到关键词向量
            print(
                f"⚠️  批处理 embedding 全部 {_RETRY_MAX_ATTEMPTS + 1} 次尝试失败，"
                f"回退到关键词向量: {last_exc}"
            )
            return self._simple_keyword_embed(texts, [[] for _ in texts])

    def _simple_keyword_embed(
        self, texts: list[str], keywords_list: list[list[str]]
    ) -> np.ndarray:
        """离线模式：基于关键词匹配的简单向量表示（TF-IDF 风格）"""
        # 收集所有唯一关键词构建词汇表
        vocab: dict[str, int] = {}
        for kw_list in keywords_list:
            for kw in kw_list:
                if kw not in vocab:
                    vocab[kw] = len(vocab)

        if not vocab:
            # 如果没有任何关键词，使用字符级简单哈希
            return self._char_hash_embed(texts)

        dim = max(len(vocab), self._embedding_dim)
        vectors = np.zeros((len(texts), dim), dtype=np.float32)
        for i, (text, kw_list) in enumerate(zip(texts, keywords_list)):
            for kw in kw_list:
                if kw in vocab:
                    vectors[i, vocab[kw]] = 1.0
            # 也加入文本中的词匹配
            text_lower = text.lower()
            for kw, idx in vocab.items():
                if kw.lower() in text_lower:
                    vectors[i, idx] = max(vectors[i, idx], 0.5)
        return vectors

    def _char_hash_embed(self, texts: list[str]) -> np.ndarray:
        """基于字符哈希的简单嵌入（无关键词时的回退）

        P0-05: 使用 hashlib 确定性哈希替代 Python 内置 hash()，
        避免跨进程 hash 随机化导致结果不稳定。
        """
        import hashlib
        dim = self._embedding_dim
        vectors = np.zeros((len(texts), dim), dtype=np.float32)
        for i, text in enumerate(texts):
            for ch in text:
                # 使用 hashlib.md5 生成确定性哈希值
                h = int(hashlib.md5(ch.encode("utf-8")).hexdigest(), 16)
                idx = h % dim
                vectors[i, idx] += 1.0
            norm = np.linalg.norm(vectors[i])
            if norm > 0:
                vectors[i] /= norm
        return vectors

    async def _embed_query(self, query: str) -> np.ndarray:
        """异步：为查询文本生成嵌入向量（通过路由层）"""
        try:
            embedding = await self._router.generate_embedding(query)
            return np.array(embedding, dtype=np.float32)
        except Exception as e:
            print(f"⚠️  查询嵌入生成失败，回退到关键词向量: {e}")
        # 回退到简单关键词向量
        return self._simple_keyword_embed([query], [[]])[0]

    # ── 语料清单（Corpus Manifest，P1-02） ───────────────────

    def _compute_data_version(self) -> str:
        """根据所有数据文件内容计算数据版本 hash（md5 前 12 位）

        用于在 manifest 中标记数据版本，便于检索结果引用与缓存失效。
        """
        h = hashlib.md5()
        for dir_path in [KNOWLEDGE_POINTS_DIR, QUESTIONS_DIR]:
            if not dir_path.exists():
                continue
            for filename in sorted(os.listdir(dir_path)):
                if not filename.endswith(".json"):
                    continue
                filepath = dir_path / filename
                try:
                    with open(filepath, "rb") as f:
                        h.update(f.read())
                except OSError:
                    continue
        return h.hexdigest()[:12]

    def _collect_file_hashes(self) -> list[dict[str, str]]:
        """收集所有数据文件的 md5 hash 列表"""
        file_hashes: list[dict[str, str]] = []
        for dir_path in [KNOWLEDGE_POINTS_DIR, QUESTIONS_DIR]:
            if not dir_path.exists():
                continue
            for filename in sorted(os.listdir(dir_path)):
                if not filename.endswith(".json"):
                    continue
                filepath = dir_path / filename
                try:
                    with open(filepath, "rb") as f:
                        file_hash = hashlib.md5(f.read()).hexdigest()
                    file_hashes.append({"file": str(filepath), "md5": file_hash})
                except OSError:
                    continue
        return file_hashes

    def _embedding_model_name(self) -> str:
        """获取当前使用的 embedding 模型名

        路由层将 embedding 能力固定路由到 SiliconFlow；离线模式返回标识。
        """
        if settings.has_any_provider:
            if settings.SILICONFLOW_API_KEY:
                return settings.SILICONFLOW_EMBEDDING_MODEL
            return settings.EMBEDDING_MODEL_NAME
        return "offline-keyword-embedding"

    def _build_manifest(self) -> dict[str, Any]:
        """构建语料清单（corpus manifest）

        包含：文件 hash、数据版本、chunk 数、embedding 模型、维度、索引构建时间。
        """
        knowledge_dim = (
            int(self._knowledge_embeddings.shape[1])
            if self._knowledge_embeddings is not None and self._knowledge_embeddings.size > 0
            else 0
        )
        question_dim = (
            int(self._question_embeddings.shape[1])
            if self._question_embeddings is not None and self._question_embeddings.size > 0
            else 0
        )
        return {
            "data_version": self._data_version,
            "knowledge_chunk_count": len(self._knowledge_chunks),
            "question_chunk_count": len(self._question_chunks),
            "total_chunk_count": len(self._knowledge_chunks) + len(self._question_chunks),
            "embedding_model": self._embedding_model_name(),
            "embedding_dim": self._embedding_dim,
            "knowledge_embedding_dim": knowledge_dim,
            "question_embedding_dim": question_dim,
            "file_hashes": self._collect_file_hashes(),
            "index_built_at": self._index_built_at,
            "batch_size": self._embed_batch_size,
            "concurrency": self._embed_concurrency,
        }

    def get_manifest(self) -> dict[str, Any]:
        """获取语料清单（corpus manifest）

        若尚未初始化，返回空清单（total_chunk_count=0）。
        """
        if self._corpus_manifest is not None:
            return self._corpus_manifest
        # 未初始化时返回空清单
        return {
            "data_version": "",
            "knowledge_chunk_count": 0,
            "question_chunk_count": 0,
            "total_chunk_count": 0,
            "embedding_model": self._embedding_model_name(),
            "embedding_dim": self._embedding_dim,
            "knowledge_embedding_dim": 0,
            "question_embedding_dim": 0,
            "file_hashes": [],
            "index_built_at": 0.0,
            "batch_size": self._embed_batch_size,
            "concurrency": self._embed_concurrency,
        }

    # ── 就绪门禁（Readiness，P1-02） ────────────────────────

    def is_ready(self) -> bool:
        """基础就绪检查（同步）

        检查项：
        - initialized=True
        - 语料数 > 0（知识点或题目至少一项非空）
        - embedding 维度匹配预期（embedding_dim 与配置一致）

        Returns:
            bool: 是否通过基础就绪检查
        """
        if not self._initialized:
            return False
        if len(self._knowledge_chunks) == 0 and len(self._question_chunks) == 0:
            return False
        # embedding 维度匹配（若存在）
        if (
            self._knowledge_embeddings is not None
            and self._knowledge_embeddings.size > 0
            and self._knowledge_embeddings.shape[1] != self._embedding_dim
        ):
            return False
        if (
            self._question_embeddings is not None
            and self._question_embeddings.size > 0
            and self._question_embeddings.shape[1] != self._embedding_dim
        ):
            return False
        return True

    async def check_readiness(self) -> dict[str, Any]:
        """详细就绪状态检查（异步，含黄金样本验证）

        返回包含以下字段的 dict：
        - initialized: 是否已初始化
        - knowledge_chunks / question_chunks: 语料数量
        - embedding_dim: 配置的维度
        - knowledge_embedding_dim / question_embedding_dim: 实际维度
        - is_ready: 基础就绪门禁结果
        - golden_samples: 黄金样本检索结果（验证检索结果非空）
        - golden_samples_passed: 黄金样本是否全部通过
        - overall_ready: 基础就绪 AND 黄金样本通过

        Returns:
            dict[str, Any]: 详细就绪状态
        """
        if not self._initialized:
            await self.initialize()

        knowledge_dim = (
            int(self._knowledge_embeddings.shape[1])
            if self._knowledge_embeddings is not None
            and self._knowledge_embeddings.size > 0
            else 0
        )
        question_dim = (
            int(self._question_embeddings.shape[1])
            if self._question_embeddings is not None
            and self._question_embeddings.size > 0
            else 0
        )

        checks: dict[str, Any] = {
            "initialized": self._initialized,
            "knowledge_chunks": len(self._knowledge_chunks),
            "question_chunks": len(self._question_chunks),
            "embedding_dim": self._embedding_dim,
            "knowledge_embedding_dim": knowledge_dim,
            "question_embedding_dim": question_dim,
            "embedding_model": self._embedding_model_name(),
            "data_version": self._data_version,
        }

        # 基础就绪门禁
        checks["is_ready"] = self.is_ready()

        # 黄金样本验证：检索结果非空
        golden_results: list[dict[str, Any]] = []
        golden_all_passed = True
        for sample in self._golden_samples:
            query = sample["query"]
            try:
                results = await self.retrieve_context(query, top_k=1)
                passed = len(results) > 0
                golden_results.append(
                    {
                        "query": query,
                        "expected_keywords": sample.get("expected_keywords", []),
                        "passed": passed,
                        "hit_count": len(results),
                        "top_similarity": (
                            results[0].get("similarity", 0.0) if results else 0.0
                        ),
                    }
                )
                if not passed:
                    golden_all_passed = False
            except Exception as e:
                golden_results.append(
                    {
                        "query": query,
                        "expected_keywords": sample.get("expected_keywords", []),
                        "passed": False,
                        "hit_count": 0,
                        "error": f"{type(e).__name__}: {e}",
                    }
                )
                golden_all_passed = False

        checks["golden_samples"] = golden_results
        checks["golden_samples_passed"] = golden_all_passed
        checks["overall_ready"] = bool(checks["is_ready"]) and golden_all_passed
        return checks

    # ── 检索方法 ────────────────────────────────────────────

    def _cosine_similarity_search(
        self,
        query_vec: np.ndarray,
        corpus_embeddings: np.ndarray,
        top_k: int,
    ) -> list[tuple[int, float]]:
        """余弦相似度搜索"""
        if corpus_embeddings.size == 0:
            return []
        # 归一化
        q_norm = query_vec / (np.linalg.norm(query_vec) + 1e-10)
        c_norm = corpus_embeddings / (
            np.linalg.norm(corpus_embeddings, axis=1, keepdims=True) + 1e-10
        )
        scores = np.dot(c_norm, q_norm)
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [(int(i), float(scores[i])) for i in top_indices]

    async def retrieve_context(self, query: str, top_k: int | None = None) -> list[dict[str, Any]]:
        """异步检索与查询最相关的知识点

        P1-02: 结果中增加引用可见性字段 source_id / data_version / embedding_model。
        """
        if not self._initialized:
            await self.initialize()
        if top_k is None:
            top_k = settings.RAG_TOP_K

        query_vec = await self._embed_query(query)
        results = self._cosine_similarity_search(
            query_vec, self._knowledge_embeddings, top_k
        )

        contexts: list[dict[str, Any]] = []
        for idx, score in results:
            if score < settings.RAG_SIMILARITY_THRESHOLD:
                continue
            chunk = dict(self._knowledge_chunks[idx])
            chunk["similarity"] = round(score, 4)
            # P1-02: 引用可见性字段
            chunk["source_id"] = chunk.get("id", "")
            chunk["data_version"] = self._data_version
            chunk["embedding_model"] = self._embedding_model_name()
            contexts.append(chunk)
        return contexts

    async def search_similar_questions(
        self, query: str, top_k: int | None = None
    ) -> list[dict[str, Any]]:
        """异步检索与查询最相似的题目

        P1-02: 结果中增加引用可见性字段 source_id / data_version / embedding_model。
        """
        if not self._initialized:
            await self.initialize()
        if top_k is None:
            top_k = settings.RAG_TOP_K

        query_vec = await self._embed_query(query)
        results = self._cosine_similarity_search(
            query_vec, self._question_embeddings, top_k
        )

        questions: list[dict[str, Any]] = []
        for idx, score in results:
            if score < settings.RAG_SIMILARITY_THRESHOLD:
                continue
            chunk = dict(self._question_chunks[idx])
            chunk["similarity"] = round(score, 4)
            # P1-02: 引用可见性字段
            chunk["source_id"] = chunk.get("id", "")
            chunk["data_version"] = self._data_version
            chunk["embedding_model"] = self._embedding_model_name()
            questions.append(chunk)
        return questions

    def format_context_for_llm(self, contexts: list[dict[str, Any]]) -> str:
        """将检索到的知识点格式化为 LLM 可用的上下文文本"""
        if not contexts:
            return "暂无相关知识内容。"
        lines: list[str] = []
        for i, ctx in enumerate(contexts, 1):
            lines.append(
                f"{i}. [{ctx.get('subject', '')}] {ctx.get('chapter', '')} > "
                f"{ctx.get('section', '')} > {ctx.get('name', '')}\n"
                f"   {ctx.get('description', '')}"
            )
        return "\n\n".join(lines)

    # ── 离线评测（Evaluation，P1-02） ───────────────────────

    async def evaluate(
        self, top_k_list: list[int] | None = None
    ) -> dict[str, Any]:
        """离线评测：基于黄金样本计算检索质量指标

        指标包括：
        - Recall@K：黄金样本中正确结果（含 expected_keywords）出现在 top-K 的比例
        - MRR：平均倒数排名（Mean Reciprocal Rank）
        - citation_accuracy：引用正确率（结果中含 expected_keywords 的样本比例）
        - no_evidence_rate：无依据回答率（similarity < threshold 的比例）

        Args:
            top_k_list: 评测的 K 值列表，默认 [1, 3, 5]

        Returns:
            dict[str, Any]: 评测报告，含 samples_count / metrics / details
        """
        if top_k_list is None:
            top_k_list = [1, 3, 5]
        if not top_k_list:
            top_k_list = [1]

        if not self._initialized:
            await self.initialize()

        max_k = max(top_k_list)
        samples = self._golden_samples
        total = len(samples)

        if total == 0:
            metrics: dict[str, Any] = {
                "mrr": 0.0,
                "citation_accuracy": 0.0,
                "no_evidence_rate": 0.0,
            }
            for k in top_k_list:
                metrics[f"recall@{k}"] = 0.0
            return {
                "samples_count": 0,
                "metrics": metrics,
                "details": [],
            }

        # 累加器
        recall_hits: dict[int, int] = {k: 0 for k in top_k_list}
        mrr_sum: float = 0.0
        citation_correct: int = 0
        no_evidence: int = 0

        details: list[dict[str, Any]] = []

        for sample in samples:
            query = sample["query"]
            expected_keywords = sample.get("expected_keywords", [])

            # 检索知识点（已含 citation 字段）
            knowledge_results = await self.retrieve_context(query, top_k=max_k)

            # 计算每个结果的命中状态：是否包含 expected_keywords
            hit_ranks: list[int] = []
            for rank, ctx in enumerate(knowledge_results, 1):
                combined_text = " ".join(
                    [
                        str(ctx.get("text", "")),
                        str(ctx.get("name", "")),
                        str(ctx.get("description", "")),
                    ]
                )
                if any(kw in combined_text for kw in expected_keywords):
                    hit_ranks.append(rank)

            # Recall@K：top-K 内至少有一个命中
            for k in top_k_list:
                if any(r <= k for r in hit_ranks):
                    recall_hits[k] += 1

            # MRR：第一个命中结果的倒数排名
            if hit_ranks:
                mrr_sum += 1.0 / hit_ranks[0]

            # 引用正确率：检索结果中含 expected_keywords
            if hit_ranks:
                citation_correct += 1

            # 无依据回答率：top-1 similarity < threshold 或结果为空
            if not knowledge_results:
                no_evidence += 1
            else:
                top_sim = float(knowledge_results[0].get("similarity", 0.0))
                if top_sim < settings.RAG_SIMILARITY_THRESHOLD:
                    no_evidence += 1

            details.append(
                {
                    "query": query,
                    "expected_keywords": expected_keywords,
                    "retrieved_count": len(knowledge_results),
                    "hit_count": len(hit_ranks),
                    "first_hit_rank": hit_ranks[0] if hit_ranks else None,
                    "top_similarity": (
                        float(knowledge_results[0].get("similarity", 0.0))
                        if knowledge_results
                        else 0.0
                    ),
                    "source_ids": [
                        ctx.get("source_id", "") for ctx in knowledge_results
                    ],
                    "data_version": self._data_version,
                }
            )

        # 归一化指标
        metrics = {
            "mrr": round(mrr_sum / total, 4),
            "citation_accuracy": round(citation_correct / total, 4),
            "no_evidence_rate": round(no_evidence / total, 4),
        }
        for k in top_k_list:
            metrics[f"recall@{k}"] = round(recall_hits[k] / total, 4)

        return {
            "samples_count": total,
            "top_k_list": list(top_k_list),
            "metrics": metrics,
            "details": details,
            "data_version": self._data_version,
            "embedding_model": self._embedding_model_name(),
        }


# 全局单例
_rag_service: RAGService | None = None


def get_rag_service() -> RAGService:
    """获取 RAG 服务单例（不自动初始化，需在 lifespan 中显式 await initialize()）"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
