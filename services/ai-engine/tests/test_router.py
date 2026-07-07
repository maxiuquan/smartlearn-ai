"""
AIRouter 测试（异步版）

覆盖路由解析、供应商切换、统计记录、离线兜底等核心逻辑。
所有路由方法为 async，测试使用 pytest.mark.asyncio + await。
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

import pytest
import pytest_asyncio

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


# ═══════════════════════════════════════════════════════════════
# Mock Provider 工厂（异步版）
# ═══════════════════════════════════════════════════════════════

def _create_mock_provider(name: str, is_offline: bool = False) -> MagicMock:
    """创建一个 mock 供应商实例，具备完整的异步接口方法。"""
    provider = MagicMock()
    provider.name = name
    provider.is_offline = is_offline
    provider.model_name = f"{name}-model"

    # 聊天接口（异步）
    provider.chat_completion = AsyncMock(return_value=f"来自 {name} 的回复")
    provider.chat_completion_stream = AsyncMock(return_value=_async_iter([f"来自 {name} 的流式回复"]))

    # 嵌入接口（异步）
    provider.generate_embedding = AsyncMock(return_value=[0.1] * 1536)
    provider.generate_embeddings = AsyncMock(return_value=[[0.1] * 1536])

    # TTS / STT（异步）
    provider.text_to_speech = AsyncMock(return_value=b"fake-audio-data")
    provider.speech_to_text = AsyncMock(return_value="识别结果")

    # 图像（异步）
    provider.generate_image = AsyncMock(return_value=["https://example.com/img.png"])

    # 审核（异步）
    provider.moderate = AsyncMock(return_value={
        "flagged": False,
        "categories": [],
        "reason": "无违规",
        "confidence": 0.0,
    })

    # 健康检查（同步）
    provider.health_check.return_value = {
        "status": "ok",
        "provider_name": name,
        "model": f"{name}-model",
    }

    return provider


async def _async_iter(items):
    """将列表转为异步生成器。"""
    for item in items:
        yield item


# ═══════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def mock_settings():
    """返回一个 mock settings 对象。"""
    settings = MagicMock()
    settings.APP_NAME = "SmartLearn AI Engine"
    settings.LLM_MAX_TOKENS = 2048
    settings.LLM_TEMPERATURE = 0.7
    settings.EMBEDDING_DIMENSIONS = 1536
    settings.RAG_TOP_K = 5
    settings.RAG_SIMILARITY_THRESHOLD = 0.3
    settings.offline_mode = False
    settings.has_any_provider = True
    settings.active_providers = ["glm", "deepseek", "siliconflow"]
    return settings


@pytest.fixture
def mock_registry():
    """创建一个 mock 注册中心，包含所有在线供应商。"""
    registry = MagicMock()

    def _get_provider(name):
        mapping = {
            "glm": _create_mock_provider("glm", is_offline=False),
            "deepseek": _create_mock_provider("deepseek", is_offline=False),
            "siliconflow": _create_mock_provider("siliconflow", is_offline=False),
            "cogview": _create_mock_provider("cogview", is_offline=False),
        }
        return mapping.get(name)

    registry.get_provider.side_effect = _get_provider
    return registry


@pytest.fixture
def mock_offline_registry():
    """创建一个 mock 注册中心，所有供应商均为离线状态。"""
    registry = MagicMock()

    def _get_provider(name):
        return _create_mock_provider(name, is_offline=True)

    registry.get_provider.side_effect = _get_provider
    return registry


@pytest.fixture
def mock_empty_registry():
    """创建一个空的 mock 注册中心（无任何供应商）。"""
    registry = MagicMock()
    registry.get_provider.return_value = None
    return registry


@pytest.fixture
def patched_router(mock_registry, mock_settings):
    """创建 AIRouter 实例，注入 mock registry 和 settings。"""
    with patch("app.providers.router.settings", mock_settings):
        with patch("app.providers.router.get_registry", return_value=mock_registry):
            from app.providers.router import AIRouter
            router = AIRouter()
            return router


@pytest.fixture
def patched_router_offline_registry(mock_offline_registry, mock_settings):
    """创建 AIRouter 实例，所有供应商离线但仍在注册表中。"""
    with patch("app.providers.router.settings", mock_settings):
        with patch("app.providers.router.get_registry", return_value=mock_offline_registry):
            from app.providers.router import AIRouter
            router = AIRouter()
            return router


@pytest.fixture
def patched_router_empty_registry(mock_empty_registry, mock_settings):
    """创建 AIRouter 实例，无任何供应商注册。"""
    with patch("app.providers.router.settings", mock_settings):
        with patch("app.providers.router.get_registry", return_value=mock_empty_registry):
            from app.providers.router import AIRouter
            router = AIRouter()
            return router


# ═══════════════════════════════════════════════════════════════
# 路由解析测试
# ═══════════════════════════════════════════════════════════════

class TestResolveRoute:
    """测试 _resolve_route 方法"""

    def test_chat_math_routes_to_deepseek_primary_glm_fallback(self, patched_router):
        primary, fallback = patched_router._resolve_route("chat", "math")
        assert primary == "deepseek"
        assert fallback == "glm"

    def test_chat_english_routes_to_glm_primary_deepseek_fallback(self, patched_router):
        primary, fallback = patched_router._resolve_route("chat", "english")
        assert primary == "glm"
        assert fallback == "deepseek"

    def test_embedding_wildcard_routes_to_siliconflow(self, patched_router):
        for subject in ["math", "english", "default", "unknown"]:
            primary, fallback = patched_router._resolve_route("embedding", subject)
            assert primary == "siliconflow"
            assert fallback is None

    def test_image_wildcard_routes_to_cogview_primary_siliconflow_fallback(self, patched_router):
        primary, fallback = patched_router._resolve_route("image", "default")
        assert primary == "cogview"
        assert fallback == "siliconflow"

    def test_unknown_capability_falls_back_to_glm(self, patched_router):
        primary, fallback = patched_router._resolve_route("unknown_capability", "math")
        assert primary == "glm"
        assert fallback is None


# ═══════════════════════════════════════════════════════════════
# 统计测试
# ═══════════════════════════════════════════════════════════════

class TestStats:
    """测试统计相关方法"""

    def test_record_request_success(self, patched_router):
        patched_router._record_request("glm", True, 0.5)
        assert patched_router._stats["total_requests"] == 1
        assert patched_router._stats["total_errors"] == 0

    def test_record_request_failure(self, patched_router):
        patched_router._record_request("deepseek", False, 1.0)
        assert patched_router._stats["total_requests"] == 1
        assert patched_router._stats["total_errors"] == 1

    def test_get_stats_no_requests(self, patched_router):
        stats = patched_router.get_stats()
        assert stats["total_requests"] == 0
        assert stats["avg_latency"] == 0.0

    def test_get_stats_with_requests(self, patched_router):
        patched_router._record_request("glm", True, 0.3)
        patched_router._record_request("glm", False, 0.7)
        stats = patched_router.get_stats()
        assert stats["total_requests"] == 2
        assert stats["total_errors"] == 1
        assert stats["avg_latency"] == 0.5

    def test_get_route_config(self, patched_router):
        config = patched_router.get_route_config()
        assert "chat:math" in config
        assert config["chat:math"]["primary"] == "deepseek"


# ═══════════════════════════════════════════════════════════════
# 聊天路由测试（异步）
# ═══════════════════════════════════════════════════════════════

class TestChatCompletion:
    """测试 async chat_completion 方法"""

    @pytest.mark.asyncio
    async def test_online_primary_succeeds(self, patched_router):
        """在线主供应商成功返回"""
        messages = [{"role": "user", "content": "你好"}]
        result = await patched_router.chat_completion(messages, subject="default")
        assert result == "来自 glm 的回复"

    @pytest.mark.asyncio
    async def test_primary_fails_fallback_succeeds(self, patched_router):
        """主供应商失败，回退供应商成功"""
        patched_router._registry.get_provider("glm").chat_completion.side_effect = Exception("GLM 错误")
        messages = [{"role": "user", "content": "你好"}]
        result = await patched_router.chat_completion(messages, subject="default")
        assert result == "来自 deepseek 的回复"

    @pytest.mark.asyncio
    async def test_all_online_fail_offline_fallback(self, patched_router_offline_registry):
        """所有在线供应商都失败，使用离线兜底"""
        messages = [{"role": "user", "content": "你好"}]
        result = await patched_router_offline_registry.chat_completion(messages, subject="default")
        assert result == "来自 glm 的回复"

    @pytest.mark.asyncio
    async def test_no_provider_at_all(self, patched_router_empty_registry):
        """无任何供应商时返回兜底消息"""
        messages = [{"role": "user", "content": "你好"}]
        result = await patched_router_empty_registry.chat_completion(messages, subject="default")
        assert "离线" in result or "不可用" in result


# ═══════════════════════════════════════════════════════════════
# 嵌入路由测试（异步）
# ═══════════════════════════════════════════════════════════════

class TestEmbeddingRouting:
    """测试异步嵌入向量路由"""

    @pytest.mark.asyncio
    async def test_generate_embedding_online(self, patched_router):
        """在线生成嵌入向量"""
        result = await patched_router.generate_embedding("测试文本")
        assert isinstance(result, list)
        assert len(result) == 1536

    @pytest.mark.asyncio
    async def test_generate_embedding_no_provider(self, patched_router_empty_registry):
        """无供应商时使用 mock 嵌入"""
        result = await patched_router_empty_registry.generate_embedding("测试文本")
        assert isinstance(result, list)
        assert len(result) == 1536

    @pytest.mark.asyncio
    async def test_generate_embeddings_batch_online(self, patched_router):
        """在线批量生成嵌入向量"""
        result = await patched_router.generate_embeddings(["文本1", "文本2"])
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
# TTS / STT 路由测试（异步）
# ═══════════════════════════════════════════════════════════════

class TestTTSAndSTT:
    """测试异步 TTS 和 STT 路由"""

    @pytest.mark.asyncio
    async def test_text_to_speech_online(self, patched_router):
        """在线 TTS"""
        result = await patched_router.text_to_speech("你好世界")
        assert isinstance(result, bytes)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_text_to_speech_no_provider(self, patched_router_empty_registry):
        """无供应商时 TTS 返回空字节"""
        result = await patched_router_empty_registry.text_to_speech("你好世界")
        assert result == b""

    @pytest.mark.asyncio
    async def test_speech_to_text_online(self, patched_router):
        """在线 STT"""
        result = await patched_router.speech_to_text(b"fake-audio")
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_speech_to_text_no_provider(self, patched_router_empty_registry):
        """无供应商时 STT 返回空字符串"""
        result = await patched_router_empty_registry.speech_to_text(b"fake-audio")
        assert result == ""


# ═══════════════════════════════════════════════════════════════
# 图像路由测试（异步）
# ═══════════════════════════════════════════════════════════════

class TestImageRouting:
    """测试异步图像生成路由"""

    @pytest.mark.asyncio
    async def test_generate_image_online(self, patched_router):
        """在线图像生成"""
        result = await patched_router.generate_image("一只猫")
        assert isinstance(result, list)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_generate_image_no_provider(self, patched_router_empty_registry):
        """无供应商时图像生成返回空列表"""
        result = await patched_router_empty_registry.generate_image("一只猫")
        assert result == []


# ═══════════════════════════════════════════════════════════════
# 审核路由测试（异步）
# ═══════════════════════════════════════════════════════════════

class TestModerationRouting:
    """测试异步内容审核路由"""

    @pytest.mark.asyncio
    async def test_moderate_online(self, patched_router):
        """在线内容审核"""
        result = await patched_router.moderate("测试文本")
        assert isinstance(result, dict)
        assert "flagged" in result

    @pytest.mark.asyncio
    async def test_moderate_no_provider_fail_closed(self, patched_router_empty_registry):
        """无供应商时审核 fail-closed（flagged=True）"""
        result = await patched_router_empty_registry.moderate("测试文本")
        assert result["flagged"] is True
