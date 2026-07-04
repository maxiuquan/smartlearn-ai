"""
AIRouter 测试

覆盖路由解析、供应商切换、统计记录、离线兜底等核心逻辑。
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


# ═══════════════════════════════════════════════════════════════
# 路由解析测试
# ═══════════════════════════════════════════════════════════════

class TestResolveRoute:
    """测试 _resolve_route 方法"""

    def test_chat_math_routes_to_deepseek_primary_glm_fallback(self, patched_router):
        """chat + math → primary=deepseek, fallback=glm"""
        primary, fallback = patched_router._resolve_route("chat", "math")
        assert primary == "deepseek"
        assert fallback == "glm"

    def test_chat_english_routes_to_glm_primary_deepseek_fallback(self, patched_router):
        """chat + english → primary=glm, fallback=deepseek"""
        primary, fallback = patched_router._resolve_route("chat", "english")
        assert primary == "glm"
        assert fallback == "deepseek"

    def test_chat_default_routes_to_glm_primary_deepseek_fallback(self, patched_router):
        """chat + default → primary=glm, fallback=deepseek"""
        primary, fallback = patched_router._resolve_route("chat", "default")
        assert primary == "glm"
        assert fallback == "deepseek"

    def test_chat_politics_routes_to_glm_primary_deepseek_fallback(self, patched_router):
        """chat + politics → primary=glm, fallback=deepseek"""
        primary, fallback = patched_router._resolve_route("chat", "politics")
        assert primary == "glm"
        assert fallback == "deepseek"

    def test_chat_professional_routes_to_deepseek_primary_glm_fallback(
        self, patched_router
    ):
        """chat + professional → primary=deepseek, fallback=glm"""
        primary, fallback = patched_router._resolve_route("chat", "professional")
        assert primary == "deepseek"
        assert fallback == "glm"

    def test_embedding_wildcard_routes_to_siliconflow(self, patched_router):
        """embedding + 任意 subject → primary=siliconflow, no fallback"""
        for subject in ["math", "english", "default", "unknown"]:
            primary, fallback = patched_router._resolve_route("embedding", subject)
            assert primary == "siliconflow"
            assert fallback is None

    def test_tts_wildcard_routes_to_siliconflow(self, patched_router):
        """tts + 任意 subject → primary=siliconflow, no fallback"""
        primary, fallback = patched_router._resolve_route("tts", "default")
        assert primary == "siliconflow"
        assert fallback is None

    def test_stt_wildcard_routes_to_siliconflow(self, patched_router):
        """stt + 任意 subject → primary=siliconflow, no fallback"""
        primary, fallback = patched_router._resolve_route("stt", "default")
        assert primary == "siliconflow"
        assert fallback is None

    def test_image_wildcard_routes_to_cogview_primary_siliconflow_fallback(
        self, patched_router
    ):
        """image + 任意 subject → primary=cogview, fallback=siliconflow"""
        primary, fallback = patched_router._resolve_route("image", "default")
        assert primary == "cogview"
        assert fallback == "siliconflow"

    def test_moderation_wildcard_routes_to_glm(self, patched_router):
        """moderation + 任意 subject → primary=glm, no fallback"""
        primary, fallback = patched_router._resolve_route("moderation", "default")
        assert primary == "glm"
        assert fallback is None

    def test_unknown_capability_falls_back_to_glm(self, patched_router):
        """未知 capability → primary=glm, no fallback"""
        primary, fallback = patched_router._resolve_route("unknown_capability", "math")
        assert primary == "glm"
        assert fallback is None

    def test_unknown_subject_uses_wildcard(self, patched_router):
        """未知 subject + 已知 capability 使用通配符匹配"""
        primary, fallback = patched_router._resolve_route("embedding", "unknown_subject")
        assert primary == "siliconflow"
        assert fallback is None


# ═══════════════════════════════════════════════════════════════
# 统计测试
# ═══════════════════════════════════════════════════════════════

class TestStats:
    """测试统计相关方法"""

    def test_record_request_success(self, patched_router):
        """记录成功请求"""
        patched_router._record_request("glm", True, 0.5)
        assert patched_router._stats["total_requests"] == 1
        assert patched_router._stats["total_errors"] == 0
        assert patched_router._stats["total_latency"] == 0.5
        assert patched_router._provider_stats["glm"]["requests"] == 1
        assert patched_router._provider_stats["glm"]["errors"] == 0

    def test_record_request_failure(self, patched_router):
        """记录失败请求"""
        patched_router._record_request("deepseek", False, 1.0)
        assert patched_router._stats["total_requests"] == 1
        assert patched_router._stats["total_errors"] == 1
        assert patched_router._provider_stats["deepseek"]["requests"] == 1
        assert patched_router._provider_stats["deepseek"]["errors"] == 1

    def test_record_multiple_providers(self, patched_router):
        """多个供应商的统计记录"""
        patched_router._record_request("glm", True, 0.3)
        patched_router._record_request("deepseek", True, 0.7)
        patched_router._record_request("glm", False, 0.2)

        assert patched_router._stats["total_requests"] == 3
        assert patched_router._stats["total_errors"] == 1
        assert patched_router._provider_stats["glm"]["requests"] == 2
        assert patched_router._provider_stats["glm"]["errors"] == 1
        assert patched_router._provider_stats["deepseek"]["requests"] == 1
        assert patched_router._provider_stats["deepseek"]["errors"] == 0

    def test_get_stats_no_requests(self, patched_router):
        """无请求时的统计信息"""
        stats = patched_router.get_stats()
        assert stats["total_requests"] == 0
        assert stats["total_errors"] == 0
        assert stats["avg_latency"] == 0.0
        assert stats["error_rate"] == 0.0

    def test_get_stats_with_requests(self, patched_router):
        """有请求时的统计信息"""
        patched_router._record_request("glm", True, 0.3)
        patched_router._record_request("glm", False, 0.7)
        stats = patched_router.get_stats()
        assert stats["total_requests"] == 2
        assert stats["total_errors"] == 1
        assert stats["avg_latency"] == 0.5
        assert stats["error_rate"] == 0.5

    def test_get_route_config(self, patched_router):
        """获取路由配置"""
        config = patched_router.get_route_config()
        assert isinstance(config, dict)
        assert "chat:math" in config
        assert config["chat:math"]["primary"] == "deepseek"
        assert "embedding:*" in config
        assert config["embedding:*"]["primary"] == "siliconflow"


# ═══════════════════════════════════════════════════════════════
# 聊天路由测试
# ═══════════════════════════════════════════════════════════════

class TestChatCompletion:
    """测试 chat_completion 方法"""

    def test_online_primary_succeeds(self, patched_router):
        """在线主供应商成功返回"""
        messages = [{"role": "user", "content": "你好"}]
        result = patched_router.chat_completion(messages, subject="default")
        assert result == "来自 glm 的回复"

    def test_primary_fails_fallback_succeeds(self, patched_router):
        """主供应商失败，回退供应商成功"""
        # 让 glm 抛出异常
        patched_router._registry.get_provider("glm").chat_completion.side_effect = (
            Exception("GLM 错误")
        )
        messages = [{"role": "user", "content": "你好"}]
        result = patched_router.chat_completion(messages, subject="default")
        # fallback 是 deepseek
        assert result == "来自 deepseek 的回复"

    def test_all_online_fail_offline_fallback(self, patched_router_offline_registry):
        """所有在线供应商都失败，使用离线兜底"""
        messages = [{"role": "user", "content": "你好"}]
        result = patched_router_offline_registry.chat_completion(
            messages, subject="default"
        )
        assert result == "来自 glm 的回复"

    def test_no_provider_at_all(self, patched_router_empty_registry):
        """无任何供应商时返回兜底消息"""
        messages = [{"role": "user", "content": "你好"}]
        result = patched_router_empty_registry.chat_completion(
            messages, subject="default"
        )
        assert "暂时不可用" in result

    def test_chat_completion_stream_online(self, patched_router):
        """流式聊天在线成功"""
        messages = [{"role": "user", "content": "你好"}]
        chunks = list(
            patched_router.chat_completion_stream(messages, subject="default")
        )
        assert len(chunks) > 0
        assert "来自 glm 的流式回复" in "".join(chunks)

    def test_chat_completion_stream_fallback(self, patched_router):
        """流式聊天主供应商失败，回退成功"""
        patched_router._registry.get_provider("glm").chat_completion_stream.side_effect = (
            Exception("GLM 流式错误")
        )
        messages = [{"role": "user", "content": "你好"}]
        chunks = list(
            patched_router.chat_completion_stream(messages, subject="default")
        )
        assert len(chunks) > 0
        assert "来自 deepseek 的流式回复" in "".join(chunks)

    def test_chat_completion_stream_no_provider(self, patched_router_empty_registry):
        """流式聊天无供应商时返回兜底消息"""
        messages = [{"role": "user", "content": "你好"}]
        chunks = list(
            patched_router_empty_registry.chat_completion_stream(
                messages, subject="default"
            )
        )
        assert "暂时不可用" in "".join(chunks)


# ═══════════════════════════════════════════════════════════════
# 嵌入路由测试
# ═══════════════════════════════════════════════════════════════

class TestEmbeddingRouting:
    """测试嵌入向量路由"""

    def test_generate_embedding_online(self, patched_router):
        """在线生成嵌入向量"""
        result = patched_router.generate_embedding("测试文本")
        assert isinstance(result, list)
        assert len(result) == 1536

    def test_generate_embedding_no_provider(self, patched_router_empty_registry):
        """无供应商时使用 mock 嵌入"""
        result = patched_router_empty_registry.generate_embedding("测试文本")
        assert isinstance(result, list)
        assert len(result) == 1536

    def test_generate_embeddings_batch_online(self, patched_router):
        """在线批量生成嵌入向量"""
        result = patched_router.generate_embeddings(["文本1", "文本2"])
        assert isinstance(result, list)
        assert len(result) == 2

    def test_mock_embedding_dimensions(self, patched_router):
        """mock 嵌入向量维度"""
        result = patched_router._mock_embedding("任意文本")
        assert len(result) == 1536

    def test_mock_embedding_normalized(self, patched_router):
        """mock 嵌入向量已归一化（模长 ≈ 1.0）"""
        result = patched_router._mock_embedding("测试文本")
        norm = sum(v * v for v in result) ** 0.5
        assert abs(norm - 1.0) < 0.001


# ═══════════════════════════════════════════════════════════════
# TTS / STT 路由测试
# ═══════════════════════════════════════════════════════════════

class TestTTSAndSTT:
    """测试 TTS 和 STT 路由"""

    def test_text_to_speech_online(self, patched_router):
        """在线 TTS"""
        result = patched_router.text_to_speech("你好世界")
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_text_to_speech_no_provider(self, patched_router_empty_registry):
        """无供应商时 TTS 返回空字节"""
        result = patched_router_empty_registry.text_to_speech("你好世界")
        assert result == b""

    def test_speech_to_text_online(self, patched_router):
        """在线 STT"""
        result = patched_router.speech_to_text(b"fake-audio")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_speech_to_text_no_provider(self, patched_router_empty_registry):
        """无供应商时 STT 返回空字符串"""
        result = patched_router_empty_registry.speech_to_text(b"fake-audio")
        assert result == ""


# ═══════════════════════════════════════════════════════════════
# 图像路由测试
# ═══════════════════════════════════════════════════════════════

class TestImageRouting:
    """测试图像生成路由"""

    def test_generate_image_online(self, patched_router):
        """在线图像生成"""
        result = patched_router.generate_image("一只猫")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_generate_image_no_provider(self, patched_router_empty_registry):
        """无供应商时图像生成返回空列表"""
        result = patched_router_empty_registry.generate_image("一只猫")
        assert result == []


# ═══════════════════════════════════════════════════════════════
# 审核路由测试
# ═══════════════════════════════════════════════════════════════

class TestModerationRouting:
    """测试内容审核路由"""

    def test_moderate_online(self, patched_router):
        """在线内容审核"""
        result = patched_router.moderate("测试文本")
        assert isinstance(result, dict)
        assert "flagged" in result

    def test_moderate_no_provider(self, patched_router_empty_registry):
        """无供应商时审核返回默认安全结果"""
        result = patched_router_empty_registry.moderate("测试文本")
        assert result["flagged"] is False
        assert result["reason"] == "无审核供应商"