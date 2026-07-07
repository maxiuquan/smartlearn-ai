"""可选功能开关 — 运行时检测各第三方服务是否可用.

供 admin 系统设置页与业务逻辑判断使用，未配置的功能返回 disabled 状态而非报错。
"""
from typing import Any

from app.core.config import settings


def is_ai_enabled() -> bool:
    return settings.is_ai_enabled


def is_glm_enabled() -> bool:
    return settings.is_glm_enabled


def is_deepseek_enabled() -> bool:
    return settings.is_deepseek_enabled


def is_siliconflow_enabled() -> bool:
    return settings.is_siliconflow_enabled


def is_cogview_enabled() -> bool:
    return settings.is_cogview_enabled


def is_oss_enabled() -> bool:
    return settings.is_oss_enabled


def is_wechat_pay_enabled() -> bool:
    return settings.is_wechat_pay_enabled


def is_alipay_enabled() -> bool:
    return settings.is_alipay_enabled


def is_payment_enabled() -> bool:
    return settings.is_payment_enabled


def is_sms_enabled() -> bool:
    return settings.is_sms_enabled


def is_email_enabled() -> bool:
    return settings.is_email_enabled


def get_feature_status() -> dict[str, Any]:
    """返回所有可选功能的可用性状态（供 admin 系统设置页展示）."""
    return {
        "ai": {
            "enabled": is_ai_enabled(),
            "label": "AI 服务",
            "description": "至少配置一家 AI 供应商即可",
            "providers": {
                "glm": is_glm_enabled(),
                "deepseek": is_deepseek_enabled(),
                "siliconflow": is_siliconflow_enabled(),
                "cogview": is_cogview_enabled(),
            },
        },
        "oss": {
            "enabled": is_oss_enabled(),
            "label": "对象存储 (OSS)",
            "description": "用于头像/文件上传存储",
            "config_keys": ["OSS_ENDPOINT", "OSS_ACCESS_KEY", "OSS_SECRET_KEY", "OSS_BUCKET"],
        },
        "wechat_pay": {
            "enabled": is_wechat_pay_enabled(),
            "label": "微信支付",
            "description": "在线支付（会员购买等）",
            "config_keys": ["WECHAT_APP_ID", "WECHAT_MCH_ID", "WECHAT_API_KEY"],
        },
        "alipay": {
            "enabled": is_alipay_enabled(),
            "label": "支付宝",
            "description": "在线支付（会员购买等）",
            "config_keys": ["ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY"],
        },
        "payment": {
            "enabled": is_payment_enabled(),
            "label": "在线支付（任一渠道）",
            "description": "聚合开关：微信或支付宝任一可用即视为启用",
        },
        "sms": {
            "enabled": is_sms_enabled(),
            "label": "短信服务",
            "description": "验证码/通知短信发送",
            "config_keys": ["SMS_ACCESS_KEY", "SMS_SECRET_KEY", "SMS_SIGN_NAME"],
        },
        "email": {
            "enabled": is_email_enabled(),
            "label": "邮件服务",
            "description": "验证码/通知邮件发送",
            "config_keys": ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"],
        },
    }
