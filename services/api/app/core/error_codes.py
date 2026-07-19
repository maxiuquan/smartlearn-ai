"""统一错误码规范 — P1-1 收敛后端架构与数据权威.

定义项目全局唯一的错误码枚举（`ErrorCode`）、业务异常基类（`BizError`），
以及便捷构造函数与 HTTP 状态码映射。所有 API 响应错误均通过 `error_response`
（见 `app.core.responses`）引用此处枚举，确保错误码可被前端/运维枚举对齐。

设计原则：
- 错误码为 `str` 枚举，值为字符串名称（如 "AUTH_TOKEN_INVALID"），便于日志/告警/前端国际化的可读性；
- 数字段（如 1001）通过 `ErrorCode.code_number` 属性暴露，用于监控指标的数值聚合；
- 分段编号：1xxx=认证 / 2xxx=参数 / 3xxx=资源 / 4xxx=业务 / 5xxx=系统；
- 每个 ErrorCode 携带默认 HTTP 状态码与默认中文消息，调用方可覆盖；
- `BizError` 为受控业务异常，被 `app.core.exception_handler` 统一捕获并转换为标准 JSON。

注意：本模块可独立 import（不依赖 FastAPI/SQLAlchemy），便于 CLI/测试复用。
"""
from enum import Enum
from typing import Any, Optional


class ErrorCode(str, Enum):
    """统一错误码枚举（str Enum）.

    `str` 继承使枚举值可直接序列化为 JSON 字符串；
    `code_number` 提供数值形式（用于监控指标聚合）。
    """

    # ── 认证类 1xxx ──────────────────────────────────────────
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"  # 1001
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"               # 1002
    AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID"               # 1003
    AUTH_TOKEN_REVOKED = "AUTH_TOKEN_REVOKED"               # 1004
    AUTH_SESSION_REVOKED = "AUTH_SESSION_REVOKED"           # 1005
    AUTH_PERMISSION_DENIED = "AUTH_PERMISSION_DENIED"       # 1006
    AUTH_ACCOUNT_BANNED = "AUTH_ACCOUNT_BANNED"             # 1007

    # ── 参数类 2xxx ──────────────────────────────────────────
    PARAM_INVALID = "PARAM_INVALID"           # 2001
    PARAM_MISSING = "PARAM_MISSING"           # 2002
    PARAM_TYPE_ERROR = "PARAM_TYPE_ERROR"     # 2003

    # ── 资源类 3xxx ──────────────────────────────────────────
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"   # 3001
    RESOURCE_CONFLICT = "RESOURCE_CONFLICT"     # 3002
    RESOURCE_GONE = "RESOURCE_GONE"             # 3003

    # ── 业务类 4xxx ──────────────────────────────────────────
    BIZ_QUOTA_EXCEEDED = "BIZ_QUOTA_EXCEEDED"       # 4001
    BIZ_RATE_LIMITED = "BIZ_RATE_LIMITED"           # 4002
    BIZ_PAYMENT_FAILED = "BIZ_PAYMENT_FAILED"       # 4003
    BIZ_CONTENT_TAKEDOWN = "BIZ_CONTENT_TAKEDOWN"   # 4004

    # ── 系统类 5xxx ──────────────────────────────────────────
    SYS_INTERNAL_ERROR = "SYS_INTERNAL_ERROR"       # 5001
    SYS_DATABASE_ERROR = "SYS_DATABASE_ERROR"       # 5002
    SYS_REDIS_ERROR = "SYS_REDIS_ERROR"             # 5003
    SYS_AI_ERROR = "SYS_AI_ERROR"                   # 5004
    SYS_THIRD_PARTY_ERROR = "SYS_THIRD_PARTY_ERROR"  # 5005

    @property
    def code_number(self) -> int:
        """返回错误码对应的数字段（用于监控/告警聚合）.

        与枚举名一一对应：AUTH_INVALID_CREDENTIALS -> 1001，依此类推。
        """
        return _ERROR_CODE_NUMBERS[self]

    @property
    def default_http_status(self) -> int:
        """返回该错误码默认对应的 HTTP 状态码（可被调用方覆盖）."""
        return _DEFAULT_HTTP_STATUS[self]

    @property
    def default_message(self) -> str:
        """返回该错误码的默认中文消息（可被调用方覆盖）."""
        return _DEFAULT_MESSAGES[self]


