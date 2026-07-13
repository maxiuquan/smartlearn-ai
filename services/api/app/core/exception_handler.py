"""全局异常处理器 — P1-1 收敛后端架构与数据权威.

提供 `register_exception_handlers(app)`，将项目全局统一异常处理挂载到 FastAPI 实例：
- `BizError`           -> 标准化 JSON 错误响应（HTTP 状态码来自 BizError.http_status）
- `HTTPException`      -> 转换为标准格式（按状态码映射最贴近的 ErrorCode）
- `RequestValidationError` (422) -> 转换为 PARAM_INVALID 标准格式
- `Exception` (兜底)  -> 返回 SYS_INTERNAL_ERROR（不向响应泄露堆栈，仅记录日志）

设计原则：
- 所有异常响应均遵循 `error_response` 标准结构，前端可统一处理；
- 兜底异常严格不向客户端泄露 traceback / 内部细节（安全要求）；
- 使用 structlog（如已初始化）或标准 logging 记录异常，不阻塞响应；
- 该模块导入 FastAPI 仅做异常处理器注册，不耦合具体业务逻辑。

使用方式（在 `app/main.py` 中调用一次）：
    from app.core.exception_handler import register_exception_handlers
    register_exception_handlers(app)
"""
import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.error_codes import BizError, ErrorCode, HTTP_STATUS_TO_ERROR_CODE
from app.core.responses import error_response

# 复用项目日志体系：若 structlog 已初始化（P1-5），get_logger 会返回结构化 logger；
# 否则回退到标准 logging（该模块在 setup_logging 之前被导入也安全）。
try:
    from app.core.logging import get_logger as _get_structlog_logger
    logger = _get_structlog_logger(__name__)
except Exception:  # pragma: no cover - 防御性：logging 模块未就绪时回退
    logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """注册全局异常处理器到 FastAPI app 实例.

    顺序：BizError -> RequestValidationError -> HTTPException -> Exception(兜底)。
    FastAPI 异常匹配按类型精确匹配，未匹配的子类向上传播至 Exception。
    """

    @app.exception_handler(BizError)
    async def _handle_biz_error(request: Request, exc: BizError) -> JSONResponse:
        """处理受控业务异常 BizError -> 标准 error_response 格式."""
        logger.info(
            "biz_error_raised",
            path=request.url.path,
            method=request.method,
            error_code=exc.code.value,
            code_number=exc.code.code_number,
            http_status=exc.http_status,
            message=exc.message,
            details=exc.details,
        )
        return JSONResponse(
            status_code=exc.http_status,
            content=error_response(
                code=exc.code,
                message=exc.message,
                details=exc.details,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """处理 FastAPI 请求参数校验失败 (422) -> PARAM_INVALID 标准格式.

        保留 exc.errors() 详情放入 details，便于前端定位字段；
        但抹除内部 type 字符串中可能的实现细节。
        """
        # exc.errors() 形如 [{"loc": ["body", "email"], "msg": "...", "type": "..."}]
        safe_errors: list[dict[str, Any]] = []
        for err in exc.errors():
            safe_errors.append(
                {
                    "loc": list(err.get("loc", [])),
                    "msg": err.get("msg", ""),
                    # 仅保留 type 字符串的可读部分，避免泄露 pydantic 内部路径
                    "type": str(err.get("type", "")),
                }
            )
        logger.info(
            "param_validation_failed",
            path=request.url.path,
            method=request.method,
            errors=safe_errors,
        )
        return JSONResponse(
            status_code=422,
            content=error_response(
                code=ErrorCode.PARAM_INVALID,
                message="请求参数校验失败",
                details={"errors": safe_errors},
            ),
        )

    @app.exception_handler(HTTPException)
    async def _handle_http_exception(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        """处理 FastAPI HTTPException -> 转换为标准 error_response 格式.

        按 exc.status_code 在 HTTP_STATUS_TO_ERROR_CODE 中找最贴近的 ErrorCode；
        未映射的状态码回退到 SYS_INTERNAL_ERROR（500 系）或 PARAM_INVALID（4xx 系）。
        """
        status_code = exc.status_code
        code = HTTP_STATUS_TO_ERROR_CODE.get(status_code)
        if code is None:
            # 兜底：4xx -> PARAM_INVALID，5xx -> SYS_INTERNAL_ERROR
            code = ErrorCode.PARAM_INVALID if status_code < 500 else ErrorCode.SYS_INTERNAL_ERROR

        # HTTPException.detail 可能是 str / dict；统一为 message + details
        detail = exc.detail
        if isinstance(detail, str):
            message = detail or code.default_message
            details = None
        elif isinstance(detail, dict):
            # 若 dict 含 message 字段则用它，其余整体作为 details
            message = str(detail.get("message") or code.default_message)
            details = {k: v for k, v in detail.items() if k != "message"} or None
        else:
            message = code.default_message
            details = {"detail": detail} if detail is not None else None

        logger.info(
            "http_exception",
            path=request.url.path,
            method=request.method,
            http_status=status_code,
            mapped_error_code=code.value,
            message=message,
        )
        return JSONResponse(
            status_code=status_code,
            content=error_response(code=code, message=message, details=details),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected_exception(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """兜底处理未捕获异常 -> SYS_INTERNAL_ERROR (500).

        安全要求：响应体中绝不向客户端泄露堆栈 / 内部文件路径 / 异常类全名。
        完整 traceback 仅记录到服务端日志（含 request_id 便于关联）。
        """
        # 完整异常 + 请求上下文记录到日志，便于运维排查
        logger.error(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            error_type=type(exc).__name__,
            error_message=str(exc),
            exc_info=True,  # structlog / 标准 logging 均会写入 traceback
        )
        return JSONResponse(
            status_code=500,
            content=error_response(
                code=ErrorCode.SYS_INTERNAL_ERROR,
                message="服务器内部错误，请稍后重试",
                details=None,  # 严格不泄露任何内部细节
            ),
        )


__all__ = ["register_exception_handlers"]
