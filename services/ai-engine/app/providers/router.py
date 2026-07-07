"""
AI 路由层

根据 (capability, subject) 元组将请求路由到最合适的 AI 供应商。
支持主/备供应商切换、配额跟踪、延迟统计和错误计数。

所有方法均为 async，适配 FastAPI 异步事件循环。

## 安全整改（C4）核心语义

本模块严格区分两类结果，杜绝「运行时故障被静默伪装成成功」：

- **离线模拟模式（offline_mode）**：所有 chat 供应商均未配置（无任何 API Key）。
  此时返回模拟内容，但调用方应**显式标注**其为模拟（如 ChatResponse.simulated=true），
  绝不伪装成真实模型输出。

- **运行时故障（runtime failure）**：供应商已配置（非离线）但调用抛 5xx/限流/超时等异常。
  此时不再回退到静默 mock，而是向上抛出 `ProviderUnavailableError`，
  由路由层（chat_router）转换为 HTTP 502/503 并输出结构化日志，使故障可见。

- **内容审核 fail-closed**：审核异常时返回 `flagged=True`（而非静默放行 `flagged=False`）。

- **嵌入向量 fail-closed**：嵌入调用异常时抛出，绝不返回假向量。
"""

import logging
import time
import uuid
from typing import Any, AsyncGenerator, Optional

from .registry import get_registry


logger = logging.getLogger("ai_engine.providers.router")


class ProviderUnavailableError(Exception):
    """所有已配置 provider 均发生运行时故障（非离线）时抛出。"""

    def __init__(
        self,
        provider: str,
        error_type: str,
        message: str,
        trace_id: Optional[str] = None,
    ) -> None:
        self.provider = provider
        self.error_type = error_type
        self.message = message
        self.trace_id = trace_id or uuid.uuid4().hex
        super().__init__(
            f"AI 供应商不可用 provider={provider} error_type={error_type} msg={message}"
        )


# ─── 路由配置 ────────────────────────────────────────────────

# 路由策略: (capability, subject) -> {"primary": provider_name, "fallback": provider_name}
# capability: chat, embedding, tts, stt, image, moderation
# subject: math, english, politics, professional, default, * (通配)
ROUTE_CONFIG: dict[tuple[str, str], dict[str, str]] = {
    ("chat", "math"): {"primary": "deepseek", "fallback": "glm"},
    ("chat", "english"): {"primary": "glm", "fallback": "deepseek"},
    ("chat", "default"): {"primary": "glm", "fallback": "deepseek"},
    ("chat", "politics"): {"primary": "glm", "fallback": "deepseek"},
    ("chat", "professional"): {"primary": "deepseek", "fallback": "glm"},
    ("embedding", "*"): {"primary": "siliconflow"},
    ("tts", "*"): {"primary": "siliconflow"},
    ("stt", "*"): {"primary": "siliconflow"},
    ("image", "*"): {"primary": "cogview", "fallback": "siliconflow"},
    ("moderation", "*"): {"primary": "moderation"},
}