# ── 错误码 -> 数字段 映射 ─────────────────────────────────────
_ERROR_CODE_NUMBERS: dict[ErrorCode, int] = {
    ErrorCode.AUTH_INVALID_CREDENTIALS: 1001,
    ErrorCode.AUTH_TOKEN_EXPIRED: 1002,
    ErrorCode.AUTH_TOKEN_INVALID: 1003,
    ErrorCode.AUTH_TOKEN_REVOKED: 1004,
    ErrorCode.AUTH_SESSION_REVOKED: 1005,
    ErrorCode.AUTH_PERMISSION_DENIED: 1006,
    ErrorCode.AUTH_ACCOUNT_BANNED: 1007,
    ErrorCode.PARAM_INVALID: 2001,
    ErrorCode.PARAM_MISSING: 2002,
    ErrorCode.PARAM_TYPE_ERROR: 2003,
    ErrorCode.RESOURCE_NOT_FOUND: 3001,
    ErrorCode.RESOURCE_CONFLICT: 3002,
    ErrorCode.RESOURCE_GONE: 3003,
    ErrorCode.BIZ_QUOTA_EXCEEDED: 4001,
    ErrorCode.BIZ_RATE_LIMITED: 4002,
    ErrorCode.BIZ_PAYMENT_FAILED: 4003,
    ErrorCode.BIZ_CONTENT_TAKEDOWN: 4004,
    ErrorCode.SYS_INTERNAL_ERROR: 5001,
    ErrorCode.SYS_DATABASE_ERROR: 5002,
    ErrorCode.SYS_REDIS_ERROR: 5003,
    ErrorCode.SYS_AI_ERROR: 5004,
    ErrorCode.SYS_THIRD_PARTY_ERROR: 5005,
}

# ── 错误码 -> 默认 HTTP 状态码 映射 ───────────────────────────
# 选取语义最贴近的 HTTP 状态码；调用方仍可在 BizError 构造时覆盖 http_status。
_DEFAULT_HTTP_STATUS: dict[ErrorCode, int] = {
    # 认证类 -> 401 / 403
    ErrorCode.AUTH_INVALID_CREDENTIALS: 401,
    ErrorCode.AUTH_TOKEN_EXPIRED: 401,
    ErrorCode.AUTH_TOKEN_INVALID: 401,
    ErrorCode.AUTH_TOKEN_REVOKED: 401,
    ErrorCode.AUTH_SESSION_REVOKED: 401,
    ErrorCode.AUTH_PERMISSION_DENIED: 403,
    ErrorCode.AUTH_ACCOUNT_BANNED: 403,
    # 参数类 -> 400
    ErrorCode.PARAM_INVALID: 400,
    ErrorCode.PARAM_MISSING: 400,
    ErrorCode.PARAM_TYPE_ERROR: 400,
    # 资源类 -> 404 / 409 / 410
    ErrorCode.RESOURCE_NOT_FOUND: 404,
    ErrorCode.RESOURCE_CONFLICT: 409,
    ErrorCode.RESOURCE_GONE: 410,
    # 业务类 -> 402 / 429 / 451
    ErrorCode.BIZ_QUOTA_EXCEEDED: 429,
    ErrorCode.BIZ_RATE_LIMITED: 429,
    ErrorCode.BIZ_PAYMENT_FAILED: 402,
    ErrorCode.BIZ_CONTENT_TAKEDOWN: 451,
    # 系统类 -> 500 / 502 / 503
    ErrorCode.SYS_INTERNAL_ERROR: 500,
    ErrorCode.SYS_DATABASE_ERROR: 503,
    ErrorCode.SYS_REDIS_ERROR: 503,
    ErrorCode.SYS_AI_ERROR: 503,
    ErrorCode.SYS_THIRD_PARTY_ERROR: 502,
}

# ── 错误码 -> 默认中文消息 ────────────────────────────────────
_DEFAULT_MESSAGES: dict[ErrorCode, str] = {
    ErrorCode.AUTH_INVALID_CREDENTIALS: "用户名或密码错误",
    ErrorCode.AUTH_TOKEN_EXPIRED: "登录已过期，请重新登录",
    ErrorCode.AUTH_TOKEN_INVALID: "无效的身份凭证",
    ErrorCode.AUTH_TOKEN_REVOKED: "登录凭证已被撤销",
    ErrorCode.AUTH_SESSION_REVOKED: "会话已被撤销，请重新登录",
    ErrorCode.AUTH_PERMISSION_DENIED: "无权访问该资源",
    ErrorCode.AUTH_ACCOUNT_BANNED: "账号已被封禁",
    ErrorCode.PARAM_INVALID: "请求参数不合法",
    ErrorCode.PARAM_MISSING: "缺少必填参数",
    ErrorCode.PARAM_TYPE_ERROR: "参数类型错误",
    ErrorCode.RESOURCE_NOT_FOUND: "资源不存在",
    ErrorCode.RESOURCE_CONFLICT: "资源冲突（如唯一约束冲突）",
    ErrorCode.RESOURCE_GONE: "资源已永久失效",
    ErrorCode.BIZ_QUOTA_EXCEEDED: "超出业务配额",
    ErrorCode.BIZ_RATE_LIMITED: "请求过于频繁，请稍后再试",
    ErrorCode.BIZ_PAYMENT_FAILED: "支付失败",
    ErrorCode.BIZ_CONTENT_TAKEDOWN: "内容已下架",
    ErrorCode.SYS_INTERNAL_ERROR: "服务器内部错误",
    ErrorCode.SYS_DATABASE_ERROR: "数据库服务暂时不可用",
    ErrorCode.SYS_REDIS_ERROR: "缓存服务暂时不可用",
    ErrorCode.SYS_AI_ERROR: "AI 服务暂时不可用",
    ErrorCode.SYS_THIRD_PARTY_ERROR: "第三方服务调用失败",
}


