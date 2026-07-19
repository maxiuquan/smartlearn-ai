"""统一响应格式 — P1-1 收敛后端架构与数据权威.

定义项目全局统一的响应包装函数：
- `success_response` — 成功响应的标准包装
- `error_response`   — 错误响应的标准包装
- `paginated_response` — 分页响应的标准包装

设计原则：
- 所有 API 端点（含异常处理器）必须返回此模块的标准格式，确保前端可统一解析；
- 成功响应与错误响应结构互斥，前端通过 `success` 字段（true/false）一次判断；
- 错误响应的 `error.code` 始终是 `ErrorCode` 枚举名（字符串），前端可据此做 i18n；
- 错误响应保留 `error.details` 字段供调试（生产环境由异常处理器裁剪敏感字段）。

成功响应示例：
    {"success": true, "data": {...}, "message": "success"}

错误响应示例：
    {"success": false, "error": {"code": "AUTH_TOKEN_INVALID", "code_number": 1003,
                                  "message": "无效的身份凭证", "details": null}}

分页响应示例：
    {"success": true, "data": {"items": [...], "total": 100, "page": 1, "page_size": 20}}
"""
from typing import Any, Optional

from app.core.error_codes import ErrorCode


def success_response(
    data: Any = None,
    message: str = "success",
) -> dict[str, Any]:
    """构造标准成功响应.

    Args:
        data: 任意可序列化的响应数据，None 时返回 null。
        message: 人类可读的成功消息，默认 "success"。

    Returns:
        {"success": true, "data": data, "message": message}
    """
    return {
        "success": True,
        "data": data,
        "message": message,
    }


def error_response(
    code: ErrorCode,
    message: str,
    details: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """构造标准错误响应.

    Args:
        code: ErrorCode 枚举值（如 ErrorCode.AUTH_TOKEN_INVALID）
        message: 错误消息（前端可直接展示）
        details: 额外调试细节，可选；生产环境应由调用方裁剪敏感字段

    Returns:
        {
            "success": false,
            "error": {
                "code": "AUTH_TOKEN_INVALID",       # str(ErrorCode)
                "code_number": 1003,                # 数字段（监控聚合用）
                "message": "无效的身份凭证",
                "details": {...} | null
            }
        }
    """
    return {
        "success": False,
        "error": {
            "code": code.value,
            "code_number": code.code_number,
            "message": message,
            "details": details,
        },
    }


def paginated_response(
    items: list[Any],
    total: int,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    """构造标准分页响应.

    Args:
        items: 当前页的数据项列表
        total: 全量数据总数（用于前端计算总页数）
        page: 当前页码（1-based）
        page_size: 每页大小

    Returns:
        {
            "success": true,
            "data": {
                "items": [...],
                "total": 100,
                "page": 1,
                "page_size": 20
            }
        }
    """
    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    }


__all__ = [
    "success_response",
    "error_response",
    "paginated_response",
]
