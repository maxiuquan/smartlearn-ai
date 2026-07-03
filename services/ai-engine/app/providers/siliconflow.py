"""
SiliconFlow 供应商

硅基流动 SiliconFlow，提供嵌入向量、TTS、STT 服务。
所有嵌入向量统一使用 BAAI/bge-m3 模型。
"""

import sys
import time
from pathlib import Path
from typing import Any, Generator

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from config import settings
from .base import BaseEmbeddingProvider, BaseTTSProvider, BaseSTTProvider
from .openai_compat import OpenAICompatProvider


class SiliconFlowProvider(OpenAICompatProvider, BaseTTSProvider, BaseSTTProvider):
    """SiliconFlow 供应商

    硅基流动提供：
    - 嵌入向量: BAAI/bge-m3
    - 文本转语音: CosyVoice
    - 语音转文本: SenseVoice
    """

    def __init__(
        self,
        api_key: str = "",
        base_url: str = "",
        embedding_model: str = "",
        tts_model: str = "",
        stt_model: str = "",
    ) -> None:
        _api_key = api_key or settings.SILICONFLOW_API_KEY or ""
        _base_url = base_url or settings.SILICONFLOW_BASE_URL
        _embedding_model = embedding_model or settings.SILICONFLOW_EMBEDDING_MODEL
        _tts_model = tts_model or settings.SILICONFLOW_TTS_MODEL
        _stt_model = stt_model or settings.SILICONFLOW_STT_MODEL

        # 使用 embedding model 作为主模型名
        super().__init__(
            api_key=_api_key,
            base_url=_base_url,
            model_name=_embedding_model,
            provider_name="siliconflow",
            offline_mode=not _api_key,
        )

        self._embedding_model = _embedding_model
        self._tts_model = _tts_model
        self._stt_model = _stt_model

    # ── 属性 ─────────────────────────────────────────────────

    @property
    def embedding_model(self) -> str:
        return self._embedding_model

    @property
    def tts_model(self) -> str:
        return self._tts_model

    @property
    def stt_model(self) -> str:
        return self._stt_model

    # ── 嵌入向量（覆盖父类以使用专门的 embedding model） ─────

    def generate_embedding(self, text: str) -> list[float]:
        """使用 BAAI/bge-m3 生成嵌入向量"""
        if self._offline_mode:
            return self._mock_embedding(text)

        start_time = time.time()
        try:
            client = self._get_client()
            if client is None:
                return self._mock_embedding(text)

            response = client.embeddings.create(
                model=self._embedding_model,
                input=[text],
            )
            elapsed = time.time() - start_time

            embedding = response.data[0].embedding
            usage = response.usage
            if usage:
                self._log_cost(
                    operation="embedding",
                    model=self._embedding_model,
                    prompt_tokens=usage.prompt_tokens,
                    latency=elapsed,
                )
            return embedding

        except Exception as e:
            elapsed = time.time() - start_time
            print(f"[siliconflow] generate_embedding 失败 "
                  f"(耗时 {elapsed:.2f}s): {e}")
            return self._mock_embedding(text)

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
                model=self._embedding_model,
                input=texts,
            )
            elapsed = time.time() - start_time

            embeddings = [d.embedding for d in response.data]
            usage = response.usage
            if usage:
                self._log_cost(
                    operation="batch_embedding",
                    model=self._embedding_model,
                    prompt_tokens=usage.prompt_tokens,
                    latency=elapsed,
                )
            return embeddings

        except Exception as e:
            elapsed = time.time() - start_time
            print(f"[siliconflow] batch_embedding 失败 "
                  f"(耗时 {elapsed:.2f}s): {e}")
            return [self._mock_embedding(t) for t in texts]

    # ── BaseTTSProvider 实现 ─────────────────────────────────

    def text_to_speech(
        self,
        text: str,
        voice: str = "default",
        speed: float = 1.0,
        **kwargs: Any,
    ) -> bytes:
        """文本转语音 (CosyVoice)"""
        if self._offline_mode:
            return self._mock_tts(text)

        start_time = time.time()
        try:
            import httpx

            headers = {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self._tts_model,
                "input": text,
                "voice": voice,
                "response_format": "mp3",
                "speed": speed,
            }
            resp = httpx.post(
                f"{self._base_url}/audio/speech",
                json=payload,
                headers=headers,
                timeout=60.0,
            )
            resp.raise_for_status()
            elapsed = time.time() - start_time
            self._log_cost(
                operation="tts",
                model=self._tts_model,
                latency=elapsed,
            )
            return resp.content
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"[siliconflow] TTS 失败 (耗时 {elapsed:.2f}s): {e}")
            return self._mock_tts(text)

    def _mock_tts(self, text: str) -> bytes:
        """离线模式：返回空音频"""
        print(f"[siliconflow] TTS 离线模式，文本: {text[:50]}...")
        # 返回一个最小的静音 WAV 文件
        return b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"

    # ── BaseSTTProvider 实现 ─────────────────────────────────

    def speech_to_text(
        self,
        audio_data: bytes,
        language: str = "zh",
        **kwargs: Any,
    ) -> str:
        """语音转文本 (SenseVoice)"""
        if self._offline_mode:
            return self._mock_stt()

        start_time = time.time()
        try:
            import httpx

            headers = {
                "Authorization": f"Bearer {self._api_key}",
            }
            files = {
                "file": ("audio.wav", audio_data, "audio/wav"),
            }
            data = {
                "model": self._stt_model,
                "language": language,
            }
            resp = httpx.post(
                f"{self._base_url}/audio/transcriptions",
                headers=headers,
                files=files,
                data=data,
                timeout=60.0,
            )
            resp.raise_for_status()
            elapsed = time.time() - start_time
            result = resp.json().get("text", "")
            self._log_cost(
                operation="stt",
                model=self._stt_model,
                latency=elapsed,
            )
            return result
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"[siliconflow] STT 失败 (耗时 {elapsed:.2f}s): {e}")
            return self._mock_stt()

    def _mock_stt(self) -> str:
        """离线模式：返回空识别结果"""
        return ""

    # ── 健康检查 ─────────────────────────────────────────────

    def health_check(self) -> dict[str, Any]:
        result = super().health_check()
        result["supports"] = ["embedding", "tts", "stt"]
        if not self._offline_mode:
            result["embedding_model"] = self._embedding_model
            result["tts_model"] = self._tts_model
            result["stt_model"] = self._stt_model
        return result


def create_siliconflow_provider() -> SiliconFlowProvider:
    """工厂函数：创建 SiliconFlow 供应商实例"""
    return SiliconFlowProvider()