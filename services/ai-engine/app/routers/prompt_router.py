"""
Prompt 管理与评测路由
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import require_auth, require_service_or_admin

logger = logging.getLogger("ai_engine.routers.prompt")

router = APIRouter(prefix="/prompts", tags=["Prompt 管理"])


# ─── Prompt 模板库 ──────────────────────────────────────────

PROMPT_TEMPLATES = {
    "system_tutor": {
        "name": "AI 导师系统提示词",
        "version": "1.0.0",
        "description": "AI 答疑时的系统提示词，强制引用知识库来源",
        "template": (
            "你是一个专业的考研辅导 AI 导师，名叫「SmartLearn 助手」。\n\n"
            "## 核心原则\n"
            "1. 只依据提供的【知识库内容】作答，给出引用编号（kp-id）\n"
            "2. 如果没有相关依据，明确说明「当前知识库中暂无相关信息」，不臆造答案\n"
            "3. 数学公式使用 LaTeX 格式：行内 $...$，独立公式 $$...$$\n"
            "4. 回答简洁清晰，面向考研学生\n"
            "5. 如果置信度低，建议「教研复核」\n\n"
            "## 知识库内容\n"
            "{context}\n\n"
            "请基于以上知识库内容回答学生的问题。"
        ),
    },
    "system_explain": {
        "name": "题目解析提示词",
        "version": "1.0.0",
        "description": "生成题目解析时的系统提示词",
        "template": (
            "你是一个考研题目解析专家。\n\n"
            "## 解析要求\n"
            "1. 逐步分析解题思路，每一步标注依据的知识点\n"
            "2. 数学题使用 LaTeX 格式\n"
            "3. 指出常见错误和易错点\n"
            "4. 解析必须与题目答案一致\n"
            "5. 如果题目本身有误，明确指出\n\n"
            "## 输出格式\n"
            "### 知识点\n"
            "列出涉及的知识点\n\n"
            "### 解题步骤\n"
            "分步解析\n\n"
            "### 易错提醒\n"
            "常见错误\n\n"
            "### 知识库依据\n"
            "{context}\n\n"
            "请解析以下题目：\n"
            "{question}"
        ),
    },
    "system_study_plan": {
        "name": "学习计划生成提示词",
        "version": "1.0.0",
        "description": "生成个性化学习计划时的系统提示词",
        "template": (
            "你是一个考研学习规划师。\n\n"
            "## 规划原则\n"
            "1. 根据学生的薄弱知识点，制定针对性学习计划\n"
            "2. 合理安排每日学习时间和内容\n"
            "3. 考虑知识点的依赖关系（先学基础，再学进阶）\n"
            "4. 包含复习计划（间隔重复）\n\n"
            "## 知识库内容\n"
            "{context}\n\n"
            "## 学生薄弱点\n"
            "{weak_points}\n\n"
            "请为 {subject} 科目制定学习计划。"
        ),
    },
    "system_writing_review": {
        "name": "英语作文批改提示词",
        "version": "1.0.0",
        "description": "批改英语作文/翻译时的系统提示词",
        "template": (
            "你是一个考研英语写作批改专家。\n\n"
            "## 批改要求\n"
            "1. 按考研评分维度打分：内容完整性、结构连贯性、语言准确性、词汇丰富度\n"
            "2. 逐句给出修改建议和批注\n"
            "3. 提供范文改写\n"
            "4. 标注语法错误和用词不当\n\n"
            "## 输出格式\n"
            "### 总体评分\n"
            "分项得分\n\n"
            "### 逐句批注\n"
            "原句 → 修改建议\n\n"
            "### 范文改写\n"
            "优化后的全文\n\n"
            "请批改以下作文：\n"
            "{essay}"
        ),
    },
    "system_sentence_parse": {
        "name": "长难句拆解提示词",
        "version": "1.0.0",
        "description": "拆解英语长难句的系统提示词",
        "template": (
            "你是一个英语语法分析专家。\n\n"
            "## 分析要求\n"
            "1. 标注句子成分：主语、谓语、宾语、定语、状语、补语、从句类型\n"
            "2. 逐步拆解，从主句到从句\n"
            "3. 标注从句类型和引导词\n"
            "4. 提供中文翻译\n\n"
            "## 输出格式\n"
            "### 主句结构\n"
            "主语: ...\n"
            "谓语: ...\n"
            "宾语: ...\n\n"
            "### 从句分析\n"
            "- [类型] 引导词: ...\n"
            "  成分: ...\n\n"
            "### 中文翻译\n"
            "...\n\n"
            "请分析以下句子：\n"
            "{sentence}"
        ),
    },
    "system_fallback": {
        "name": "通用回退提示词",
        "version": "1.0.0",
        "description": "当专属提示词不可用时的通用提示词",
        "template": (
            "你是一个专业的考研辅导 AI 助手。\n\n"
            "## 知识库内容\n"
            "{context}\n\n"
            "请依据知识库回答用户问题。"
        ),
    },
}


# ─── 请求/响应模型 ──────────────────────────────────────────

class PromptTemplate(BaseModel):
    """Prompt 模板"""
    name: str
    version: str
    description: str
    template: str


class PromptRenderRequest(BaseModel):
    """渲染 Prompt 请求"""
    template_id: str = Field(..., description="模板 ID")
    variables: dict[str, str] = Field(default_factory=dict, description="模板变量")


class PromptRenderResponse(BaseModel):
    """渲染 Prompt 响应"""
    rendered_prompt: str = Field(..., description="渲染后的完整 Prompt")


class PromptCreateRequest(BaseModel):
    """创建 Prompt 模板请求"""
    template_id: str = Field(..., description="模板 ID")
    name: str = Field(..., description="模板名称")
    version: str = Field(default="1.0.0", description="版本")
    description: str = Field(default="", description="描述")
    template: str = Field(..., description="模板内容")


class PromptUpdateRequest(BaseModel):
    """更新 Prompt 模板请求"""
    template: str = Field(..., description="模板内容")
    description: str = Field(default="", description="描述")


# ─── 路由 ───────────────────────────────────────────────────

@router.get("", response_model=list[PromptTemplate])
async def list_prompts():
    """列出所有 Prompt 模板"""
    return [
        PromptTemplate(
            name=t["name"],
            version=t["version"],
            description=t["description"],
            template=t["template"],
        )
        for t in PROMPT_TEMPLATES.values()
    ]


@router.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "service": "prompts",
        "template_count": len(PROMPT_TEMPLATES),
        "templates": list(PROMPT_TEMPLATES.keys()),
    }


@router.get("/{template_id}", response_model=PromptTemplate)
async def get_prompt(template_id: str):
    """获取指定 Prompt 模板"""
    if template_id not in PROMPT_TEMPLATES:
        raise HTTPException(status_code=404, detail=f"模板不存在: {template_id}")
    t = PROMPT_TEMPLATES[template_id]
    return PromptTemplate(
        name=t["name"],
        version=t["version"],
        description=t["description"],
        template=t["template"],
    )


@router.post("/render", response_model=PromptRenderResponse)
async def render_prompt(request: PromptRenderRequest, _auth: dict = Depends(require_auth)):
    """
    渲染 Prompt 模板

    使用变量填充模板，生成完整的 Prompt。
    """
    if request.template_id not in PROMPT_TEMPLATES:
        raise HTTPException(status_code=404, detail=f"模板不存在: {request.template_id}")

    template = PROMPT_TEMPLATES[request.template_id]["template"]
    rendered = template

    # 安全地替换变量（未提供的变量保留原占位符）
    for key, value in request.variables.items():
        rendered = rendered.replace(f"{{{key}}}", value)

    return PromptRenderResponse(rendered_prompt=rendered)


@router.post("/{template_id}")
async def create_or_update_prompt(
    template_id: str,
    request: PromptCreateRequest,
    creds: dict = Depends(require_service_or_admin),
):
    """
    更新 Prompt 模板（C3 越权写防护）

    仅允许持有 service key（X-Api-Key=AI_ENGINE_API_KEY）或
    `role=admin` 的 JWT 修改；普通用户 JWT → 403。
    目标不存在 → 404（不泄露存在性）。
    成功修改记录审计日志。
    """
    # 不泄露存在性：目标不存在统一返回 404
    if template_id not in PROMPT_TEMPLATES:
        raise HTTPException(status_code=404, detail=f"模板不存在: {template_id}")

    PROMPT_TEMPLATES[template_id] = {
        "name": request.name,
        "version": request.version,
        "description": request.description,
        "template": request.template,
    }

    # 审计日志
    actor = creds.get("sub") or creds.get("auth_type")
    logger.warning(
        "审计[AUDIT]: prompt 模板被修改 template_id=%s actor=%s role=%s",
        template_id,
        actor,
        creds.get("role"),
    )
    return {
        "status": "ok",
        "template_id": template_id,
        "message": f"模板 '{template_id}' 已更新",
    }