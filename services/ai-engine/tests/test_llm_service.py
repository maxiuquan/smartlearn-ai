"""
LLMService 测试（异步版）

覆盖学科推断、模拟响应、在线/离线对话等核心逻辑。
所有调用 LLM 方法均为 async，使用 pytest.mark.asyncio + await。
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


# ═══════════════════════════════════════════════════════════════
# 学科推断测试（同步，纯函数）
# ═══════════════════════════════════════════════════════════════

class TestInferSubject:
    """测试 _infer_subject 函数"""

    def test_infer_math_by_chinese_keyword(self):
        """中文数学关键词推断为 math"""
        from app.services.llm_service import _infer_subject

        messages = [{"role": "user", "content": "请帮我解这道导数题"}]
        assert _infer_subject(messages) == "math"

    def test_infer_math_by_english_keyword(self):
        """英文数学关键词推断为 math"""
        from app.services.llm_service import _infer_subject

        messages = [{"role": "user", "content": "solve this calculus problem"}]
        assert _infer_subject(messages) == "math"

    def test_infer_math_by_formula(self):
        """数学公式关键词推断为 math"""
        from app.services.llm_service import _infer_subject

        messages = [{"role": "user", "content": "求 lim x->0 sin(x)/x"}]
        assert _infer_subject(messages) == "math"

    def test_infer_english_by_chinese_keyword(self):
        """中文英语关键词推断为 english"""
        from app.services.llm_service import _infer_subject

        messages = [{"role": "user", "content": "帮我翻译这段英文"}]
        assert _infer_subject(messages) == "english"

    def test_infer_english_by_english_keyword(self):
        """英文英语关键词推断为 english"""
        from app.services.llm_service import _infer_subject

        messages = [{"role": "user", "content": "explain the grammar in this sentence"}]
        assert _infer_subject(messages) == "english"

    def test_infer_politics(self):
        """政治关键词推断为 politics"""
        from app.services.llm_service import _infer_subject

        messages = [{"role": "user", "content": "请解释马克思主义的基本原理"}]
        assert _infer_subject(messages) == "politics"

    def test_infer_professional(self):
        """专业课关键词推断为 professional"""
        from app.services.llm_service import _infer_subject

        messages = [{"role": "user", "content": "数据结构中的二叉树遍历"}]
        assert _infer_subject(messages) == "professional"

    def test_infer_default_for_unknown(self):
        """无已知关键词时返回 default"""
        from app.services.llm_service import _infer_subject

        messages = [{"role": "user", "content": "今天天气怎么样"}]
        assert _infer_subject(messages) == "default"

    def test_infer_math_priority_over_others(self):
        """数学关键词优先于其他关键词被匹配"""
        from app.services.llm_service import _infer_subject

        messages = [{"role": "user", "content": "用 python 求解这个积分方程"}]
        assert _infer_subject(messages) == "math"


# ═══════════════════════════════════════════════════════════════
# 模拟响应测试（同步，纯函数）
# ═══════════════════════════════════════════════════════════════

class TestMockResponse:
    """测试 _mock_response 方法"""

    def test_mock_response_for_explain(self, patched_llm_service):
        """包含"解释"的消息生成解析类模拟响应"""
        messages = [{"role": "user", "content": "请解释一下微积分的基本概念"}]
        result = patched_llm_service._mock_response(messages)
        assert "模拟解析" in result
        assert "离线模式" in result

    def test_mock_response_for_study_plan(self, patched_llm_service):
        """包含"学习计划"的消息生成学习计划模拟响应"""
        messages = [{"role": "user", "content": "帮我制定一个英语学习计划"}]
        result = patched_llm_service._mock_response(messages)
        assert "模拟学习计划" in result

    def test_mock_response_default(self, patched_llm_service):
        """普通消息生成默认模拟响应"""
        messages = [{"role": "user", "content": "你好，请问你是谁"}]
        result = patched_llm_service._mock_response(messages)
        assert "模拟回复" in result
        assert "SmartLearn 小智" in result


# ═══════════════════════════════════════════════════════════════
# LLM 调用测试（在线模式，异步）
# ═══════════════════════════════════════════════════════════════

class TestLLMOnline:
    """测试在线模式下 LLM 服务的核心方法（异步）"""

    @pytest.mark.asyncio
    async def test_call_llm_online(self, patched_llm_service):
        """在线调用 _call_llm"""
        result = await patched_llm_service._call_llm(
            [{"role": "user", "content": "你好"}]
        )
        assert result == "mock 路由回复"

    @pytest.mark.asyncio
    async def test_generate_explanation_online(self, patched_llm_service):
        """在线生成题目解析"""
        result = await patched_llm_service.generate_explanation(
            question="1+1=?",
            answer="2",
        )
        assert result == "mock 路由回复"

    @pytest.mark.asyncio
    async def test_chat_online(self, patched_llm_service):
        """在线 AI 对话"""
        result = await patched_llm_service.chat(
            [{"role": "user", "content": "你好"}]
        )
        assert result == "mock 路由回复"

    @pytest.mark.asyncio
    async def test_chat_with_context(self, patched_llm_service):
        """带上下文对话"""
        result = await patched_llm_service.chat(
            [{"role": "user", "content": "你好"}],
            context="这是额外的上下文",
        )
        assert result == "mock 路由回复"

    @pytest.mark.asyncio
    async def test_generate_study_plan_online(self, patched_llm_service):
        """在线生成学习计划"""
        result = await patched_llm_service.generate_study_plan(
            subject="math",
            weak_points=["导数", "积分"],
        )
        assert result == "mock 路由回复"


# ═══════════════════════════════════════════════════════════════
# LLM 调用测试（离线模式，异步）
# ═══════════════════════════════════════════════════════════════

class TestLLMOffline:
    """测试离线模式下 LLM 服务的回退行为（异步）"""

    @pytest.mark.asyncio
    async def test_generate_explanation_offline(self, patched_llm_service_offline):
        """离线时生成解析返回模拟响应"""
        result = await patched_llm_service_offline.generate_explanation(
            question="1+1=?",
            answer="2",
        )
        assert "离线模式" in result

    @pytest.mark.asyncio
    async def test_chat_offline(self, patched_llm_service_offline):
        """离线时对话返回模拟响应"""
        result = await patched_llm_service_offline.chat(
            [{"role": "user", "content": "你好"}]
        )
        assert "离线模式" in result

    @pytest.mark.asyncio
    async def test_generate_study_plan_offline(self, patched_llm_service_offline):
        """离线时学习计划返回模拟响应"""
        result = await patched_llm_service_offline.generate_study_plan(
            subject="math",
            weak_points=["导数"],
        )
        assert "离线模式" in result
