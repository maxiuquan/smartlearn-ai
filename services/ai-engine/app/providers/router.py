"""
AI 路由层

根据 (capability, subject) 元组将请求路由到最合适的 AI 供应商。
支持主/备供应商切换、配额跟踪、延迟统计和错误计数。
"""

import time
from typing import Any, Generator

from .registry import get_registry


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
    ("moderation", "*"): {"primary": "glm"},
}


class AIRouter:
    """AI 路由层

    根据能力和学科将请求路由到最佳供应商。
    支持主/备切换、配额跟踪、延迟和错误统计。
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
    ) -> tuple[str, str | None]:
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

    def chat_completion(
        self,
        messages: list[dict[str, str]],
        subject: str = "default",
        max_tokens: int = 2048,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """路由聊天补全请求

        Args:
            messages: 消息列表
            subject: 学科
            max_tokens: 最大 token 数
            temperature: 温度参数
            **kwargs: 其他参数

        Returns:
            str: 模型回复
        """
        primary_name, fallback_name = self._resolve_route("chat", subject)

        # 尝试主供应商
        provider = self._get_provider(primary_name)
        if provider is not None and not provider.is_offline:
            start = time.time()
            try:
                result = provider.chat_completion(
                    messages, max_tokens, temperature, **kwargs
                )
                self._record_request(primary_name, True, time.time() - start)
                return result
            except Exception as e:
                self._record_request(primary_name, False, time.time() - start)
                print(f"[AIRouter] 主供应商 {primary_name} 失败: {e}，尝试回退...")

        # 尝试回退供应商
        if fallback_name:
            provider = self._get_provider(fallback_name)
            if provider is not None and not provider.is_offline:
                start = time.time()
                try:
                    result = provider.chat_completion(
                        messages, max_tokens, temperature, **kwargs
                    )
                    self._record_request(fallback_name, True, time.time() - start)
                    return result
                except Exception as e:
                    self._record_request(fallback_name, False, time.time() - start)
                    print(f"[AIRouter] 回退供应商 {fallback_name} 也失败: {e}")

        # 所有供应商都失败，尝试离线模式
        provider = self._get_provider(primary_name)
        if provider is not None:
            return provider.chat_completion(messages, max_tokens, temperature, **kwargs)

        # 最后的兜底
        return "抱歉，AI 服务暂时不可用，请稍后重试。"

    def chat_completion_stream(
        self,
        messages: list[dict[str, str]],
        subject: str = "default",
        max_tokens: int = 2048,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> Generator[str, None, None]:
        """路由流式聊天请求

        Args:
            messages: 消息列表
            subject: 学科
            max_tokens: 最大 token 数
            temperature: 温度参数
            **kwargs: 其他参数

        Yields:
            str: 增量文本
        """
        primary_name, fallback_name = self._resolve_route("chat", subject)

        # 尝试主供应商
        provider = self._get_provider(primary_name)
        if provider is not None and not provider.is_offline:
            start = time.time()
            try:
                for chunk in provider.chat_completion_stream(
                    messages, max_tokens, temperature, **kwargs
                ):
                    yield chunk
                self._record_request(primary_name, True, time.time() - start)
                return
            except Exception as e:
                self._record_request(primary_name, False, time.time() - start)
                print(f"[AIRouter] 流式主供应商 {primary_name} 失败: {e}，尝试回退...")

        # 尝试回退供应商
        if fallback_name:
            provider = self._get_provider(fallback_name)
            if provider is not None and not provider.is_offline:
                start = time.time()
                try:
                    for chunk in provider.chat_completion_stream(
                        messages, max_tokens, temperature, **kwargs
                    ):
                        yield chunk
                    self._record_request(fallback_name, True, time.time() - start)
                    return
                except Exception as e:
                    self._record_request(fallback_name, False, time.time() - start)
                    print(f"[AIRouter] 流式回退供应商 {fallback_name} 也失败: {e}")

        # 兜底
        provider = self._get_provider(primary_name)
        if provider is not None:
            for chunk in provider.chat_completion_stream(
                messages, max_tokens, temperature, **kwargs
            ):
                yield chunk
        else:
            yield "抱歉，AI 服务暂时不可用，请稍后重试。"

    # ── 嵌入路由 ─────────────────────────────────────────────

    def generate_embedding(self, text: str) -> list[float]:
        """路由嵌入向量请求（全局统一使用 SiliconFlow）"""
        primary_name, _ = self._resolve_route("embedding")
        provider = self._get_provider(primary_name)

        if provider is None:
            return self._mock_embedding(text)

        start = time.time()
        try:
            result = provider.generate_embedding(text)
            self._record_request(primary_name, True, time.time() - start)
            return result
        except Exception as e:
            self._record_request(primary_name, False, time.time() - start)
            print(f"[AIRouter] embedding 失败: {e}")
            return self._mock_embedding(text)

    def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """路由批量嵌入向量请求"""
        primary_name, _ = self._resolve_route("embedding")
        provider = self._get_provider(primary_name)

        if provider is None:
            return [self._mock_embedding(t) for t in texts]

        start = time.time()
        try:
            # 优先使用批量方法
            if hasattr(provider, "generate_embeddings"):
                result = provider.generate_embeddings(texts)
            else:
                result = [provider.generate_embedding(t) for t in texts]
            self._record_request(primary_name, True, time.time() - start)
            return result
        except Exception as e:
            self._record_request(primary_name, False, time.time() - start)
            print(f"[AIRouter] batch_embedding 失败: {e}")
            return [self._mock_embedding(t) for t in texts]

    def _mock_embedding(self, text: str) -> list[float]:
        """兜底：生成模拟嵌入向量"""
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

    def text_to_speech(
        self,
        text: str,
        voice: str = "default",
        speed: float = 1.0,
        **kwargs: Any,
    ) -> bytes:
        """路由 TTS 请求"""
        primary_name, _ = self._resolve_route("tts")
        provider = self._get_provider(primary_name)

        if provider is None:
            return b""

        start = time.time()
        try:
            result = provider.text_to_speech(text, voice, speed, **kwargs)
            self._record_request(primary_name, True, time.time() - start)
            return result
        except Exception as e:
            self._record_request(primary_name, False, time.time() - start)
            print(f"[AIRouter] TTS 失败: {e}")
            return b""

    # ── STT 路由 ─────────────────────────────────────────────

    def speech_to_text(
        self,
        audio_data: bytes,
        language: str = "zh",
        **kwargs: Any,
    ) -> str:
        """路由 STT 请求"""
        primary_name, _ = self._resolve_route("stt")
        provider = self._get_provider(primary_name)

        if provider is None:
            return ""

        start = time.time()
        try:
            result = provider.speech_to_text(audio_data, language, **kwargs)
            self._record_request(primary_name, True, time.time() - start)
            return result
        except Exception as e:
            self._record_request(primary_name, False, time.time() - start)
            print(f"[AIRouter] STT 失败: {e}")
            return ""

    # ── 图像路由 ─────────────────────────────────────────────

    def generate_image(
        self,
        prompt: str,
        size: str = "1024x1024",
        n: int = 1,
        **kwargs: Any,
    ) -> list[str]:
        """路由图像生成请求"""
        primary_name, fallback_name = self._resolve_route("image")

        # 尝试主供应商
        provider = self._get_provider(primary_name)
        if provider is not None and not provider.is_offline:
            start = time.time()
            try:
                result = provider.generate_image(prompt, size, n, **kwargs)
                self._record_request(primary_name, True, time.time() - start)
                return result
            except Exception as e:
                self._record_request(primary_name, False, time.time() - start)
                print(f"[AIRouter] 图像主供应商 {primary_name} 失败: {e}")

        # 尝试回退
        if fallback_name:
            provider = self._get_provider(fallback_name)
            if provider is not None and not provider.is_offline:
                start = time.time()
                try:
                    result = provider.generate_image(prompt, size, n, **kwargs)
                    self._record_request(fallback_name, True, time.time() - start)
                    return result
                except Exception as e:
                    self._record_request(fallback_name, False, time.time() - start)

        # 兜底
        provider = self._get_provider(primary_name)
        if provider is not None:
            return provider.generate_image(prompt, size, n, **kwargs)
        return []

    # ── 审核路由 ─────────────────────────────────────────────

    def moderate(
        self,
        text: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """路由内容审核请求"""
        primary_name, _ = self._resolve_route("moderation")
        provider = self._get_provider(primary_name)

        if provider is None:
            return {"flagged": False, "categories": [], "reason": "无审核供应商", "confidence": 0.0}

        start = time.time()
        try:
            result = provider.moderate(text, **kwargs)
            self._record_request(primary_name, True, time.time() - start)
            return result
        except Exception as e:
            self._record_request(primary_name, False, time.time() - start)
            print(f"[AIRouter] moderation 失败: {e}")
            return {"flagged": False, "categories": [], "reason": "审核失败", "confidence": 0.0}

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