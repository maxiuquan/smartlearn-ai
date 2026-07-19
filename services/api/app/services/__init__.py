"""统一可选服务模块导出."""
from app.services.email_service import EmailService, email_service
from app.services.feature_flags import (
    get_feature_status,
    is_alipay_enabled,
    is_email_enabled,
    is_oss_enabled,
    is_payment_enabled,
    is_sms_enabled,
    is_wechat_pay_enabled,
)
from app.services.payment_service import PaymentService, payment_service
from app.services.sms_service import SmsService, sms_service

__all__ = [
    "PaymentService",
    "payment_service",
    "SmsService",
    "sms_service",
    "EmailService",
    "email_service",
    "is_ai_enabled",
    "is_glm_enabled",
    "is_deepseek_enabled",
    "is_siliconflow_enabled",
    "is_cogview_enabled",
    "is_oss_enabled",
    "is_wechat_pay_enabled",
    "is_alipay_enabled",
    "is_payment_enabled",
    "is_sms_enabled",
    "is_email_enabled",
    "get_feature_status",
]
