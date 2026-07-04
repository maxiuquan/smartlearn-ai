"""
DeepSeek 供应商

DeepSeek V4 Flash 模型，通过 OpenAI 兼容接口调用。
用于处理高难度问题（数学、逻辑推理等）。
"""

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import settings
from .openai_compat import OpenAICompatProvider


class DeepSeekProvider(OpenAICompatProvider):
    """DeepSeek 供应商

    DeepSeek 模型，通过 OpenAI 兼容接口调用。
    默认模型: deepseek-chat
    用途: 高难度问题（数学、逻辑推理等）
    """

    def __init__(
        self,
        api_key: str = "",
        base_url: str = "",
        model_name: str = "",
    ) -> None:
        _api_key = api_key or settings.DEEPSEEK_API_KEY or ""
        _base_url = base_url or settings.DEEPSEEK_BASE_URL
        _model_name = model_name or settings.DEEPSEEK_MODEL

        super().__init__(
            api_key=_api_key,
            base_url=_base_url,
            model_name=_model_name,
            provider_name="deepseek",
            offline_mode=not _api_key,
        )

    def health_check(self) -> dict[str, Any]:
        result = super().health_check()
        result["supports"] = ["chat", "chat_stream", "reasoning"]
        return result


def create_deepseek_provider() -> DeepSeekProvider:
    """工厂函数：创建 DeepSeek 供应商实例"""
    return DeepSeekProvider()