class BizError(Exception):
    """业务异常基类 — 受控异常，被全局异常处理器捕获并转换为标准 JSON 响应.

    Attributes:
        code: ErrorCode 枚举值（如 ErrorCode.AUTH_TOKEN_INVALID）
        message: 展示给前端的错误消息（默认取 ErrorCode.default_message）
        http_status: HTTP 响应状态码（默认取 ErrorCode.default_http_status）
        details: 额外细节（dict，可选，如 {"field": "email"}）

    使用方式：
        raise BizError(ErrorCode.AUTH_PERMISSION_DENIED)
        raise BizError(ErrorCode.RESOURCE_NOT_FOUND, message="题目不存在", details={"id": 42})
        raise biz_error(ErrorCode.BIZ_QUOTA_EXCEEDED, details={"quota": 100, "used": 100})
    """

    def __init__(
        self,
        code: ErrorCode,
        message: Optional[str] = None,
        http_status: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        self.code: ErrorCode = code
        self.message: str = message if message is not None else code.default_message
        self.http_status: int = http_status if http_status is not None else code.default_http_status
        self.details: Optional[dict[str, Any]] = details
        # 调用 Exception.__init__ 使 str(exc) 返回 message，便于日志/traceback
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """序列化为 error_response 标准结构的 error 字段（不含外层 success=false 包装）.

        返回示例：
            {"code": "AUTH_TOKEN_INVALID", "message": "无效的身份凭证", "details": null}
        """
        return {
            "code": self.code.value,
            "code_number": self.code.code_number,
            "message": self.message,
            "details": self.details,
        }

    def __repr__(self) -> str:
        return (
            f"BizError(code={self.code.value}, http_status={self.http_status}, "
            f"message={self.message!r}, details={self.details!r})"
        )


def biz_error(
    code: ErrorCode,
    message: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    http_status: Optional[int] = None,
) -> BizError:
    """便捷构造 BizError（供业务代码一行 raise 使用）.

    Examples:
        raise biz_error(ErrorCode.RESOURCE_NOT_FOUND, "题目不存在", {"id": 42})
        raise biz_error(ErrorCode.BIZ_QUOTA_EXCEEDED)
    """
    return BizError(code, message=message, http_status=http_status, details=details)


# ── 标准 HTTP 状态码映射（供响应层 / 异常处理器参考）─────────
# 与 _DEFAULT_HTTP_STATUS 等价，但以 HTTP 状态码为键的反向视图，
# 用于在处理 FastAPI HTTPException 时按状态码挑选最贴近的 ErrorCode。
HTTP_STATUS_TO_ERROR_CODE: dict[int, ErrorCode] = {
    400: ErrorCode.PARAM_INVALID,
    401: ErrorCode.AUTH_TOKEN_INVALID,
    402: ErrorCode.BIZ_PAYMENT_FAILED,
    403: ErrorCode.AUTH_PERMISSION_DENIED,
    404: ErrorCode.RESOURCE_NOT_FOUND,
    409: ErrorCode.RESOURCE_CONFLICT,
    410: ErrorCode.RESOURCE_GONE,
    422: ErrorCode.PARAM_INVALID,
    429: ErrorCode.BIZ_RATE_LIMITED,
    451: ErrorCode.BIZ_CONTENT_TAKEDOWN,
    500: ErrorCode.SYS_INTERNAL_ERROR,
    502: ErrorCode.SYS_THIRD_PARTY_ERROR,
    503: ErrorCode.SYS_AI_ERROR,
}


__all__ = [
    "ErrorCode",
    "BizError",
    "biz_error",
    "HTTP_STATUS_TO_ERROR_CODE",
]