class AIRouter:
    """AI 路由层

    根据能力和学科将请求路由到最佳供应商。
    支持主/备切换、配额跟踪、延迟和错误统计。
    所有方法均为 async。
    """

    def __init__(self) -> None:
        self._registry = get_registry()

        # 统计信息
        self._stats: dict[str, dict[str, Any]] = {
            "total_requests": 0,
            "total_errors": 0,
            "total_latency": 0.0,
        }

        # 每个供应商的统计
        self._provider_stats: dict[str, dict[str, Any]] = {}

    # ── 路由查找 ─────────────────────────────────────────────

    def _resolve_route(
        self, capability: str, subject: str = "default"
    ) -> tuple[str, Optional[str]]:
        """解析路由配置

        Args:
            capability: 能力类型 (chat, embedding, tts, stt, image, moderation)
            subject: 学科 (math, english, politics, professional, default)

        Returns:
            (primary_provider_name, fallback_provider_name)
        """
        # 先精确匹配 (capability, subject)
        key = (capability, subject)
        if key in ROUTE_CONFIG:
            route = ROUTE_CONFIG[key]
            return route["primary"], route.get("fallback")

        # 再通配匹配 (capability, "*")
        key_wild = (capability, "*")
        if key_wild in ROUTE_CONFIG:
            route = ROUTE_CONFIG[key_wild]
            return route["primary"], route.get("fallback")

        # 默认回退到 glm
        return "glm", None

    def _get_provider(self, name: str) -> Any | None:
        """获取供应商实例"""
        return self._registry.get_provider(name)

    def _any_online_provider(self, capability: str, subject: str = "default") -> bool:
        """判断该能力路由是否存在任一在线（已配置、非离线）供应商。"""
        primary_name, fallback_name = self._resolve_route(capability, subject)
        for name in (primary_name, fallback_name):
            if not name:
                continue
            provider = self._get_provider(name)
            if provider is not None and not provider.is_offline:
                return True
        return False

    # ── 统计 ─────────────────────────────────────────────────

    def _record_request(
        self,
        provider_name: str,
        success: bool,
        latency: float,
    ) -> None:
        """记录请求统计"""
        self._stats["total_requests"] += 1
        self._stats["total_latency"] += latency

        if not success:
            self._stats["total_errors"] += 1

        if provider_name not in self._provider_stats:
            self._provider_stats[provider_name] = {
                "requests": 0,
                "errors": 0,
                "total_latency": 0.0,
                "last_error": None,
            }

        ps = self._provider_stats[provider_name]
        ps["requests"] += 1
        ps["total_latency"] += latency
        if not success:
            ps["errors"] += 1

    # ── 聊天路由 ─────────────────────────────────────────────

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        subject: str = "default",
        max_tokens: int = 2048,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """路由聊天补全请求（async）

        Args:
            messages: 消息列表
            subject: 学科
            max_tokens: 最大 token 数
            temperature: 温度参数
            **kwargs: 其他参数

        Returns:
            str: 模型回复

        Raises:
            ProviderUnavailableError: 所有在线供应商均运行时故障（不静默伪装）。
        """
        primary_name, fallback_name = self._resolve_route("chat", subject)
        errors: list[tuple[str, Exception]] = []

        # 尝试主供应商
        provider = self._get_provider(primary_name)
        if provider is not None and not provider.is_offline:
            start = time.time()
            try:
                result = await provider.chat_completion(
                    messages, max_tokens, temperature, **kwargs
                )
                self._record_request(primary_name, True, time.time() - start)
                return result
            except Exception as e:
                self._record_request(primary_name, False, time.time() - start)
                logger.error(
                    "[AIRouter] chat 主供应商 %s 运行时故障: error_type=%s msg=%s",
                    primary_name,
                    type(e).__name__,
                    e,
                )
                errors.append((primary_name, e))

        # 尝试回退供应商
        if fallback_name:
            provider = self._get_provider(fallback_name)
            if provider is not None and not provider.is_offline:
                start = time.time()
                try:
                    result = await provider.chat_completion(
                        messages, max_tokens, temperature, **kwargs
                    )
                    self._record_request(fallback_name, True, time.time() - start)
                    return result
                except Exception as e:
                    self._record_request(fallback_name, False, time.time() - start)
                    logger.error(
                        "[AIRouter] chat 回退供应商 %s 运行时故障: error_type=%s msg=%s",
                        fallback_name,
                        type(e).__name__,
                        e,
                    )
                    errors.append((fallback_name, e))

        # 判断是否离线模式：没有任何在线供应商
        if not self._any_online_provider("chat", subject):
            # 离线模式：返回模拟响应（调用方需显式标注 simulated=true）
            provider = self._get_provider(primary_name)
            if provider is not None:
                logger.info(
                    "[AIRouter] 离线模式：返回模拟响应（主供应商 %s）",
                    primary_name,
                )
                result = await provider.chat_completion(messages, max_tokens, temperature, **kwargs)
                return result
            return "（离线模拟）AI 服务当前处于离线模式，未配置任何供应商。"

        # 运行时故障：所有在线供应商均失败，向上抛出（不再静默 mock）
        last_provider, last_exc = errors[-1]
        raise ProviderUnavailableError(
            provider=last_provider,
            error_type=type(last_exc).__name__,
            message=str(last_exc),
        )

    async def chat_completion_stream(
        self,
        messages: list[dict[str, str]],
        subject: str = "default",
        max_tokens: int = 2048,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """路由流式聊天请求（async generator，与 chat_completion 同样的故障语义）

        Raises:
            ProviderUnavailableError: 所有在线供应商均运行时故障。
        """
        primary_name, fallback_name = self._resolve_route("chat", subject)
        errors: list[tuple[str, Exception]] = []

        # 尝试主供应商
        provider = self._get_provider(primary_name)
        if provider is not None and not provider.is_offline:
            start = time.time()
            try:
                async for chunk in provider.chat_completion_stream(
                    messages, max_tokens, temperature, **kwargs
                ):
                    yield chunk
                self._record_request(primary_name, True, time.time() - start)
                return
            except Exception as e:
                self._record_request(primary_name, False, time.time() - start)
                logger.error(
                    "[AIRouter] 流式 chat 主供应商 %s 运行时故障: error_type=%s msg=%s",
                    primary_name,
                    type(e).__name__,
                    e,
                )
                errors.append((primary_name, e))

        # 尝试回退供应商
        if fallback_name:
            provider = self._get_provider(fallback_name)
            if provider is not None and not provider.is_offline:
                start = time.time()
                try:
                    async for chunk in provider.chat_completion_stream(
                        messages, max_tokens, temperature, **kwargs
                    ):
                        yield chunk
                    self._record_request(fallback_name, True, time.time() - start)
                    return
                except Exception as e:
                    self._record_request(fallback_name, False, time.time() - start)
                    logger.error(
                        "[AIRouter] 流式 chat 回退供应商 %s 运行时故障: error_type=%s msg=%s",
                        fallback_name,
                        type(e).__name__,
                        e,
                    )
                    errors.append((fallback_name, e))

        # 运行时故障：向上抛出
        if errors:
            last_provider, last_exc = errors[-1]
            raise ProviderUnavailableError(
                provider=last_provider,
                error_type=type(last_exc).__name__,
                message=str(last_exc),
            )
        yield "（离线模拟）AI 服务当前处于离线模式，未配置任何供应商。"

    # ── 嵌入路由 ─────────────────────────────────────────────

    async def generate_embedding(self, text: str) -> list[float]:
        """路由嵌入向量请求（async，全局统一使用 SiliconFlow）

        Raises:
            ProviderUnavailableError: 嵌入调用异常时抛出，绝不返回假向量。
        """
        primary_name, _ = self._resolve_route("embedding")
        provider = self._get_provider(primary_name)

        if provider is None or provider.is_offline:
            # 离线：使用确定性占位向量（明确标注为非真实嵌入）
            logger.warning(
                "[AIRouter] embedding 离线/未配置，返回占位向量（非真实语义向量）"
            )
            return self._mock_embedding(text)

        start = time.time()
        try:
            result = await provider.generate_embedding(text)
            self._record_request(primary_name, True, time.time() - start)
            return result
        except Exception as e:
            self._record_request(primary_name, False, time.time() - start)
            logger.error(
                "[AIRouter] embedding 运行时故障: provider=%s error_type=%s msg=%s",
                primary_name,
                type(e).__name__,
                e,
            )
            raise ProviderUnavailableError(
                provider=primary_name,
                error_type=type(e).__name__,
                message=str(e),
            )

    async def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """路由批量嵌入向量请求（async）

        Raises:
            ProviderUnavailableError: 嵌入调用异常时抛出，绝不返回假向量。
        """
        primary_name, _ = self._resolve_route("embedding")
        provider = self._get_provider(primary_name)

        if provider is None or provider.is_offline:
            logger.warning(
                "[AIRouter] batch embedding 离线/未配置，返回占位向量（非真实语义向量）"
            )
            return [self._mock_embedding(t) for t in texts]

        start = time.time()
        try:
            if hasattr(provider, "generate_embeddings"):
                result = await provider.generate_embeddings(texts)
            else:
                result = [await provider.generate_embedding(t) for t in texts]
            self._record_request(primary_name, True, time.time() - start)
            return result
        except Exception as e:
            self._record_request(primary_name, False, time.time() - start)
            logger.error(
                "[AIRouter] batch embedding 运行时故障: provider=%s error_type=%s msg=%s",
                primary_name,
                type(e).__name__,
                e,
            )
            raise ProviderUnavailableError(
                provider=primary_name,
                error_type=type(e).__name__,
                message=str(e),
            )

    def _mock_embedding(self, text: str) -> list[float]:
        """兜底：生成确定性占位向量（仅离线模式使用，非真实语义向量）。"""
        import hashlib

        dim = 1536
        vec = [0.0] * dim
        for ch in text:
            h = int(hashlib.md5(ch.encode()).hexdigest()[:8], 16)
            idx = h % dim
            vec[idx] += 1.0
        norm = sum(v * v for v in vec) ** 0.5
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec

    # ── TTS 路由 ─────────────────────────────────────────────

    async def text_to_speech(
        self,
        text: str,
        voice: str = "default",
        speed: float = 1.0,
        **kwargs: Any,
    ) -> bytes:
        """路由 TTS 请求（async）

        Raises:
            ProviderUnavailableError: 供应商已配置但调用异常时抛出（不静默返回空音频）。
        """
        primary_name, _ = self._resolve_route("tts")
        provider = self._get_provider(primary_name)

        if provider is None or provider.is_offline:
            logger.warning("[AIRouter] TTS 离线/未配置，返回空音频")
            return b""

        start = time.time()
        try:
            result = await provider.text_to_speech(text, voice, speed, **kwargs)
            self._record_request(primary_name, True, time.time() - start)
            return result
        except Exception as e:
            self._record_request(primary_name, False, time.time() - start)
            logger.error(
                "[AIRouter] TTS 运行时故障: provider=%s error_type=%s msg=%s",
                primary_name,
                type(e).__name__,
                e,
            )
            raise ProviderUnavailableError(
                provider=primary_name,
                error_type=type(e).__name__,
                message=str(e),
            )

    # ── STT 路由 ─────────────────────────────────────────────

    async def speech_to_text(
        self,
        audio_data: bytes,
        language: str = "zh",
        **kwargs: Any,
    ) -> str:
        """路由 STT 请求（async）

        Raises:
            ProviderUnavailableError: 供应商已配置但调用异常时抛出（不静默返回空文本）。
        """
        primary_name, _ = self._resolve_route("stt")
        provider = self._get_provider(primary_name)

        if provider is None or provider.is_offline:
            logger.warning("[AIRouter] STT 离线/未配置，返回空识别结果")
            return ""

        start = time.time()
        try:
            result = await provider.speech_to_text(audio_data, language, **kwargs)
            self._record_request(primary_name, True, time.time() - start)
            return result
        except Exception as e:
            self._record_request(primary_name, False, time.time() - start)
            logger.error(
                "[AIRouter] STT 运行时故障: provider=%s error_type=%s msg=%s",
                primary_name,
                type(e).__name__,
                e,
            )
            raise ProviderUnavailableError(
                provider=primary_name,
                error_type=type(e).__name__,
                message=str(e),
            )

    # ── 图像路由 ─────────────────────────────────────────────

    async def generate_image(
        self,
        prompt: str,
        size: str = "1024x1024",
        n: int = 1,
        **kwargs: Any,
    ) -> list[str]:
        """路由图像生成请求（async）

        Raises:
            ProviderUnavailableError: 供应商已配置但调用异常时抛出。
        """
        primary_name, fallback_name = self._resolve_route("image")

        # 尝试主供应商
        provider = self._get_provider(primary_name)
        if provider is not None and not provider.is_offline:
            start = time.time()
            try:
                result = await provider.generate_image(prompt, size, n, **kwargs)
                self._record_request(primary_name, True, time.time() - start)
                return result
            except Exception as e:
                self._record_request(primary_name, False, time.time() - start)
                logger.error(
                    "[AIRouter] 图像主供应商 %s 运行时故障: error_type=%s msg=%s",
                    primary_name,
                    type(e).__name__,
                    e,
                )

        # 尝试回退
        if fallback_name:
            provider = self._get_provider(fallback_name)
            if provider is not None and not provider.is_offline:
                start = time.time()
                try:
                    result = await provider.generate_image(prompt, size, n, **kwargs)
                    self._record_request(fallback_name, True, time.time() - start)
                    return result
                except Exception as e:
                    self._record_request(fallback_name, False, time.time() - start)
                    logger.error(
                        "[AIRouter] 图像回退供应商 %s 运行时故障: error_type=%s msg=%s",
                        fallback_name,
                        type(e).__name__,
                        e,
                    )

        # 离线：返回空列表
        provider = self._get_provider(primary_name)
        if provider is None or provider.is_offline:
            logger.warning("[AIRouter] 图像生成离线/未配置，返回空列表")
            return []
        raise ProviderUnavailableError(
            provider=primary_name,
            error_type="ImageGenerationError",
            message="所有图像生成供应商均不可用",
        )

    # ── 审核路由 ─────────────────────────────────────────────

    async def moderate(
        self,
        text: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """路由内容审核请求（async，fail-closed）

        审核供应商调用异常时，返回 `flagged=True` 并告警，而非静默放行
        （漏放违规内容）。未配置审核供应商时也按 fail-closed 标记。

        Returns:
            dict: 审核结果（正常结果或 fail-closed 的 flagged=True 结果）。
        """
        primary_name, _ = self._resolve_route("moderation")
        provider = self._get_provider(primary_name)

        if provider is None:
            logger.warning(
                "[AIRouter] 未配置审核供应商，按 fail-closed 标记 flagged=True"
            )
            return {
                "flagged": True,
                "categories": ["moderation_unavailable"],
                "reason": "审核服务不可用（未配置），安全起见标记为违规",
                "confidence": 1.0,
            }

        start = time.time()
        try:
            result = await provider.moderate(text, **kwargs)
            self._record_request(primary_name, True, time.time() - start)
            # 确保返回结构完整
            result.setdefault("flagged", False)
            return result
        except Exception as e:
            self._record_request(primary_name, False, time.time() - start)
            logger.error(
                "[AIRouter] 内容审核失败（fail-closed，标记 flagged=True）: "
                "provider=%s error_type=%s msg=%s",
                primary_name,
                type(e).__name__,
                e,
            )
            return {
                "flagged": True,
                "categories": ["error"],
                "reason": f"审核服务异常: {type(e).__name__}",
                "confidence": 1.0,
            }

    # ── 统计查询 ─────────────────────────────────────────────

    def get_stats(self) -> dict[str, Any]:
        """获取路由统计信息"""
        avg_latency = 0.0
        if self._stats["total_requests"] > 0:
            avg_latency = self._stats["total_latency"] / self._stats["total_requests"]

        return {
            "total_requests": self._stats["total_requests"],
            "total_errors": self._stats["total_errors"],
            "avg_latency": round(avg_latency, 4),
            "error_rate": (
                round(self._stats["total_errors"] / self._stats["total_requests"], 4)
                if self._stats["total_requests"] > 0
                else 0.0
            ),
            "providers": dict(self._provider_stats),
        }

    def get_route_config(self) -> dict:
        """获取当前路由配置"""
        return {f"{cap}:{subj}": route for (cap, subj), route in ROUTE_CONFIG.items()}


# ── 全局单例 ────────────────────────────────────────────────

_router: AIRouter | None = None


def get_router() -> AIRouter:
    """获取 AIRouter 单例"""
    global _router
    if _router is None:
        _router = AIRouter()
    return _router
