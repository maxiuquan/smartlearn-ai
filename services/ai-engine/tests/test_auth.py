"""ai-engine JWT 鉴权单测。

测试 _verify_jwt 和 ensure_auth_configured 的行为：
- 弱默认/空 JWT_SECRET 应被检测
- 过期 JWT 应被拒绝
- 无效签名 JWT 应被拒绝
- 合法 JWT 应通过
"""
import sys
import time
from pathlib import Path
from unittest.mock import patch, MagicMock

import jwt
import pytest

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


class TestJWTVerification:
    """JWT 校验测试。"""

    VALID_SECRET = "test-secret-key-at-least-32-characters-long-xxxxx"

    def test_valid_jwt_returns_payload(self):
        """合法 JWT 返回 payload dict。"""
        from app.auth import _verify_jwt

        payload = {"sub": "123", "role": "user", "exp": int(time.time()) + 3600}
        token = jwt.encode(payload, self.VALID_SECRET, algorithm="HS256")
        with patch("app.auth.JWT_SECRET", self.VALID_SECRET):
            with patch("app.auth.JWT_ALGORITHM", "HS256"):
                result = _verify_jwt(token)
        assert result is not None
        assert result["sub"] == "123"
        assert result["role"] == "user"

    def test_expired_jwt_rejected(self):
        """过期 JWT 返回 None。"""
        from app.auth import _verify_jwt

        payload = {"sub": "123", "role": "user", "exp": int(time.time()) - 3600}
        token = jwt.encode(payload, self.VALID_SECRET, algorithm="HS256")
        with patch("app.auth.JWT_SECRET", self.VALID_SECRET):
            with patch("app.auth.JWT_ALGORITHM", "HS256"):
                result = _verify_jwt(token)
        assert result is None

    def test_invalid_signature_rejected(self):
        """无效签名 JWT 返回 None。"""
        from app.auth import _verify_jwt

        payload = {"sub": "123", "role": "user", "exp": int(time.time()) + 3600}
        token = jwt.encode(payload, "wrong-secret", algorithm="HS256")
        with patch("app.auth.JWT_SECRET", self.VALID_SECRET):
            with patch("app.auth.JWT_ALGORITHM", "HS256"):
                result = _verify_jwt(token)
        assert result is None

    def test_malformed_token_rejected(self):
        """格式错误的 token 返回 None。"""
        from app.auth import _verify_jwt

        with patch("app.auth.JWT_SECRET", self.VALID_SECRET):
            with patch("app.auth.JWT_ALGORITHM", "HS256"):
                result = _verify_jwt("not.a.valid.jwt.token")
        assert result is None

    def test_empty_secret_returns_none(self):
        """空 JWT_SECRET 返回 None。"""
        from app.auth import _verify_jwt

        payload = {"sub": "123", "role": "user", "exp": int(time.time()) + 3600}
        token = jwt.encode(payload, "any-secret", algorithm="HS256")
        with patch("app.auth.JWT_SECRET", ""):
            result = _verify_jwt(token)
        assert result is None


class TestEnsureAuthConfigured:
    """ensure_auth_configured 启动期校验测试。"""

    def test_auth_disabled_warns_but_passes(self):
        """鉴权关闭时仅警告，不抛异常。"""
        from app.auth import ensure_auth_configured

        mock_settings = MagicMock()
        mock_settings.AI_ENGINE_AUTH_ENABLED = False
        with patch("app.auth.settings", mock_settings):
            # 不应抛出异常
            ensure_auth_configured()

    def test_auth_enabled_with_weak_secret_fails(self):
        """鉴权开启但 JWT_SECRET 为弱默认值时应抛出 RuntimeError。"""
        from app.auth import ensure_auth_configured

        mock_settings = MagicMock()
        mock_settings.AI_ENGINE_AUTH_ENABLED = True
        mock_settings.AI_ENGINE_API_KEY = "test-api-key"
        with patch("app.auth.settings", mock_settings):
            with patch("app.auth.JWT_SECRET", "change-me-in-production"):
                with pytest.raises(RuntimeError, match="JWT_SECRET"):
                    ensure_auth_configured()

    def test_auth_enabled_with_empty_secret_fails(self):
        """鉴权开启但 JWT_SECRET 为空时应抛出 RuntimeError。"""
        from app.auth import ensure_auth_configured

        mock_settings = MagicMock()
        mock_settings.AI_ENGINE_AUTH_ENABLED = True
        mock_settings.AI_ENGINE_API_KEY = "test-api-key"
        with patch("app.auth.settings", mock_settings):
            with patch("app.auth.JWT_SECRET", ""):
                with pytest.raises(RuntimeError, match="JWT_SECRET"):
                    ensure_auth_configured()

    def test_auth_enabled_without_api_key_fails(self):
        """鉴权开启但缺少 AI_ENGINE_API_KEY 时应抛出 RuntimeError。"""
        from app.auth import ensure_auth_configured

        mock_settings = MagicMock()
        mock_settings.AI_ENGINE_AUTH_ENABLED = True
        mock_settings.AI_ENGINE_API_KEY = ""
        with patch("app.auth.settings", mock_settings):
            with patch("app.auth.JWT_SECRET", self.VALID_SECRET):
                with pytest.raises(RuntimeError, match="AI_ENGINE_API_KEY"):
                    ensure_auth_configured()

    def test_auth_enabled_with_valid_config_passes(self):
        """鉴权开启且密钥配置完整时应通过。"""
        from app.auth import ensure_auth_configured

        mock_settings = MagicMock()
        mock_settings.AI_ENGINE_AUTH_ENABLED = True
        mock_settings.AI_ENGINE_API_KEY = "valid-api-key"
        with patch("app.auth.settings", mock_settings):
            with patch("app.auth.JWT_SECRET", self.VALID_SECRET):
                # 不应抛出异常
                ensure_auth_configured()
