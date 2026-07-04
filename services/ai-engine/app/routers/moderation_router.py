"""
内容安全审核路由
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.providers import get_router

router = APIRouter(prefix="/moderation", tags=["内容安全"])


# ─── 请求/响应模型 ──────────────────────────────────────────

class ModerationRequest(BaseModel):
    """内容审核请求"""
    text: str = Field(..., description="待审核文本", min_length=1, max_length=10000)
    context: str = Field(default="", description="上下文信息（如来源模块）")
    user_id: str = Field(default="", description="用户 ID（可选）")


class ModerationResult(BaseModel):
    """审核结果"""
    flagged: bool = Field(..., description="是否违规")
    category: str = Field(default="", description="违规类别")
    severity: str = Field(default="", description="严重程度: low/medium/high")
    reason: str = Field(default="", description="违规原因")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="置信度")
    suggestion: str = Field(default="", description="修改建议")


class ModerationResponse(BaseModel):
    """审核响应"""
    results: list[ModerationResult] = Field(default_factory=list, description="审核结果列表")
    overall_flagged: bool = Field(..., description="整体是否违规")
    passed: bool = Field(..., description="是否通过审核")


class BatchModerationRequest(BaseModel):
    """批量审核请求"""
    items: list[ModerationRequest] = Field(..., description="待审核文本列表", max_length=50)


# ─── 辅助函数 ───────────────────────────────────────────────

def _to_moderation_response(result: dict) -> ModerationResponse:
    """将 moderate() 返回的字典转换为 ModerationResponse"""
    flagged = bool(result.get("flagged", False))
    categories = result.get("categories", []) or []
    reason = result.get("reason", "")
    confidence = float(result.get("confidence", 0.0))

    moderation_result = ModerationResult(
        flagged=flagged,
        category=", ".join(str(c) for c in categories) if isinstance(categories, list) else str(categories),
        severity="",
        reason=reason,
        confidence=confidence,
        suggestion="",
    )
    return ModerationResponse(
        results=[moderation_result],
        overall_flagged=flagged,
        passed=not flagged,
    )


# ─── 路由 ───────────────────────────────────────────────────

@router.post("", response_model=ModerationResponse)
async def moderate_content(request: ModerationRequest):
    """
    内容安全审核

    对 AI 输出或用户生成内容（UGC）进行安全审核。
    支持检测：色情、暴力、政治敏感、违法信息、人身攻击等。
    """
    ai_router = get_router()
    try:
        result = ai_router.moderate(
            text=request.text,
            context=request.context,
        )
        return _to_moderation_response(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"审核失败: {str(e)}")


@router.post("/batch", response_model=list[ModerationResponse])
async def moderate_batch(request: BatchModerationRequest):
    """
    批量内容审核

    同时审核多条文本内容。
    """
    ai_router = get_router()
    results = []
    for item in request.items:
        try:
            result = ai_router.moderate(
                text=item.text,
                context=item.context,
            )
            results.append(_to_moderation_response(result))
        except Exception as e:
            results.append(ModerationResponse(
                results=[ModerationResult(flagged=True, category="error", reason=str(e))],
                overall_flagged=True,
                passed=False,
            ))
    return results


@router.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "service": "moderation",
        "available": True,
    }
