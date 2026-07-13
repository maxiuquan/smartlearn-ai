"""Application configuration via Pydantic settings.

配置策略：
- 数据库/Redis 支持单一 URL 连接串（推荐），也兼容分散字段（向后兼容）
- 所有可选第三方服务（支付/短信/邮件/对象存储）均为 Optional，未配置时不阻塞启动
- AI 供应商支持 4 家（GLM/DeepSeek/SiliconFlow/CogView），至少配置一个即可
- 通过 `app.services.feature_flags` 检测各功能是否可用
"""
import os
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


# 已知弱 / 默认 / 占位 JWT 密钥集合（精确匹配，用于 fail-fast 校验）
KNOWN_WEAK_JWT_SECRETS = {
    "change-me-in-production",
    "change-me",
    "change-me-to-a-strong-random-password",
    "change-me-to-a-secure-random-jwt-secret-at-least-32-chars",
    "your-jwt-secret-please-generate-with-openssl-rand-hex-32",
    "changeme",
    "secret",
    "your-secret-key",
}


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

    # ---------- 数据库 (PostgreSQL) ----------
    # 推荐：直接填完整连接串，自动优先于下面的分散字段
    # 格式: postgresql://用户名:密码@主机:端口/数据库名
    DATABASE_URL: Optional[str] = None

    # 兼容：使用 compose 自带 db 容器时，由 POSTGRES_* 初始化数据库
    # 若已填 DATABASE_URL，以下字段仅用于 db 容器初始化，应用连接以 DATABASE_URL 为准
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "smartlearn_user"
    DB_PASSWORD: str = ""  # 无默认密码，必须由环境变量提供
    DB_NAME: str = "smartlearn"
    POSTGRES_SERVER: Optional[str] = None
    POSTGRES_PORT: Optional[int] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None

    # ---------- Redis ----------
    # 推荐：直接填完整连接串，自动优先于分散字段
    # 格式: redis://:密码@主机:端口/0  或  redis://主机:端口/0（无密码）
    REDIS_URL: Optional[str] = None
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""  # 无默认密码，必须由环境变量提供

    # ---------- JWT ----------
    JWT_SECRET: str = ""  # 无默认密钥，必须由环境变量提供
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ---------- CORS ----------
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # ---------- AI 供应商 (4 家，至少配置一个) ----------
    # 1) GLM (智谱 AI) — 默认聊天主供应商，glm-4-flash 永久免费
    GLM_API_KEY: Optional[str] = None
    GLM_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4/"
    GLM_MODEL: str = "glm-4-flash"

    # 2) DeepSeek — 高难度推理，极低成本
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_MODEL: str = "deepseek-chat"

    # 3) SiliconFlow (硅基流动) — 嵌入/TTS/语音识别
    SILICONFLOW_API_KEY: Optional[str] = None
    SILICONFLOW_BASE_URL: str = "https://api.siliconflow.cn/v1"
    SILICONFLOW_EMBEDDING_MODEL: str = "BAAI/bge-m3"
    SILICONFLOW_TTS_MODEL: str = "CosyVoice"
    SILICONFLOW_STT_MODEL: str = "SenseVoice"

    # 4) CogView (智谱 AI) — 图像生成
    COGVIEW_API_KEY: Optional[str] = None
    COGVIEW_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4/"
    COGVIEW_MODEL: str = "cogview-3-flash"

    # 兼容旧字段（OpenAI 风格），保留但不再推荐
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_API_BASE: str = "https://api.openai.com/v1"
    LLM_MODEL_NAME: str = "gpt-4o-mini"
    EMBEDDING_MODEL_NAME: str = "text-embedding-3-small"

    # ---------- 对象存储 OSS / S3 兼容（可选）----------
    # 支持 S3 兼容协议：Cloudflare R2 / Backblaze B2 / 阿里云 OSS / MinIO
    OSS_ENDPOINT: Optional[str] = None
    OSS_ACCESS_KEY: Optional[str] = None
    OSS_SECRET_KEY: Optional[str] = None
    OSS_BUCKET: Optional[str] = None
    OSS_REGION: Optional[str] = None  # R2 用 account_id，B2 用 region，阿里云可空

    # ---------- 支付（可选，未配置则支付功能不可用）----------
    WECHAT_APP_ID: Optional[str] = None
    WECHAT_MCH_ID: Optional[str] = None
    WECHAT_API_KEY: Optional[str] = None
    # P1-01: 微信支付 V3 SDK 验签所需凭证
    WECHAT_API_V3_KEY: Optional[str] = None
    WECHAT_PRIVATE_KEY: Optional[str] = None
    WECHAT_CERT_SERIAL_NO: Optional[str] = None
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
    @staticmethod
    def _strip_sslmode(url: str) -> tuple[str, bool]:
        """从 PG 连接串剥离 sslmode 参数(异步 asyncpg 不支持).

        返回 (剥离后的 url, 是否需要 ssl).
        sslmode 取值 require/prefer/verify-ca/verify-full 视为需要 ssl;
        disable 或缺省视为不需要.
        """
        if "?" not in url:
            return url, False
        base, query = url.split("?", 1)
        keep: list[str] = []
        requires_ssl = False
        for kv in query.split("&"):
            if "=" not in kv:
                keep.append(kv)
                continue
            k, v = kv.split("=", 1)
            if k.lower() == "sslmode":
                if v.lower() in ("require", "prefer", "verify-ca", "verify-full"):
                    requires_ssl = True
                # 丢弃 sslmode 参数
            else:
                keep.append(kv)
        new_query = "&".join(keep)
        return f"{base}?{new_query}" if new_query else base, requires_ssl

    @property
    def database_url(self) -> str:
        """异步数据库 URL（asyncpg 驱动）.

        优先使用 DATABASE_URL 单一连接串；未配置则回退到分散字段拼接。
        注意: asyncpg 不支持 sslmode 参数,这里会剥离并通过 database_requires_ssl 暴露。
        """
        if self.DATABASE_URL:
            url = self.DATABASE_URL.strip()
            # 用户可能填的是 postgresql:// 或 postgres://
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            # 剥离 sslmode(asyncpg 不支持)
            url, _ = self._strip_sslmode(url)
            return url
        # 回退：分散字段
        host = self.POSTGRES_SERVER or self.DB_HOST
        port = self.POSTGRES_PORT or self.DB_PORT
        user = self.POSTGRES_USER or self.DB_USER
        pwd = self.POSTGRES_PASSWORD or self.DB_PASSWORD
        name = self.POSTGRES_DB or self.DB_NAME
        return f"postgresql+asyncpg://{user}:{pwd}@{host}:{port}/{name}"

    @property
    def database_requires_ssl(self) -> bool:
        """异步引擎是否需要 SSL(asyncpg 通过 connect_args={'ssl': True} 传)."""
        if not self.DATABASE_URL:
            return False
        _, requires_ssl = self._strip_sslmode(self.DATABASE_URL.strip())
        return requires_ssl

    @property
    def database_url_sync(self) -> str:
        """同步数据库 URL（用于 Celery/Alembic）."""
        if self.DATABASE_URL:
            url = self.DATABASE_URL.strip()
            if url.startswith("postgresql+asyncpg://"):
                return url.replace("postgresql+asyncpg://", "postgresql://", 1)
            if url.startswith("postgresql://"):
                return url
            if url.startswith("postgres://"):
                return url.replace("postgres://", "postgresql://", 1)
            return url
        host = self.POSTGRES_SERVER or self.DB_HOST
        port = self.POSTGRES_PORT or self.DB_PORT
        user = self.POSTGRES_USER or self.DB_USER
        pwd = self.POSTGRES_PASSWORD or self.DB_PASSWORD
        name = self.POSTGRES_DB or self.DB_NAME
        return f"postgresql://{user}:{pwd}@{host}:{port}/{name}"

    @property
    def redis_url(self) -> str:
        """Redis 连接 URL.

        优先使用 REDIS_URL 单一连接串；未配置则回退到分散字段拼接。
        自动兼容: Upstash Redis 免费档强制 TLS, 若用户填了 redis://...upstash.io
        会自动转换为 rediss://(双 s 表示 TLS)。
        """
        if self.REDIS_URL:
            url = self.REDIS_URL.strip()
            # Upstash 强制 TLS,把 redis:// 自动改成 rediss://
            if url.startswith("redis://") and ".upstash.io" in url:
                url = "rediss://" + url[len("redis://"):]
            return url
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
    def is_glm_enabled(self) -> bool:
        return _is_set(self.GLM_API_KEY)

    @property
    def is_deepseek_enabled(self) -> bool:
        return _is_set(self.DEEPSEEK_API_KEY)

    @property
    def is_siliconflow_enabled(self) -> bool:
        return _is_set(self.SILICONFLOW_API_KEY)

    @property
    def is_cogview_enabled(self) -> bool:
        return _is_set(self.COGVIEW_API_KEY)

    @property
    def is_openai_enabled(self) -> bool:
        return _is_set(self.OPENAI_API_KEY)

    @property
    def is_ai_enabled(self) -> bool:
        """任一 AI 供应商可用即视为启用."""
        return any([
            self.is_glm_enabled,
            self.is_deepseek_enabled,
            self.is_siliconflow_enabled,
            self.is_cogview_enabled,
            self.is_openai_enabled,
        ])

    @property
    def is_oss_enabled(self) -> bool:
        return all(_is_set(x) for x in (self.OSS_ENDPOINT, self.OSS_ACCESS_KEY, self.OSS_SECRET_KEY, self.OSS_BUCKET))

    @property
    def is_wechat_pay_enabled(self) -> bool:
        return all(_is_set(x) for x in (self.WECHAT_APP_ID, self.WECHAT_MCH_ID, self.WECHAT_API_KEY))

    @property
    def is_wechat_pay_v3_enabled(self) -> bool:
        """P1-01: 微信支付 V3 SDK 验签就绪检查（需要 V3 专用凭证）。"""
        return all(_is_set(x) for x in (
            self.WECHAT_APP_ID, self.WECHAT_MCH_ID,
            self.WECHAT_API_V3_KEY, self.WECHAT_PRIVATE_KEY, self.WECHAT_CERT_SERIAL_NO,
        ))

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

    # ---------- 安全门槛（fail-fast）----------
    @property
    def is_production(self) -> bool:
        """是否为生产环境（ENVIRONMENT=production/prod 或 PROD=true）。"""
        if self.ENVIRONMENT and self.ENVIRONMENT.strip().lower() in ("production", "prod"):
            return True
        return os.environ.get("PROD", "").strip().lower() in ("1", "true", "yes", "on")

    def validate_jwt_secret(self) -> None:
        """校验 JWT 密钥强度。

        在生产等需要强密钥的场景，若密钥为空、为已知弱/默认/占位值、
        或长度 < 32，应由此方法抛出 ValueError 以触发 fail-fast。

        Raises:
            ValueError: 密钥为空 / 弱默认 / 占位值 / 长度不足 32。
        """
        secret = (self.JWT_SECRET or "").strip()
        if not secret:
            raise ValueError(
                "JWT_SECRET 未设置（为空）。请通过环境变量设置长度 ≥ 32 的强随机密钥"
                "（例如: openssl rand -hex 32）。"
            )
        if secret in KNOWN_WEAK_JWT_SECRETS:
            raise ValueError(
                f"JWT_SECRET 使用了弱默认/占位值 '{secret}'。"
                "请替换为长度 ≥ 32 的强随机密钥（例如: openssl rand -hex 32）。"
            )
        if len(secret) < 32:
            raise ValueError(
                f"JWT_SECRET 长度不足 32 字符（当前 {len(secret)} 字符），"
                "存在被暴力破解风险，请使用更长的随机密钥。"
            )

    def validate_production(self) -> None:
        """生产环境 fail-fast 校验：缺失关键配置或使用不安全值时拒绝启动。

        检查项：
        1. DEBUG 必须为 False
        2. CORS 不能包含通配符 *
        3. JWT_SECRET 必须通过强度校验
        4. DB_PASSWORD 不能为空或弱默认值
        5. REDIS_PASSWORD 不能为弱默认值（可空，表示无密码 Redis）
        6. 不能使用 localhost Origin（生产环境）
        """
        errors: list[str] = []

        # 1. DEBUG 必须关闭
        if self.DEBUG:
            errors.append("DEBUG=true 在生产环境禁止使用")

        # 2. CORS 不能含通配符
        cors_list = self.cors_origins_list
        if "*" in cors_list:
            errors.append("CORS_ORIGINS 不能包含通配符 '*'（生产环境）")

        # 3. JWT_SECRET 强度校验
        try:
            self.validate_jwt_secret()
        except ValueError as e:
            errors.append(str(e))

        # 4. DB_PASSWORD 校验
        db_pw = (self.DB_PASSWORD or "").strip()
        if not db_pw and not self.DATABASE_URL:
            errors.append("DB_PASSWORD 未设置（生产环境必须配置数据库密码）")
        elif db_pw in ("postgres", "password", "123456", "admin"):
            errors.append(f"DB_PASSWORD 使用了弱默认值 '{db_pw}'")

        # 5. REDIS_PASSWORD 校验（允许空，但禁止弱默认值）
        redis_pw = (self.REDIS_PASSWORD or "").strip()
        if redis_pw in ("redis", "password", "123456"):
            errors.append(f"REDIS_PASSWORD 使用了弱默认值 '{redis_pw}'")

        # 6. localhost Origin 检查
        for origin in cors_list:
            if "localhost" in origin or "127.0.0.1" in origin:
                errors.append(f"CORS_ORIGINS 包含 localhost 来源 '{origin}'（生产环境禁止）")

        if errors:
            raise ValueError(
                "生产环境安全校验失败（fail-fast）：\n  - "
                + "\n  - ".join(errors)
                + "\n请修正以上配置后重启服务。"
            )


settings = Settings()
