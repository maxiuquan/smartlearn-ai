"""
CogView 图像生成供应商

智谱 AI CogView-3 Flash 模型，用于图像生成。
通过智谱 API 调用（非 OpenAI 兼容接口）。
"""

import logging
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import settings
from .base import BaseImageProvider, BaseProvider

logger = logging.getLogger("ai_engine.providers.cogview")


class CogViewProvider(BaseImageProvider):
    """CogView 图像生成供应商

    智谱 AI 的 CogView 模型，用于图像生成。
    默认模型: cogview-3-flash
    """

    def __init__(
        self,
        api_key: str = "",
        base_url: str = "",
        model_name: str = "",
    ) -> None:
        self._api_key = api_key or settings.COGVIEW_API_KEY or ""
        self._base_url = base_url or settings.COGVIEW_BASE_URL
        self._model_name = model_name or settings.COGVIEW_MODEL
        self._provider_name = "cogview"
        self._offline_mode = not self._api_key

    # ── 属性 ─────────────────────────────────────────────────

    @property
    def provider_name(self) -> str:
        return self._provider_name

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def is_offline(self) -> bool:
        return self._offline_mode

    # ── BaseImageProvider 实现 ───────────────────────────────

    def generate_image(
        self,
        prompt: str,
        size: str = "1024x1024",
        n: int = 1,
        **kwargs: Any,
    ) -> list[str]:
        """生成图像"""
        if self._offline_mode:
            return self._mock_image(prompt)

        start_time = time.time()
        try:
            import httpx

            headers = {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self._model_name,
                "prompt": prompt,
                "size": size,
                "n": n,
                **kwargs,
            }
            resp = httpx.post(
                f"{self._base_url}/images/generations",
                json=payload,
                headers=headers,
                timeout=120.0,
            )
            resp.raise_for_status()
            elapsed = time.time() - start_time

            data = resp.json()
            urls = [img.get("url", "") for img in data.get("data", [])]
            if not any(urls):
                # 在线模式返回不合法（无有效图片 URL）时，明确抛出而非静默占位
                raise RuntimeError(
                    f"[cogview] 图像生成返回不合法：响应中未包含有效图片 URL，"
                    f"model={self._model_name}"
                )
            print(
                f"[cogview] image_generation | "
                f"model={self._model_name} | "
                f"n={n} | "
                f"latency={elapsed:.3f}s"
            )
            return urls

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                "[cogview] image_generation 在线调用失败 (耗时 %.2fs): %s",
                elapsed,
                e,
            )
            # 在线模式：异常时不再静默返回占位 SVG，直接抛出清晰异常
            raise RuntimeError(
                f"[cogview] 图像生成在线调用失败: {e}"
            ) from e

    def _mock_image(self, prompt: str) -> list[str]:
        """离线模式：返回占位图"""
        print(f"[cogview] 离线模式，无法生成图像，prompt: {prompt[:50]}...")
        return [
            "data:image/svg+xml;base64,"
            "PHN2ZyB3aWR0aD0iMTAyNCIgaGVpZ2h0PSIxMDI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPg"
            "ogIDxyZWN0IHdpZHRoPSIxMDI0IiBoZWlnaHQ9IjEwMjQiIGZpbGw9IiNlZWUiLz4KICA8dGV4dCB4PSI1MTIiIHk9Ij"
            "UxMiIgZm9udC1zaXplPSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IiM5OTkiPgogICAg"
            "Q29nVmlldyDnprvluqbmqKHlvI8KICA8L3RleHQ+Cjwvc3ZnPg=="
        ]

    # ── 健康检查 ─────────────────────────────────────────────

    def health_check(self) -> dict[str, Any]:
        if self._offline_mode:
            return {
                "status": "offline",
                "provider": self._provider_name,
                "model": self._model_name,
                "offline": True,
                "supports": ["image"],
            }

        try:
            import httpx

            headers = {"Authorization": f"Bearer {self._api_key}"}
            resp = httpx.get(
                f"{self._base_url}/models",
                headers=headers,
                timeout=10.0,
            )
            return {
                "status": "ok" if resp.status_code == 200 else "error",
                "provider": self._provider_name,
                "model": self._model_name,
                "offline": False,
                "supports": ["image"],
            }
        except Exception as e:
            return {
                "status": "error",
                "provider": self._provider_name,
                "model": self._model_name,
                "offline": False,
                "supports": ["image"],
                "error": str(e),
            }


def create_cogview_provider() -> CogViewProvider:
    """工厂函数：创建 CogView 供应商实例"""
    return CogViewProvider()