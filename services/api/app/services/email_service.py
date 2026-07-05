"""邮件服务（占位实现）.

未配置 SMTP_HOST/USER/PASS 时 is_enabled=False，调用 send() 抛 FeatureNotEnabledError。
配置后可接入 aiosmtplib 实现真实发送。
"""
from typing import Optional

from app.services.feature_flags import is_email_enabled


class EmailService:
    """邮件服务占位."""

    @property
    def is_enabled(self) -> bool:
        return is_email_enabled()

    def status(self) -> dict:
        from app.core.config import settings
        return {
            "enabled": self.is_enabled,
            "host": settings.SMTP_HOST,
            "port": settings.SMTP_PORT,
            "from": settings.smtp_from_address,
        }

    async def send_code(self, to: str, code: str) -> dict:
        """发送验证码邮件."""
        if not self.is_enabled:
            from app.services.payment_service import FeatureNotEnabledError
            raise FeatureNotEnabledError("email")
        # TODO: 接入 aiosmtplib
        # import aiosmtplib
        # from email.message import EmailMessage
        return {
            "to": to,
            "sent": False,
            "message": "SMTP 未接入，请配置后实现 send_code",
        }

    async def send_notification(
        self, to: str, subject: str, body: str, *, html: Optional[str] = None
    ) -> dict:
        """发送通知邮件."""
        if not self.is_enabled:
            from app.services.payment_service import FeatureNotEnabledError
            raise FeatureNotEnabledError("email")
        # TODO: 接入 aiosmtplib
        return {"to": to, "subject": subject, "sent": False, "message": "SMTP 未接入"}


email_service = EmailService()
