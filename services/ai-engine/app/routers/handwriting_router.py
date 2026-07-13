"""
手写答题批改路由
接收手写答题图片（base64），通过多模态 AI 识别+批改，给分纠错
"""
import base64
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth import require_auth, require_service_or_admin
from app.providers.router import get_router

logger = logging.getLogger("ai_engine.handwriting")

router = APIRouter(prefix="/handwriting", tags=["手写批改"])


# ─── 请求/响应模型 ──────────────────────────────────────────

class HandwritingGradeRequest(BaseModel):
    """手写批改请求"""
    image_data: str = Field(..., description="base64 编码的手写答题图片（不含 data:image/png;base64, 前缀）")
    question_content: str = Field(..., description="题目内容")
    correct_answer: str = Field(..., description="标准答案")
    question_type: str = Field(default="calculation", description="题目类型：choice/fill/calculation/math")
    options: dict | None = Field(default=None, description="选择题选项（如有）")
    knowledge_points: list[str] | None = Field(default=None, description="相关知识点")


class GradeResult(BaseModel):
    """批改结果"""
    is_correct: bool = Field(..., description="是否正确")
    score: int = Field(..., ge=0, le=100, description="得分（0-100）")
    recognized_text: str = Field(..., description="OCR 识别出的手写内容")
    user_answer: str = Field(..., description="从手写中提取的答案")
    feedback: str = Field(..., description="纠错反馈")
    steps_analysis: str | None = Field(default=None, description="步骤分析（计算题/证明题）")
    error_type: str | None = Field(default=None, description="错误类型：concept/calculation/logic/notation/none")


class HandwritingGradeResponse(BaseModel):
    """手写批改响应"""
    success: bool
    result: GradeResult | None = None
    error: str | None = None
    model_used: str = Field(default="", description="使用的模型")


# ─── 批改提示词模板 ──────────────────────────────────────────

GRADE_SYSTEM_PROMPT = """你是 SmartLearn 的智能批改助手。你的任务是：
1. 识别学生手写答题图片中的内容（OCR）
2. 提取学生的答案
3. 对照标准答案进行批改
4. 给出分数（0-100）
5. 指出错误并给出纠错建议

批改规则：
- 选择题(choice)：答案与标准答案一致即满分100，不一致0分
- 填空题(fill)：答案语义等价即满分，部分正确给部分分
- 计算题(calculation/math)：按步骤给分，最终答案正确且过程完整100分，答案对但过程不完整扣分，答案错但步骤部分正确给步骤分
- 证明题：按逻辑步骤完整度给分

输出格式（严格 JSON）：
{
  "recognized_text": "识别到的手写内容原文",
  "user_answer": "提取的最终答案",
  "is_correct": true/false,
  "score": 0-100,
  "feedback": "纠错反馈，指出具体错误和改进建议",
  "steps_analysis": "步骤分析（非选择题必填）",
  "error_type": "none/concept/calculation/logic/notation"
}

注意：
- error_type 为 none 表示全对；concept=概念错误；calculation=计算错误；logic=逻辑错误；notation=符号/书写错误
- 如果图片无法识别或内容为空，score=0, is_correct=false, feedback="无法识别手写内容"
"""


# ─── 端点 ──────────────────────────────────────────────────

@router.post("/grade", response_model=HandwritingGradeResponse)
async def grade_handwriting(
    request: HandwritingGradeRequest,
    auth: dict = Depends(require_auth),
):
    """手写答题批改

    接收手写答题图片，通过多模态 AI 进行：
    1. OCR 识别手写内容
    2. 提取答案
    3. 对照标准答案批改给分
    4. 生成纠错反馈
    """
    try:
        # 构建 user prompt
        user_prompt = f"""请批改以下学生手写答题：

## 题目内容
{request.question_content}

## 题目类型
{request.question_type}

## 标准答案
{request.correct_answer}
"""
        if request.options:
            options_text = "\n".join(f"  {k}. {v}" for k, v in request.options.items())
            user_prompt += f"\n## 选项\n{options_text}\n"

        if request.knowledge_points:
            user_prompt += f"\n## 相关知识点\n{', '.join(request.knowledge_points)}\n"

        user_prompt += "\n## 学生手写答题图片\n[见图片]\n\n请按系统提示的 JSON 格式输出批改结果。"

        # 构建 multimodal messages（图片 + 文本）
        # data_url 格式：data:image/png;base64,<base64_data>
        image_data_url = f"data:image/png;base64,{request.image_data}"

        messages = [
            {"role": "system", "content": GRADE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ],
            },
        ]

        # 调用多模态 AI
        router = get_router()
        try:
            # 优先使用支持视觉的模型
            response = await router.chat_completion(
                messages=messages,
                subject="math",
                max_tokens=1500,
                temperature=0.1,
            )
            model_used = "multimodal"
        except Exception as e:
            logger.warning("Multimodal grading failed, falling back: %s", e)
            # 降级：纯文本批改（无 OCR，要求用户手动输入）
            return HandwritingGradeResponse(
                success=False,
                error=f"多模态 AI 不可用：{str(e)}。请确保配置了支持视觉的 AI 供应商。",
                model_used="none",
            )

        # 解析 AI 返回的 JSON
        import json
        import re

        content = response.get("content", "") if isinstance(response, dict) else str(response)
        # 尝试提取 JSON
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            try:
                grade_data = json.loads(json_match.group())
                result = GradeResult(
                    is_correct=grade_data.get("is_correct", False),
                    score=int(grade_data.get("score", 0)),
                    recognized_text=grade_data.get("recognized_text", ""),
                    user_answer=grade_data.get("user_answer", ""),
                    feedback=grade_data.get("feedback", ""),
                    steps_analysis=grade_data.get("steps_analysis"),
                    error_type=grade_data.get("error_type", "none"),
                )
                return HandwritingGradeResponse(
                    success=True,
                    result=result,
                    model_used=model_used,
                )
            except (json.JSONDecodeError, ValueError, KeyError) as e:
                logger.error("Failed to parse grade JSON: %s", e)
                return HandwritingGradeResponse(
                    success=False,
                    error=f"批改结果解析失败：{str(e)}",
                    model_used=model_used,
                )
        else:
            # 未找到 JSON，返回原始内容
            return HandwritingGradeResponse(
                success=False,
                error="AI 未返回有效的批改结果",
                model_used=model_used,
            )

    except Exception as e:
        logger.error("Handwriting grading error: %s", e, exc_info=True)
        return HandwritingGradeResponse(
            success=False,
            error=f"批改服务异常：{str(e)}",
            model_used="none",
        )


@router.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok", "service": "handwriting"}
