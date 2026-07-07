"""
内容审核供应商

使用 GLM 模型进行内容安全审核。
"""

import logging
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import settings
from .base import BaseModerationProvider

logger = logging.getLogger("ai_engine.providers.moderation")


class ModerationProvider(BaseModerationProvider):
    """内容审核供应商

    使用 LLM 进行内容安全审核，检测违规内容。
    """

    MODERATION_PROMPT = """你是一个内容安全审核助手。请审核以下文本，判断是否包含以下违规内容：

1. 色情/低俗内容
2. 暴力/恐怖内容
3. 政治敏感内容
4. 违法/犯罪内容
5. 人身攻击/辱骂
6. 广告/垃圾信息
7. 其他不当内容

请以 JSON 格式返回审核结果：
{
    "flagged": true/false,
    "categories": ["违规类别1", "违规类别2"],
    "reason": "审核理由",
    "confidence": 0.0-1.0
}

待审核文本：
{text}"""

    def __init__(
        self,
        api_key: str = "",
        base_url: str = "",
        model_name: str = "",
    ) -> None:
        self._api_key = api_key or settings.GLM_API_KEY or ""
        self._base_url = base_url or settings.GLM_BASE_URL
        self._model_name = model_name or settings.GLM_MODEL
        self._provider_name = "moderation"
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

    # ── BaseModerationProvider 实现 ──────────────────────────

    def moderate(
        self,
        text: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """审核文本内容"""
        if self._offline_mode:
            return self._mock_moderate(text)

        start_time = time.time()
        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=self._api_key,
                base_url=self._base_url,
            )
            prompt = self.MODERATION_PROMPT.format(text=text)

            response = client.chat.completions.create(
                model=self._model_name,
                messages=[
                    {"role": "system", "content": "你是一个内容安全审核助手。请始终以 JSON 格式返回审核结果。"},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=256,
                temperature=0.1,
            )
            elapsed = time.time() - start_time

            content = response.choices[0].message.content or "{}"
            usage = response.usage

            # 尝试解析 JSON
            import json
            try:
                result = json.loads(content)
            except json.JSONDecodeError:
                # fail-closed：解析失败视为风险内容，标记为 flagged=True 而非放行
                logger.warning(
                    "[moderation] 审核结果解析失败（fail-closed），"
                    "视为风险内容, model=%s, content=%s",
                    self._model_name,
                    content[:200],
                )
                result = {
                    "flagged": True,
                    "categories": ["parse_error"],
                    "reason": "无法解析审核结果（fail-closed）",
                    "confidence": 1.0,
                }

            print(
                f"[moderation] moderate | "
                f"model={self._model_name} | "
                f"flagged={result.get('flagged', False)} | "
                f"latency={elapsed:.3f}s"
            )
            return result

        except Exception as e:
            elapsed = time.time() - start_time
            # 在线调用异常：向上抛出，由 AIRouter 统一 fail-closed（flagged=True）
            logger.error(
                "[moderation] moderate 在线调用失败 (耗时 %.2fs): %s",
                elapsed,
                e,
            )
            raise

    def _mock_moderate(self, text: str) -> dict[str, Any]:
        """离线模式：始终放行"""
        print(f"[moderation] 离线模式，审核跳过: {text[:50]}...")
        return {
            "flagged": False,
            "categories": [],
            "reason": "离线模式，审核跳过",
            "confidence": 0.0,
            "offline": True,
        }

    # ── 健康检查 ─────────────────────────────────────────────

    def health_check(self) -> dict[str, Any]:
        if self._offline_mode:
            return {
                "status": "offline",
                "provider": self._provider_name,
                "model": self._model_name,
                "offline": True,
                "supports": ["moderation"],
            }

        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=self._api_key,
                base_url=self._base_url,
            )
            client.models.list()
            return {
                "status": "ok",
                "provider": self._provider_name,
                "model": self._model_name,
                "offline": False,
                "supports": ["moderation"],
            }
        except Exception as e:
            return {
                "status": "error",
                "provider": self._provider_name,
                "model": self._model_name,
                "offline": False,
                "supports": ["moderation"],
                "error": str(e),
            }


def create_moderation_provider() -> ModerationProvider:
    """工厂函数：创建内容审核供应商实例"""
    return ModerationProvider()