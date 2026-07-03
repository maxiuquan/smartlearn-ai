"""
Provider 抽象基类

定义所有 AI 供应商需要实现的接口规范。
"""

from abc import ABC, abstractmethod
from typing import Any, Generator


class BaseProvider(ABC):
    """所有 AI 供应商的抽象基类"""

    @abstractmethod
    def health_check(self) -> dict[str, Any]:
        """健康检查

        Returns:
            dict: 包含 status, provider_name, model 等信息的字典
        """
        ...


class BaseChatProvider(BaseProvider):
    """聊天/LLM 供应商抽象基类"""

    @abstractmethod
    def chat_completion(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 2048,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """同步聊天补全

        Args:
            messages: 消息列表 [{"role": "user/system/assistant", "content": "..."}]
            max_tokens: 最大 token 数
            temperature: 温度参数
            **kwargs: 其他参数

        Returns:
            str: 模型回复内容
        """
        ...

    def chat_completion_stream(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 2048,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> Generator[str, None, None]:
        """流式聊天补全

        Args:
            messages: 消息列表
            max_tokens: 最大 token 数
            temperature: 温度参数
            **kwargs: 其他参数

        Yields:
            str: 增量文本片段
        """
        # 默认实现：调用同步方法后一次性返回
        result = self.chat_completion(messages, max_tokens, temperature, **kwargs)
        yield result


class BaseEmbeddingProvider(BaseProvider):
    """嵌入向量供应商抽象基类"""

    @abstractmethod
    def generate_embedding(self, text: str) -> list[float]:
        """生成单个文本的嵌入向量

        Args:
            text: 输入文本

        Returns:
            list[float]: 嵌入向量
        """
        ...

    def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """批量生成嵌入向量

        Args:
            texts: 输入文本列表

        Returns:
            list[list[float]]: 嵌入向量列表
        """
        return [self.generate_embedding(t) for t in texts]


class BaseTTSProvider(BaseProvider):
    """文本转语音供应商抽象基类"""

    @abstractmethod
    def text_to_speech(
        self,
        text: str,
        voice: str = "default",
        speed: float = 1.0,
        **kwargs: Any,
    ) -> bytes:
        """文本转语音

        Args:
            text: 输入文本
            voice: 音色
            speed: 语速

        Returns:
            bytes: 音频数据
        """
        ...


class BaseSTTProvider(BaseProvider):
    """语音转文本供应商抽象基类"""

    @abstractmethod
    def speech_to_text(
        self,
        audio_data: bytes,
        language: str = "zh",
        **kwargs: Any,
    ) -> str:
        """语音转文本

        Args:
            audio_data: 音频数据
            language: 语言代码
            **kwargs: 其他参数

        Returns:
            str: 识别文本
        """
        ...


class BaseImageProvider(BaseProvider):
    """图像生成供应商抽象基类"""

    @abstractmethod
    def generate_image(
        self,
        prompt: str,
        size: str = "1024x1024",
        n: int = 1,
        **kwargs: Any,
    ) -> list[str]:
        """生成图像

        Args:
            prompt: 图像描述提示词
            size: 图像尺寸
            n: 生成数量
            **kwargs: 其他参数

        Returns:
            list[str]: 图像 URL 或 base64 列表
        """
        ...


class BaseModerationProvider(BaseProvider):
    """内容审核供应商抽象基类"""

    @abstractmethod
    def moderate(
        self,
        text: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """内容审核

        Args:
            text: 待审核文本
            **kwargs: 其他参数

        Returns:
            dict: 包含 flagged, categories, scores 等字段
        """
        ...