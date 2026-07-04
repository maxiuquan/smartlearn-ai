"""
GLM-4 Flash 供应商

智谱 AI GLM-4 Flash 模型，通过 OpenAI 兼容接口调用。
作为默认聊天主供应商，也用于内容审核。
"""

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import settings
from .openai_compat import OpenAICompatProvider


class GLMProvider(OpenAICompatProvider):
    """GLM-4 Flash 供应商

    智谱 AI 的 GLM 系列模型，通过 OpenAI 兼容接口调用。
    默认模型: glm-4-flash
    用途: 通用聊天、内容审核
    """

    def __init__(
        self,
        api_key: str = "",
        base_url: str = "",
        model_name: str = "",
    ) -> None:
        _api_key = api_key or settings.GLM_API_KEY or ""
        _base_url = base_url or settings.GLM_BASE_URL
        _model_name = model_name or settings.GLM_MODEL

        super().__init__(
            api_key=_api_key,
            base_url=_base_url,
            model_name=_model_name,
            provider_name="glm",
            offline_mode=not _api_key,
        )

    def health_check(self) -> dict[str, Any]:
        result = super().health_check()
        result["supports"] = ["chat", "chat_stream", "moderation"]
        return result


def create_glm_provider() -> GLMProvider:
    """工厂函数：创建 GLM 供应商实例"""
    return GLMProvider()