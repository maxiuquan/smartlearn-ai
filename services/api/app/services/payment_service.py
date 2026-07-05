"""支付服务（占位实现）.

未配置微信/支付宝凭证时 is_enabled=False，调用具体方法 raise FeatureNotEnabledError。
配置后可在此处接入真实 SDK（wechatpay / alipay-sdk-python）。
"""
from typing import Any, Optional

from app.core.config import settings
from app.services.feature_flags import is_alipay_enabled, is_wechat_pay_enabled


class FeatureNotEnabledError(RuntimeError):
    """可选功能未配置时调用具体业务方法抛出."""

    def __init__(self, feature: str, message: Optional[str] = None):
        self.feature = feature
        super().__init__(message or f"功能未启用：{feature}（请在 .env 配置相应凭证）")


class PaymentService:
    """支付服务聚合（微信 + 支付宝）.

    当前为占位实现：
    - is_enabled() → 检测是否配置了任一支付渠道
    - create_order() → 抛 FeatureNotEnabledError 或返回占位订单
    - 配置真实凭证后，可在 _create_wechat_order / _create_alipay_order 接入 SDK
    """

    @property
    def is_enabled(self) -> bool:
        return is_wechat_pay_enabled() or is_alipay_enabled()

    @property
    def wechat_enabled(self) -> bool:
        return is_wechat_pay_enabled()

    @property
    def alipay_enabled(self) -> bool:
        return is_alipay_enabled()

    def status(self) -> dict[str, Any]:
        return {
            "enabled": self.is_enabled,
            "wechat": {"enabled": self.wechat_enabled},
            "alipay": {"enabled": self.alipay_enabled},
        }

    async def create_order(
        self,
        *,
        user_id: int,
        amount: float,
        subject: str,
        channel: str = "auto",  # auto / wechat / alipay
    ) -> dict[str, Any]:
        """创建支付订单.

        Args:
            channel: auto=任一可用渠道，wechat/alipay 指定渠道
        Returns:
            订单信息 dict（含 pay_url 或 qr_code）
        Raises:
            FeatureNotEnabledError: 未配置支付凭证
        """
        if not self.is_enabled:
            raise FeatureNotEnabledError("payment")

        chosen = self._choose_channel(channel)
        if chosen == "wechat":
            return await self._create_wechat_order(user_id, amount, subject)
        return await self._create_alipay_order(user_id, amount, subject)

    def _choose_channel(self, channel: str) -> str:
        if channel == "wechat" and self.wechat_enabled:
            return "wechat"
        if channel == "alipay" and self.alipay_enabled:
            return "alipay"
        if channel == "auto":
            if self.wechat_enabled:
                return "wechat"
            if self.alipay_enabled:
                return "alipay"
        raise FeatureNotEnabledError("payment", f"所选渠道 {channel} 不可用")

    async def _create_wechat_order(
        self, user_id: int, amount: float, subject: str
    ) -> dict[str, Any]:
        """微信支付下单.

        TODO: 接入 wechatpay-python SDK
        from wechatpayv3 import WeChatPay
        wp = WeChatPay(
            wechatpay_type='NATIVE',
            mchid=settings.WECHAT_MCH_ID,
            ...
        )
        """
        # 占位返回
        return {
            "channel": "wechat",
            "order_id": f"wx_{user_id}_{int(amount * 100)}",
            "amount": amount,
            "subject": subject,
            "pay_url": None,  # 真实接入后填入
            "qr_code": None,
            "message": "微信支付 SDK 未接入，请配置后实现 _create_wechat_order",
        }

    async def _create_alipay_order(
        self, user_id: int, amount: float, subject: str
    ) -> dict[str, Any]:
        """支付宝下单.

        TODO: 接入 alipay-sdk-python
        from alipay import AliPay
        ap = AliPay(
            appid=settings.ALIPAY_APP_ID,
            app_private_key_string=settings.ALIPAY_PRIVATE_KEY,
            alipay_public_key_string=settings.ALIPAY_PUBLIC_KEY,
        )
        """
        return {
            "channel": "alipay",
            "order_id": f"al_{user_id}_{int(amount * 100)}",
            "amount": amount,
            "subject": subject,
            "pay_url": None,
            "message": "支付宝 SDK 未接入，请配置后实现 _create_alipay_order",
        }


payment_service = PaymentService()
