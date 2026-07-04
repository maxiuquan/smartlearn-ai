"""
pytest 共享 fixtures

提供 mock settings、mock providers、mock registry 等测试基础设施。
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# 确保项目根目录在 sys.path 中，以便源模块能正确导入
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


# ═══════════════════════════════════════════════════════════════
# Mock Settings
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def mock_settings():
    """返回一个 mock settings 对象，模拟默认配置值。"""
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
def mock_offline_settings():
    """返回一个模拟离线模式的 settings 对象。"""
    settings = MagicMock()
    settings.LLM_MAX_TOKENS = 2048
    settings.LLM_TEMPERATURE = 0.7
    settings.EMBEDDING_DIMENSIONS = 1536
    settings.RAG_TOP_K = 5
    settings.RAG_SIMILARITY_THRESHOLD = 0.3
    settings.offline_mode = True
    settings.has_any_provider = False
    settings.active_providers = []
    return settings


# ═══════════════════════════════════════════════════════════════
# Mock Providers
# ═══════════════════════════════════════════════════════════════

def _create_mock_provider(name: str, is_offline: bool = False) -> MagicMock:
    """创建一个 mock 供应商实例，具备完整的接口方法。"""
    provider = MagicMock()
    provider.name = name
    provider.is_offline = is_offline
    provider.model_name = f"{name}-model"

    # 聊天接口
    provider.chat_completion.return_value = f"来自 {name} 的回复"
    provider.chat_completion_stream.return_value = iter([f"来自 {name} 的流式回复"])

    # 嵌入接口
    provider.generate_embedding.return_value = [0.1] * 1536
    provider.generate_embeddings.return_value = [[0.1] * 1536]

    # TTS / STT
    provider.text_to_speech.return_value = b"fake-audio-data"
    provider.speech_to_text.return_value = "识别结果"

    # 图像
    provider.generate_image.return_value = ["https://example.com/img.png"]

    # 审核
    provider.moderate.return_value = {
        "flagged": False,
        "categories": [],
        "reason": "无违规",
        "confidence": 0.0,
    }

    # 健康检查
    provider.health_check.return_value = {
        "status": "ok",
        "provider_name": name,
        "model": f"{name}-model",
    }

    return provider


@pytest.fixture
def mock_glm_provider():
    """在线 GLM 供应商"""
    return _create_mock_provider("glm", is_offline=False)


@pytest.fixture
def mock_deepseek_provider():
    """在线 DeepSeek 供应商"""
    return _create_mock_provider("deepseek", is_offline=False)


@pytest.fixture
def mock_siliconflow_provider():
    """在线 SiliconFlow 供应商"""
    return _create_mock_provider("siliconflow", is_offline=False)


@pytest.fixture
def mock_offline_glm():
    """离线 GLM 供应商"""
    return _create_mock_provider("glm", is_offline=True)


@pytest.fixture
def mock_offline_deepseek():
    """离线 DeepSeek 供应商"""
    return _create_mock_provider("deepseek", is_offline=True)


# ═══════════════════════════════════════════════════════════════
# Mock Registry
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def mock_registry(mock_glm_provider, mock_deepseek_provider, mock_siliconflow_provider):
    """创建一个 mock 注册中心，包含所有在线供应商。"""
    registry = MagicMock()

    def _get_provider(name):
        mapping = {
            "glm": mock_glm_provider,
            "deepseek": mock_deepseek_provider,
            "siliconflow": mock_siliconflow_provider,
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


# ═══════════════════════════════════════════════════════════════
# 组合 Fixtures：注入 mock 到模块层
# ═══════════════════════════════════════════════════════════════

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
        with patch(
            "app.providers.router.get_registry", return_value=mock_offline_registry
        ):
            from app.providers.router import AIRouter

            router = AIRouter()
            return router


@pytest.fixture
def patched_router_empty_registry(mock_empty_registry, mock_settings):
    """创建 AIRouter 实例，无任何供应商注册。"""
    with patch("app.providers.router.settings", mock_settings):
        with patch(
            "app.providers.router.get_registry", return_value=mock_empty_registry
        ):
            from app.providers.router import AIRouter

            router = AIRouter()
            return router


@pytest.fixture
def patched_llm_service(mock_settings, mock_registry):
    """创建 LLMService 实例，注入 mock settings 和 router。"""
    with patch("app.services.llm_service.settings", mock_settings):
        with patch("app.services.rag_service.settings", mock_settings):
            with patch("app.providers.router.settings", mock_settings):
                with patch(
                    "app.providers.router.get_registry", return_value=mock_registry
                ):
                    with patch(
                        "app.services.rag_service.get_router", return_value=MagicMock()
                    ):
                        with patch(
                            "app.services.llm_service.get_router", return_value=MagicMock()
                        ):
                            from app.services.llm_service import LLMService

                            service = LLMService()
                            # 替换内部 router 为 mock
                            service._router = MagicMock()
                            service._router.chat_completion.return_value = "mock 路由回复"
                            service._rag = MagicMock()
                            service._rag.retrieve_context.return_value = []
                            service._rag.format_context_for_llm.return_value = ""
                            return service


@pytest.fixture
def patched_llm_service_offline(mock_offline_settings, mock_offline_registry):
    """创建 LLMService 实例，离线模式。"""
    with patch("app.services.llm_service.settings", mock_offline_settings):
        with patch("app.services.rag_service.settings", mock_offline_settings):
            with patch("app.providers.router.settings", mock_offline_settings):
                with patch(
                    "app.providers.router.get_registry",
                    return_value=mock_offline_registry,
                ):
                    with patch(
                        "app.services.rag_service.get_router", return_value=MagicMock()
                    ):
                        with patch(
                            "app.services.llm_service.get_router",
                            return_value=MagicMock(),
                        ):
                            from app.services.llm_service import LLMService

                            service = LLMService()
                            service._router = MagicMock()
                            service._router.chat_completion.side_effect = Exception(
                                "离线模式"
                            )
                            service._rag = MagicMock()
                            service._rag.retrieve_context.return_value = []
                            service._rag.format_context_for_llm.return_value = ""
                            return service


@pytest.fixture
def patched_rag_service(mock_settings, mock_registry):
    """创建 RAGService 实例，注入 mock settings 和 router。"""
    with patch("app.services.rag_service.settings", mock_settings):
        with patch("app.providers.router.settings", mock_settings):
            with patch(
                "app.providers.router.get_registry", return_value=mock_registry
            ):
                from app.services.rag_service import RAGService

                service = RAGService()
                # 不调用 initialize，单独测试各个方法
                service._router = MagicMock()
                service._router.generate_embedding.return_value = [0.1] * 1536
                service._router.generate_embeddings.return_value = [
                    [0.1] * 1536
                ]
                return service