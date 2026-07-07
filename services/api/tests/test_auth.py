"""鉴权单测 — JWT 密钥强度校验。

测试 validate_jwt_secret 方法对以下情况的处理：
- 空值
- 弱默认值（change-me-in-production 等）
- 占位符（your-xxx-please-generate-xxx）
- 长度 < 32 的密钥
- 合法密钥（长度 >= 32 且非弱默认值）
"""
import os
import sys
from pathlib import Path

import pytest

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import Settings, KNOWN_WEAK_JWT_SECRETS


class TestJWTSecretValidation:
    """JWT 密钥强度校验测试。"""

    def _make_settings(self, jwt_secret: str) -> Settings:
        """创建带指定 JWT_SECRET 的 Settings 实例。"""
        # 使用 monkeypatch 风格：直接构造 Settings 并覆盖字段
        # 注意：Settings 从 .env 读取，测试中直接设值
        original = os.environ.get("JWT_SECRET")
        os.environ["JWT_SECRET"] = jwt_secret
        try:
            # 强制重新加载
            s = Settings()
            return s
        finally:
            if original is not None:
                os.environ["JWT_SECRET"] = original
            else:
                os.environ.pop("JWT_SECRET", None)

    def test_empty_secret_rejected(self):
        """空 JWT_SECRET 应被拒绝。"""
        settings = self._make_settings("")
        with pytest.raises(ValueError, match="未设置"):
            settings.validate_jwt_secret()

    def test_whitespace_only_secret_rejected(self):
        """纯空白 JWT_SECRET 应被拒绝。"""
        settings = self._make_settings("   ")
        with pytest.raises(ValueError, match="未设置"):
            settings.validate_jwt_secret()

    def test_weak_default_change_me_rejected(self):
        """弱默认值 'change-me-in-production' 应被拒绝。"""
        settings = self._make_settings("change-me-in-production")
        with pytest.raises(ValueError, match="弱默认"):
            settings.validate_jwt_secret()

    def test_weak_default_changeme_rejected(self):
        """弱默认值 'changeme' 应被拒绝。"""
        settings = self._make_settings("changeme")
        with pytest.raises(ValueError, match="弱默认"):
            settings.validate_jwt_secret()

    def test_weak_default_secret_rejected(self):
        """弱默认值 'secret' 应被拒绝。"""
        settings = self._make_settings("secret")
        with pytest.raises(ValueError, match="弱默认"):
            settings.validate_jwt_secret()

    def test_placeholder_rejected(self):
        """占位符 'your-jwt-secret-please-generate-with-openssl-rand-hex-32' 应被拒绝。"""
        settings = self._make_settings("your-jwt-secret-please-generate-with-openssl-rand-hex-32")
        with pytest.raises(ValueError, match="弱默认"):
            settings.validate_jwt_secret()

    def test_short_secret_rejected(self):
        """长度 < 32 的密钥应被拒绝。"""
        settings = self._make_settings("a" * 31)  # 31 字符
        with pytest.raises(ValueError, match="长度不足 32"):
            settings.validate_jwt_secret()

    def test_exactly_32_chars_accepted(self):
        """恰好 32 字符的密钥应通过。"""
        settings = self._make_settings("a" * 32)
        # 不应抛出异常
        settings.validate_jwt_secret()

    def test_long_strong_secret_accepted(self):
        """足够长且非弱默认的密钥应通过。"""
        strong_secret = "x" * 64
        settings = self._make_settings(strong_secret)
        settings.validate_jwt_secret()

    def test_all_known_weak_secrets_rejected(self):
        """KNOWN_WEAK_JWT_SECRETS 中所有值都应被拒绝。"""
        for weak in KNOWN_WEAK_JWT_SECRETS:
            settings = self._make_settings(weak)
            with pytest.raises(ValueError):
                settings.validate_jwt_secret()
