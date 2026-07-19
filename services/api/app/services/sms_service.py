"""短信服务（占位实现）.

未配置 SMS_ACCESS_KEY/SECRET_KEY 时 is_enabled=False，调用 send() 抛 FeatureNotEnabledError。
配置后可接入阿里云短信 / 腾讯云短信 SDK。
"""
from typing import Optional

from app.services.feature_flags import is_sms_enabled


class SmsService:
    """短信服务占位."""

    @property
    def is_enabled(self) -> bool:
        return is_sms_enabled()

    def status(self) -> dict:
        return {"enabled": self.is_enabled, "sign_name": _sign_name()}

    async def send_code(self, phone: str, code: str, *, template: Optional[str] = None) -> dict:
        """发送验证码短信.

        Raises:
            FeatureNotEnabledError: 未配置短信凭证
        """
        if not self.is_enabled:
            from app.services.payment_service import FeatureNotEnabledError
            raise FeatureNotEnabledError("sms")
        # TODO: 接入阿里云短信 SDK
        # from aliyunsdkcore.client import AcsClient
        # from aliyunsdkcore.request import CommonRequest
        return {
            "phone": phone,
            "sent": False,
            "message": "短信 SDK 未接入，请配置后实现 send_code",
        }

    async def send_notification(
        self, phone: str, template_code: str, params: dict
    ) -> dict:
        """发送通知短信."""
        if not self.is_enabled:
            from app.services.payment_service import FeatureNotEnabledError
            raise FeatureNotEnabledError("sms")
        # TODO: 接入 SDK
        return {"phone": phone, "sent": False, "message": "SDK 未接入"}


def _sign_name() -> Optional[str]:
    from app.core.config import settings
    return settings.SMS_SIGN_NAME


sms_service = SmsService()
