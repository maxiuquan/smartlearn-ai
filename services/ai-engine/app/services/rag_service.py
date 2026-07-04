"""
RAG (Retrieval Augmented Generation) 服务

从知识库中检索相关知识内容和相似题目，为 LLM 提供上下文增强。
通过多供应商 AI 路由层获取嵌入向量（全局统一使用 SiliconFlow BAAI/bge-m3）。
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np

# 添加项目根目录到路径，以便导入 config
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import settings
from app.providers.router import get_router


# ─── 数据路径 ───────────────────────────────────────────────
DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "data"
KNOWLEDGE_POINTS_DIR = DATA_DIR / "knowledge-points"
QUESTIONS_DIR = DATA_DIR / "questions"


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

    # ── 初始化 ──────────────────────────────────────────────

    def initialize(self) -> None:
        """加载所有知识数据并构建索引"""
        if self._initialized:
            return
        self._load_knowledge_points()
        self._load_questions()
        self._build_embeddings()
        self._initialized = True
        print(
            f"RAG 服务已初始化: {len(self._knowledge_chunks)} 个知识点, "
            f"{len(self._question_chunks)} 道题目"
        )

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

    def _build_embeddings(self) -> None:
        """构建文本嵌入向量（通过路由层获取嵌入）"""
        use_ai = settings.has_any_provider

        # 构建知识点嵌入
        if self._knowledge_chunks:
            if use_ai:
                self._knowledge_embeddings = self._embed_texts(
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
                self._question_embeddings = self._embed_texts(
                    [c["text"] for c in self._question_chunks]
                )
            else:
                self._question_embeddings = self._simple_keyword_embed(
                    [c["text"] for c in self._question_chunks],
                    [c.get("tags", []) for c in self._question_chunks],
                )
        else:
            self._question_embeddings = np.array([]).reshape(0, self._embedding_dim)

    # ── 嵌入方法 ────────────────────────────────────────────

    def _embed_texts(self, texts: list[str]) -> np.ndarray:
        """使用路由层生成文本嵌入（全局统一嵌入模型）"""
        try:
            embeddings = self._router.generate_embeddings(texts)
            return np.array(embeddings, dtype=np.float32)
        except Exception as e:
            print(f"嵌入生成失败，回退到关键词向量: {e}")
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
        """基于字符哈希的简单嵌入（无关键词时的回退）"""
        dim = self._embedding_dim
        vectors = np.zeros((len(texts), dim), dtype=np.float32)
        for i, text in enumerate(texts):
            for j, ch in enumerate(text):
                idx = hash(ch) % dim
                vectors[i, idx] += 1.0
            norm = np.linalg.norm(vectors[i])
            if norm > 0:
                vectors[i] /= norm
        return vectors

    def _embed_query(self, query: str) -> np.ndarray:
        """为查询文本生成嵌入向量（通过路由层）"""
        try:
            embedding = self._router.generate_embedding(query)
            return np.array(embedding, dtype=np.float32)
        except Exception:
            pass
        # 回退到简单关键词向量
        return self._simple_keyword_embed([query], [[]])[0]

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

    def retrieve_context(self, query: str, top_k: int | None = None) -> list[dict[str, Any]]:
        """检索与查询最相关的知识点"""
        if not self._initialized:
            self.initialize()
        if top_k is None:
            top_k = settings.RAG_TOP_K

        query_vec = self._embed_query(query)
        results = self._cosine_similarity_search(
            query_vec, self._knowledge_embeddings, top_k
        )

        contexts: list[dict[str, Any]] = []
        for idx, score in results:
            if score < settings.RAG_SIMILARITY_THRESHOLD:
                continue
            chunk = dict(self._knowledge_chunks[idx])
            chunk["similarity"] = round(score, 4)
            contexts.append(chunk)
        return contexts

    def search_similar_questions(
        self, query: str, top_k: int | None = None
    ) -> list[dict[str, Any]]:
        """检索与查询最相似的题目"""
        if not self._initialized:
            self.initialize()
        if top_k is None:
            top_k = settings.RAG_TOP_K

        query_vec = self._embed_query(query)
        results = self._cosine_similarity_search(
            query_vec, self._question_embeddings, top_k
        )

        questions: list[dict[str, Any]] = []
        for idx, score in results:
            if score < settings.RAG_SIMILARITY_THRESHOLD:
                continue
            chunk = dict(self._question_chunks[idx])
            chunk["similarity"] = round(score, 4)
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


# 全局单例
_rag_service: RAGService | None = None


def get_rag_service() -> RAGService:
    """获取 RAG 服务单例"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
        _rag_service.initialize()
    return _rag_service