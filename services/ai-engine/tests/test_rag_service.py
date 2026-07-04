"""
RAGService 测试

覆盖余弦相似度搜索、关键词向量嵌入、字符哈希嵌入、上下文格式化等核心逻辑。
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


# ═══════════════════════════════════════════════════════════════
# 余弦相似度搜索测试
# ═══════════════════════════════════════════════════════════════

class TestCosineSimilaritySearch:
    """测试 _cosine_similarity_search 方法"""

    def test_returns_top_k_results(self, patched_rag_service):
        """返回 top_k 个结果"""
        # 构造 5 个文档向量，查询向量与第 3 个最相似
        corpus = np.array(
            [
                [1.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0],
                [0.5, 0.5, 0.0],
                [0.0, 0.5, 0.5],
            ],
            dtype=np.float32,
        )
        query = np.array([0.0, 0.0, 1.0], dtype=np.float32)

        results = patched_rag_service._cosine_similarity_search(query, corpus, top_k=3)
        assert len(results) == 3
        # 最相似的应该是第 3 个 (index 2)
        assert results[0][0] == 2
        assert abs(results[0][1] - 1.0) < 0.001

    def test_scores_are_between_neg_one_and_one(self, patched_rag_service):
        """相似度分数在 [-1, 1] 范围内"""
        corpus = np.array(
            [
                [1.0, 0.0],
                [0.0, 1.0],
                [-1.0, 0.0],
            ],
            dtype=np.float32,
        )
        query = np.array([0.5, 0.5], dtype=np.float32)

        results = patched_rag_service._cosine_similarity_search(query, corpus, top_k=3)
        for _, score in results:
            assert -1.0 <= score <= 1.0

    def test_empty_corpus_returns_empty(self, patched_rag_service):
        """空语料库返回空列表"""
        corpus = np.array([], dtype=np.float32).reshape(0, 3)
        query = np.array([1.0, 0.0, 0.0], dtype=np.float32)

        results = patched_rag_service._cosine_similarity_search(query, corpus, top_k=5)
        assert results == []

    def test_top_k_larger_than_corpus(self, patched_rag_service):
        """top_k 大于语料库大小时返回所有结果"""
        corpus = np.array(
            [[1.0, 0.0], [0.0, 1.0]],
            dtype=np.float32,
        )
        query = np.array([1.0, 0.0], dtype=np.float32)

        results = patched_rag_service._cosine_similarity_search(query, corpus, top_k=10)
        assert len(results) == 2

    def test_identical_vectors_score_one(self, patched_rag_service):
        """相同向量相似度为 1"""
        corpus = np.array(
            [[1.0, 2.0, 3.0]],
            dtype=np.float32,
        )
        query = np.array([1.0, 2.0, 3.0], dtype=np.float32)

        results = patched_rag_service._cosine_similarity_search(query, corpus, top_k=1)
        assert abs(results[0][1] - 1.0) < 0.001

    def test_zero_vector_does_not_crash(self, patched_rag_service):
        """零向量不导致除零错误"""
        corpus = np.array(
            [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0]],
            dtype=np.float32,
        )
        query = np.array([0.0, 0.0, 0.0], dtype=np.float32)

        results = patched_rag_service._cosine_similarity_search(query, corpus, top_k=2)
        assert len(results) == 2

    def test_results_sorted_descending(self, patched_rag_service):
        """结果按相似度降序排列"""
        corpus = np.array(
            [
                [0.1, 0.0, 0.0],  # 低相似度
                [0.9, 0.0, 0.0],  # 高相似度
                [0.5, 0.0, 0.0],  # 中等相似度
            ],
            dtype=np.float32,
        )
        query = np.array([1.0, 0.0, 0.0], dtype=np.float32)

        results = patched_rag_service._cosine_similarity_search(query, corpus, top_k=3)
        scores = [score for _, score in results]
        assert scores == sorted(scores, reverse=True)


# ═══════════════════════════════════════════════════════════════
# 简单关键词嵌入测试
# ═══════════════════════════════════════════════════════════════

class TestSimpleKeywordEmbed:
    """测试 _simple_keyword_embed 方法"""

    def test_returns_correct_shape(self, patched_rag_service):
        """返回正确形状的矩阵"""
        texts = ["数学导数", "英语语法"]
        keywords_list = [["数学", "导数"], ["英语", "语法"]]
        result = patched_rag_service._simple_keyword_embed(texts, keywords_list)
        assert result.shape == (2, 4)
        assert result.dtype == np.float32

    def test_keyword_dimension_at_least_embedding_dim(self, patched_rag_service):
        """当关键词数量小于 EMBEDDING_DIMENSIONS 时，维度至少等于 EMBEDDING_DIMENSIONS"""
        texts = ["短文本"]
        keywords_list = [["数学"]]
        result = patched_rag_service._simple_keyword_embed(texts, keywords_list)
        assert result.shape[1] >= patched_rag_service._embedding_dim

    def test_keyword_presence_sets_one(self, patched_rag_service):
        """关键词存在时对应维度设为 1.0"""
        texts = ["数学题"]
        keywords_list = [["数学"]]
        result = patched_rag_service._simple_keyword_embed(texts, keywords_list)
        # 词汇表中 "数学" 是第一个
        assert result[0, 0] == 1.0

    def test_text_matching_sets_half(self, patched_rag_service):
        """文本中出现关键词时对应维度至少设为 0.5"""
        texts = ["这是一道数学题，需要用到导数知识"]
        # 关键词列表为空，但文本中包含了"数学"和"导数"
        keywords_list = [["数学", "导数"]]
        result = patched_rag_service._simple_keyword_embed(texts, keywords_list)
        # 文本中匹配到的关键词至少为 0.5
        assert result[0, 0] >= 0.5  # 数学
        assert result[0, 1] >= 0.5  # 导数

    def test_empty_keywords_falls_back_to_char_hash(self, patched_rag_service):
        """无关键词时回退到字符哈希嵌入"""
        texts = ["无关键词文本"]
        keywords_list = [[]]
        result = patched_rag_service._simple_keyword_embed(texts, keywords_list)
        assert result.shape == (1, patched_rag_service._embedding_dim)

    def test_multiple_texts_independent(self, patched_rag_service):
        """多个文本各自独立嵌入"""
        texts = ["数学", "英语"]
        keywords_list = [["数学"], ["英语"]]
        result = patched_rag_service._simple_keyword_embed(texts, keywords_list)
        assert result.shape[0] == 2


# ═══════════════════════════════════════════════════════════════
# 字符哈希嵌入测试
# ═══════════════════════════════════════════════════════════════

class TestCharHashEmbed:
    """测试 _char_hash_embed 方法"""

    def test_returns_correct_shape(self, patched_rag_service):
        """返回正确形状的矩阵"""
        texts = ["文本一", "文本二"]
        result = patched_rag_service._char_hash_embed(texts)
        assert result.shape == (2, patched_rag_service._embedding_dim)
        assert result.dtype == np.float32

    def test_vectors_are_normalized(self, patched_rag_service):
        """向量已 L2 归一化"""
        texts = ["测试文本"]
        result = patched_rag_service._char_hash_embed(texts)
        norm = np.linalg.norm(result[0])
        assert abs(norm - 1.0) < 0.001

    def test_different_texts_different_vectors(self, patched_rag_service):
        """不同文本产生不同向量"""
        texts = ["数学", "英语"]
        result = patched_rag_service._char_hash_embed(texts)
        assert not np.allclose(result[0], result[1])

    def test_same_text_same_vector(self, patched_rag_service):
        """相同文本产生相同向量"""
        texts = ["数学题", "数学题"]
        result = patched_rag_service._char_hash_embed(texts)
        assert np.allclose(result[0], result[1])

    def test_empty_text(self, patched_rag_service):
        """空文本不崩溃"""
        texts = [""]
        result = patched_rag_service._char_hash_embed(texts)
        assert result.shape == (1, patched_rag_service._embedding_dim)


# ═══════════════════════════════════════════════════════════════
# 上下文格式化测试
# ═══════════════════════════════════════════════════════════════

class TestFormatContext:
    """测试 format_context_for_llm 方法"""

    def test_empty_contexts(self, patched_rag_service):
        """空上下文列表返回提示信息"""
        result = patched_rag_service.format_context_for_llm([])
        assert "暂无相关知识内容" in result

    def test_single_context(self, patched_rag_service):
        """单个上下文正确格式化"""
        contexts = [
            {
                "subject": "数学",
                "chapter": "微积分",
                "section": "导数",
                "name": "导数的定义",
                "description": "导数描述了函数在某点的变化率",
            }
        ]
        result = patched_rag_service.format_context_for_llm(contexts)
        assert "数学" in result
        assert "微积分" in result
        assert "导数" in result
        assert "导数的定义" in result
        assert "导数描述了函数在某点的变化率" in result

    def test_multiple_contexts(self, patched_rag_service):
        """多个上下文正确格式化"""
        contexts = [
            {
                "subject": "数学",
                "chapter": "微积分",
                "section": "导数",
                "name": "导数定义",
                "description": "描述1",
            },
            {
                "subject": "英语",
                "chapter": "语法",
                "section": "时态",
                "name": "现在完成时",
                "description": "描述2",
            },
        ]
        result = patched_rag_service.format_context_for_llm(contexts)
        assert "1." in result
        assert "2." in result
        assert "导数定义" in result
        assert "现在完成时" in result

    def test_missing_fields_handled(self, patched_rag_service):
        """缺失字段不报错"""
        contexts = [
            {
                "name": "仅有名称",
            }
        ]
        result = patched_rag_service.format_context_for_llm(contexts)
        assert "仅有名称" in result


# ═══════════════════════════════════════════════════════════════
# 嵌入查询测试
# ═══════════════════════════════════════════════════════════════

class TestEmbedQuery:
    """测试 _embed_query 方法"""

    def test_embed_query_online(self, patched_rag_service):
        """在线生成查询嵌入"""
        result = patched_rag_service._embed_query("测试查询")
        assert isinstance(result, np.ndarray)
        assert len(result) == 1536

    def test_embed_query_fallback(self, patched_rag_service):
        """路由失败时回退到关键词嵌入"""
        patched_rag_service._router.generate_embedding.side_effect = Exception("失败")
        result = patched_rag_service._embed_query("测试查询")
        assert isinstance(result, np.ndarray)
        assert len(result) == patched_rag_service._embedding_dim


# ═══════════════════════════════════════════════════════════════
# 批量嵌入测试
# ═══════════════════════════════════════════════════════════════

class TestEmbedTexts:
    """测试 _embed_texts 方法"""

    def test_embed_texts_online(self, patched_rag_service):
        """在线批量嵌入"""
        result = patched_rag_service._embed_texts(["文本1", "文本2"])
        assert isinstance(result, np.ndarray)
        assert result.shape == (2, 1536)

    def test_embed_texts_fallback(self, patched_rag_service):
        """路由失败时回退到关键词嵌入"""
        patched_rag_service._router.generate_embeddings.side_effect = Exception("失败")
        result = patched_rag_service._embed_texts(["文本1", "文本2"])
        assert isinstance(result, np.ndarray)
        assert result.shape[0] == 2