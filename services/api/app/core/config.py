"""Application configuration via Pydantic settings.

所有可选第三方服务（支付/短信/邮件/对象存储）均为 Optional，未配置时不阻塞启动。
通过 `app.services.feature_flags` 检测各功能是否可用。
"""
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


def _is_set(v: Optional[str]) -> bool:
    """判断字符串环境变量是否实际配置（非空、非占位符）."""
    if v is None:
        return False
    s = v.strip()
    if not s:
        return False
    # .env.example 里的占位符视为未配置
    return not s.startswith("your-") and s != "change-me-to-a-strong-random-password"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # 忽略 .env 中未声明的字段（如 docker-compose 注入的）
    )

    # ---------- 环境 ----------
    ENVIRONMENT: str = "development"
    APP_NAME: str = "SmartLearn AI API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ---------- Database ----------
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "smartlearn_user"
    DB_PASSWORD: str = "postgres"
    DB_NAME: str = "smartlearn"
    # 兼容 docker-compose 注入的 POSTGRES_* 变量名
    POSTGRES_SERVER: Optional[str] = None
    POSTGRES_PORT: Optional[int] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None

    # ---------- Redis ----------
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "redis"

    # ---------- JWT ----------
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ---------- CORS ----------
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # ---------- AI 服务（可选，至少一个即可）----------
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_API_BASE: str = "https://api.openai.com/v1"
    LLM_MODEL_NAME: str = "gpt-4o-mini"
    EMBEDDING_MODEL_NAME: str = "text-embedding-3-small"

    # ---------- 对象存储 OSS（可选）----------
    OSS_ENDPOINT: Optional[str] = None
    OSS_ACCESS_KEY: Optional[str] = None
    OSS_SECRET_KEY: Optional[str] = None
    OSS_BUCKET: Optional[str] = None

    # ---------- 支付（可选，未配置则支付功能不可用）----------
    WECHAT_APP_ID: Optional[str] = None
    WECHAT_MCH_ID: Optional[str] = None
    WECHAT_API_KEY: Optional[str] = None
    ALIPAY_APP_ID: Optional[str] = None
    ALIPAY_PRIVATE_KEY: Optional[str] = None
    ALIPAY_PUBLIC_KEY: Optional[str] = None

    # ---------- 短信（可选）----------
    SMS_ACCESS_KEY: Optional[str] = None
    SMS_SECRET_KEY: Optional[str] = None
    SMS_SIGN_NAME: str = "SmartLearn"

    # ---------- 邮件（可选）----------
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 465
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    SMTP_FROM: Optional[str] = None  # 发件人地址，默认取 SMTP_USER

    # ---------- 便捷属性 ----------
    @property
    def database_url(self) -> str:
        """Build the async database URL."""
        host = self.POSTGRES_SERVER or self.DB_HOST
        port = self.POSTGRES_PORT or self.DB_PORT
        user = self.POSTGRES_USER or self.DB_USER
        pwd = self.POSTGRES_PASSWORD or self.DB_PASSWORD
        name = self.POSTGRES_DB or self.DB_NAME
        return f"postgresql+asyncpg://{user}:{pwd}@{host}:{port}/{name}"

    @property
    def database_url_sync(self) -> str:
        """Build the sync database URL for Celery/Alembic."""
        host = self.POSTGRES_SERVER or self.DB_HOST
        port = self.POSTGRES_PORT or self.DB_PORT
        user = self.POSTGRES_USER or self.DB_USER
        pwd = self.POSTGRES_PASSWORD or self.DB_PASSWORD
        name = self.POSTGRES_DB or self.DB_NAME
        return f"postgresql://{user}:{pwd}@{host}:{port}/{name}"

    @property
    def redis_url(self) -> str:
        """Build the Redis connection URL."""
        return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def smtp_from_address(self) -> str:
        """发件人地址（默认取 SMTP_USER）."""
        return self.SMTP_FROM or self.SMTP_USER or "noreply@smartlearn.local"

    # ---------- 可选功能开关（运行时检测）----------
    @property
    def is_oss_enabled(self) -> bool:
        return all(_is_set(x) for x in (self.OSS_ENDPOINT, self.OSS_ACCESS_KEY, self.OSS_SECRET_KEY, self.OSS_BUCKET))

    @property
    def is_wechat_pay_enabled(self) -> bool:
        return all(_is_set(x) for x in (self.WECHAT_APP_ID, self.WECHAT_MCH_ID, self.WECHAT_API_KEY))

    @property
    def is_alipay_enabled(self) -> bool:
        return all(_is_set(x) for x in (self.ALIPAY_APP_ID, self.ALIPAY_PRIVATE_KEY, self.ALIPAY_PUBLIC_KEY))

    @property
    def is_payment_enabled(self) -> bool:
        return self.is_wechat_pay_enabled or self.is_alipay_enabled

    @property
    def is_sms_enabled(self) -> bool:
        return all(_is_set(x) for x in (self.SMS_ACCESS_KEY, self.SMS_SECRET_KEY))

    @property
    def is_email_enabled(self) -> bool:
        return all(_is_set(x) for x in (self.SMTP_HOST, self.SMTP_USER, self.SMTP_PASS))


settings = Settings()