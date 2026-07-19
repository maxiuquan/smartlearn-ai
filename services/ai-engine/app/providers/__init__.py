"""
AI 供应商模块

提供多 AI 供应商架构，包括：
- 抽象基类（base）
- OpenAI 兼容适配器（openai_compat）
- 各供应商实现（glm, deepseek, siliconflow, cogview, moderation）
- 供应商注册中心（registry）
- AI 路由层（router）
"""

from .base import (
    BaseProvider,
    BaseChatProvider,
    BaseEmbeddingProvider,
    BaseTTSProvider,
    BaseSTTProvider,
    BaseImageProvider,
    BaseModerationProvider,
)
from .openai_compat import OpenAICompatProvider
from .registry import ProviderRegistry, get_registry
from .router import AIRouter, get_router, ROUTE_CONFIG, ProviderUnavailableError

__all__ = [
    # 基类
    "BaseProvider",
    "BaseChatProvider",
    "BaseEmbeddingProvider",
    "BaseTTSProvider",
    "BaseSTTProvider",
    "BaseImageProvider",
    "BaseModerationProvider",
    # 适配器
    "OpenAICompatProvider",
    # 注册中心
    "ProviderRegistry",
    "get_registry",
    # 路由
    "AIRouter",
    "get_router",
    "ROUTE_CONFIG",
    "ProviderUnavailableError",
]