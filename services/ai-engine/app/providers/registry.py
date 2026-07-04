"""
Provider 注册中心

单例模式管理所有 AI 供应商实例，支持懒加载和按需初始化。
"""

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import settings


class ProviderRegistry:
    """Provider 注册中心（单例）

    管理所有 AI 供应商实例，支持：
    - 懒加载：只在首次使用时初始化
    - 按需注册：可以通过 register_provider 动态注册
    - 离线模式：API Key 未配置时自动进入离线模式
    """

    _instance: "ProviderRegistry | None" = None

    def __new__(cls) -> "ProviderRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._providers: dict[str, Any] = {}
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        # __init__ 在每次调用时都会执行，但 _initialized 确保只初始化一次
        pass

    # ── 注册 ─────────────────────────────────────────────────

    def register_provider(self, name: str, provider: Any) -> None:
        """注册一个供应商实例

        Args:
            name: 供应商标识名称 (如 "glm", "deepseek", "siliconflow")
            provider: 供应商实例
        """
        self._providers[name] = provider
        status = "offline" if getattr(provider, "is_offline", False) else "online"
        print(f"[ProviderRegistry] 注册供应商: {name} ({status})")

    def get_provider(self, name: str) -> Any | None:
        """获取指定名称的供应商

        Args:
            name: 供应商标识名称

        Returns:
            供应商实例，如果不存在返回 None
        """
        self._ensure_initialized()
        return self._providers.get(name)

    def get_chat_provider(self, name: str = "glm") -> Any | None:
        """获取聊天供应商

        Args:
            name: 供应商名称，默认 "glm"

        Returns:
            聊天供应商实例
        """
        return self.get_provider(name)

    def get_embedding_provider(self) -> Any | None:
        """获取嵌入向量供应商（全局统一使用 SiliconFlow）"""
        return self.get_provider("siliconflow")

    def get_tts_provider(self) -> Any | None:
        """获取 TTS 供应商"""
        return self.get_provider("siliconflow")

    def get_stt_provider(self) -> Any | None:
        """获取 STT 供应商"""
        return self.get_provider("siliconflow")

    def get_image_provider(self) -> Any | None:
        """获取图像生成供应商"""
        return self.get_provider("cogview")

    def get_moderation_provider(self) -> Any | None:
        """获取内容审核供应商"""
        return self.get_provider("moderation")

    # ── 初始化 ───────────────────────────────────────────────

    def _ensure_initialized(self) -> None:
        """确保供应商已初始化（懒加载）"""
        if self._initialized:
            return
        self._initialized = True
        self._init_all_providers()

    def _init_all_providers(self) -> None:
        """初始化所有供应商"""
        # GLM - 聊天主供应商
        if "glm" not in self._providers:
            try:
                from .glm import create_glm_provider
                self.register_provider("glm", create_glm_provider())
            except Exception as e:
                print(f"[ProviderRegistry] GLM 初始化失败: {e}")

        # DeepSeek - 高难度问题供应商
        if "deepseek" not in self._providers:
            try:
                from .deepseek import create_deepseek_provider
                self.register_provider("deepseek", create_deepseek_provider())
            except Exception as e:
                print(f"[ProviderRegistry] DeepSeek 初始化失败: {e}")

        # SiliconFlow - 嵌入/TTS/STT
        if "siliconflow" not in self._providers:
            try:
                from .siliconflow import create_siliconflow_provider
                self.register_provider("siliconflow", create_siliconflow_provider())
            except Exception as e:
                print(f"[ProviderRegistry] SiliconFlow 初始化失败: {e}")

        # CogView - 图像生成
        if "cogview" not in self._providers:
            try:
                from .cogview import create_cogview_provider
                self.register_provider("cogview", create_cogview_provider())
            except Exception as e:
                print(f"[ProviderRegistry] CogView 初始化失败: {e}")

        # Moderation - 内容审核
        if "moderation" not in self._providers:
            try:
                from .moderation import create_moderation_provider
                self.register_provider("moderation", create_moderation_provider())
            except Exception as e:
                print(f"[ProviderRegistry] Moderation 初始化失败: {e}")

    # ── 工具方法 ─────────────────────────────────────────────

    def list_providers(self) -> list[dict[str, Any]]:
        """列出所有已注册的供应商"""
        self._ensure_initialized()
        result: list[dict[str, Any]] = []
        for name, provider in self._providers.items():
            info = {
                "name": name,
                "offline": getattr(provider, "is_offline", False),
            }
            if hasattr(provider, "model_name"):
                info["model"] = provider.model_name
            result.append(info)
        return result

    def health_check_all(self) -> dict[str, Any]:
        """检查所有供应商健康状态"""
        self._ensure_initialized()
        result: dict[str, Any] = {}
        for name, provider in self._providers.items():
            try:
                result[name] = provider.health_check()
            except Exception as e:
                result[name] = {
                    "status": "error",
                    "provider": name,
                    "error": str(e),
                }
        return result

    def clear(self) -> None:
        """清除所有已注册的供应商（用于测试或重置）"""
        self._providers.clear()
        self._initialized = False


# ── 全局单例 ────────────────────────────────────────────────

_registry: ProviderRegistry | None = None


def get_registry() -> ProviderRegistry:
    """获取 ProviderRegistry 单例"""
    global _registry
    if _registry is None:
        _registry = ProviderRegistry()
    return _registry