"""
OpenAI 兼容接口适配器

封装任何兼容 OpenAI API 的供应商，提供统一的 chat_completion、
chat_completion_stream 和 generate_embedding 接口。
"""

import logging
import time
from typing import Any, Generator

from .base import BaseChatProvider, BaseEmbeddingProvider

logger = logging.getLogger("ai_engine.providers.openai_compat")


class OpenAICompatProvider(BaseChatProvider, BaseEmbeddingProvider):
    """OpenAI 兼容接口适配器

    支持配置任意 base_url、api_key、model_name，适配任何兼容 OpenAI API 的供应商。
    同时实现 BaseChatProvider 和 BaseEmbeddingProvider。
    """

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model_name: str = "gpt-4o-mini",
        provider_name: str = "openai_compat",
        offline_mode: bool = False,
    ) -> None:
        """初始化 OpenAI 兼容适配器

        Args:
            api_key: API 密钥
            base_url: API 基础 URL
            model_name: 模型名称
            provider_name: 供应商标识名称
            offline_mode: 是否离线模式
        """
        self._api_key = api_key
        self._base_url = base_url
        self._model_name = model_name
        self._provider_name = provider_name
        self._offline_mode = offline_mode or not api_key

        # 延迟创建客户端
        self._client: Any = None

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

    # ── 客户端懒加载 ─────────────────────────────────────────

    def _get_client(self) -> Any:
        """获取或创建 OpenAI 客户端"""
        if self._client is None and not self._offline_mode:
            from openai import OpenAI

            self._client = OpenAI(
                api_key=self._api_key,
                base_url=self._base_url,
            )
        return self._client

    # ── BaseChatProvider 实现 ────────────────────────────────

    def chat_completion(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 2048,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """同步聊天补全"""
        if self._offline_mode:
            return self._mock_chat_response(messages)

        start_time = time.time()
        try:
            client = self._get_client()
            if client is None:
                return self._mock_chat_response(messages)

            response = client.chat.completions.create(
                model=self._model_name,
                messages=messages,  # type: ignore[arg-type]
                max_tokens=max_tokens,
                temperature=temperature,
                **kwargs,
            )
            elapsed = time.time() - start_time

            content = response.choices[0].message.content or ""
            usage = response.usage
            if usage:
                self._log_cost(
                    operation="chat_completion",
                    model=self._model_name,
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens,
                    latency=elapsed,
                )
            return content

        except Exception as e:
            elapsed = time.time() - start_time
            # 在线调用异常：向上抛出，由 AIRouter 区分离线模拟与运行时故障
            logger.error(
                "[%s] chat_completion 在线调用失败 (耗时 %.2fs): %s",
                self._provider_name,
                elapsed,
                e,
            )
            raise

    def chat_completion_stream(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 2048,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> Generator[str, None, None]:
        """流式聊天补全"""
        if self._offline_mode:
            yield self._mock_chat_response(messages)
            return

        start_time = time.time()
        try:
            client = self._get_client()
            if client is None:
                yield self._mock_chat_response(messages)
                return

            stream = client.chat.completions.create(
                model=self._model_name,
                messages=messages,  # type: ignore[arg-type]
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True,
                stream_options={"include_usage": True},
                **kwargs,
            )

            total_chars = 0
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    total_chars += len(content)
                    yield content

            elapsed = time.time() - start_time
            print(f"[{self._provider_name}] stream_completion 完成 "
                  f"(耗时 {elapsed:.2f}s, 输出 {total_chars} 字符)")

        except Exception as e:
            elapsed = time.time() - start_time
            # 在线调用异常：向上抛出，由 AIRouter 区分离线模拟与运行时故障
            logger.error(
                "[%s] stream_completion 在线调用失败 (耗时 %.2fs): %s",
                self._provider_name,
                elapsed,
                e,
            )
            raise

    # ── BaseEmbeddingProvider 实现 ───────────────────────────

    def generate_embedding(self, text: str) -> list[float]:
        """生成单个文本嵌入向量"""
        if self._offline_mode:
            return self._mock_embedding(text)

        start_time = time.time()
        try:
            client = self._get_client()
            if client is None:
                return self._mock_embedding(text)

            response = client.embeddings.create(
                model=self._model_name,
                input=[text],
            )
            elapsed = time.time() - start_time

            embedding = response.data[0].embedding
            usage = response.usage
            if usage:
                self._log_cost(
                    operation="embedding",
                    model=self._model_name,
                    prompt_tokens=usage.prompt_tokens,
                    latency=elapsed,
                )
            return embedding

        except Exception as e:
            elapsed = time.time() - start_time
            # 在线调用异常：向上抛出，绝不返回假向量
            logger.error(
                "[%s] generate_embedding 在线调用失败 (耗时 %.2fs): %s",
                self._provider_name,
                elapsed,
                e,
            )
            raise

    def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """批量生成嵌入向量"""
        if self._offline_mode:
            return [self._mock_embedding(t) for t in texts]

        start_time = time.time()
        try:
            client = self._get_client()
            if client is None:
                return [self._mock_embedding(t) for t in texts]

            response = client.embeddings.create(
                model=self._model_name,
                input=texts,
            )
            elapsed = time.time() - start_time

            embeddings = [d.embedding for d in response.data]
            usage = response.usage
            if usage:
                self._log_cost(
                    operation="batch_embedding",
                    model=self._model_name,
                    prompt_tokens=usage.prompt_tokens,
                    latency=elapsed,
                )
            return embeddings

        except Exception as e:
            elapsed = time.time() - start_time
            # 在线调用异常：向上抛出，绝不返回假向量
            logger.error(
                "[%s] batch_embedding 在线调用失败 (耗时 %.2fs): %s",
                self._provider_name,
                elapsed,
                e,
            )
            raise

    # ── 健康检查 ─────────────────────────────────────────────

    def health_check(self) -> dict[str, Any]:
        """健康检查"""
        if self._offline_mode:
            return {
                "status": "offline",
                "provider": self._provider_name,
                "model": self._model_name,
                "offline": True,
            }

        try:
            client = self._get_client()
            if client is None:
                return {
                    "status": "offline",
                    "provider": self._provider_name,
                    "model": self._model_name,
                    "offline": True,
                }
            # 简单测试调用
            client.models.list()
            return {
                "status": "ok",
                "provider": self._provider_name,
                "model": self._model_name,
                "offline": False,
                "base_url": self._base_url,
            }
        except Exception as e:
            return {
                "status": "error",
                "provider": self._provider_name,
                "model": self._model_name,
                "offline": False,
                "error": str(e),
            }

    # ── 内部方法 ─────────────────────────────────────────────

    def _mock_chat_response(self, messages: list[dict[str, str]]) -> str:
        """离线模式：生成模拟聊天响应"""
        user_msg = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_msg = msg.get("content", "")
                break

        return (
            f"【离线模式 - {self._provider_name}】\n\n"
            f"你好！当前 {self._provider_name} 供应商处于离线模式。\n\n"
            f"你的问题：{user_msg[:100]}{'...' if len(user_msg) > 100 else ''}\n\n"
            f"💡 配置 {self._provider_name.upper()}_API_KEY 环境变量后即可使用在线服务。"
        )

    def _mock_embedding(self, text: str) -> list[float]:
        """离线模式：生成模拟嵌入向量（基于字符哈希）"""
        import hashlib

        dim = 1536
        vec = [0.0] * dim
        for ch in text:
            h = int(hashlib.md5(ch.encode()).hexdigest()[:8], 16)
            idx = h % dim
            vec[idx] += 1.0

        # 归一化
        norm = sum(v * v for v in vec) ** 0.5
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec

    def _log_cost(
        self,
        operation: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        latency: float = 0.0,
    ) -> None:
        """记录调用成本和延迟"""
        print(
            f"[{self._provider_name}] {operation} | "
            f"model={model} | "
            f"prompt_tokens={prompt_tokens} | "
            f"completion_tokens={completion_tokens} | "
            f"latency={latency:.3f}s"
        )