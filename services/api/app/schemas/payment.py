"""支付相关 Pydantic schemas (P1-4)."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class CreateOrderRequest(BaseModel):
    """创建支付订单请求。"""

    channel: str = Field(..., description="支付渠道: wechat / alipay")
    product_type: str = Field(
        ..., description="商品类型: subscription / credits / package"
    )
    product_snapshot: dict[str, Any] = Field(
        ..., description="商品快照: {plan, amount, period, quota, ...}"
    )
    amount_cents: int = Field(..., gt=0, description="金额(分)")


class OrderResponse(BaseModel):
    """订单响应。product_snapshot 在 DB 中为 Text(JSON 串),响应时解析为 dict。"""

    id: int
    order_no: str
    user_id: int
    channel: str
    product_type: str
    product_snapshot: dict[str, Any]
    amount_cents: int
    currency: str
    status: str
    third_party_trade_no: Optional[str] = None
    paid_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None
    refund_amount_cents: Optional[int] = None
    refund_reason: Optional[str] = None
    callback_raw: Optional[str] = None
    signature_valid: Optional[bool] = None
    metadata_json: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("product_snapshot", mode="before")
    @classmethod
    def _parse_snapshot(cls, v: Any) -> dict[str, Any]:
        if isinstance(v, str):
            import json as _json

            try:
                return _json.loads(v)
            except Exception:
                return {"raw": v}
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        return {"raw": str(v)}


class OrderListResponse(BaseModel):
    """订单列表响应（分页）。"""

    items: list[OrderResponse]
    total: int
    page: int
    page_size: int


class RefundRequest(BaseModel):
    """退款请求。"""

    refund_amount_cents: int = Field(..., gt=0, description="退款金额(分)")
    reason: str = Field(..., min_length=1, max_length=500, description="退款原因")


class CallbackPayload(BaseModel):
    """通用 webhook 载荷。

    微信/支付宝均以 dict 传入；真实接入时由各渠道 SDK 解析原始报文(XML/表单)后
    统一映射到下列字段。允许任意额外字段（model_config extra=allow）。
    """

    order_no: Optional[str] = Field(None, description="商户订单号")
    out_trade_no: Optional[str] = Field(None, description="商户订单号(别名)")
    transaction_id: Optional[str] = Field(None, description="微信交易号")
    trade_no: Optional[str] = Field(None, description="支付宝交易号")
    amount_cents: Optional[int] = Field(None, description="金额(分)")
    total_fee: Optional[int] = Field(None, description="金额(分,微信字段名)")

    model_config = {"extra": "allow"}
