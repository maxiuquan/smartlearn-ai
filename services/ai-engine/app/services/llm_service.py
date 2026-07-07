"""
LLM 大语言模型服务

通过多供应商 AI 路由层调用 LLM，提供解释生成、对话、学习计划生成等功能。
支持离线模式（无 API Key 时使用模拟响应）。
"""

import logging
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger("ai_engine.services.llm")

# 添加项目根目录到路径，以便导入 config 和 app 内模块
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import settings
from app.services.rag_service import get_rag_service
from app.providers.router import get_router


# ─── 系统提示词模板 ──────────────────────────────────────────

SYSTEM_TUTOR = """你是一位专业的考研辅导 AI 导师，名字叫「SmartLearn 小智」。
你的职责是帮助学生理解知识点、解答疑问、提供学习建议。

要求：
- 回答要准确、专业、有深度
- 使用中文回答，数学公式使用 LaTeX 格式
- 如果学生问的是数学题，给出详细的解题步骤
- 如果学生问的是英语问题，给出中英文双语解释
- 鼓励学生，保持积极的学习氛围
- 如果提供了参考知识点上下文，请结合上下文进行回答"""

SYSTEM_EXPLAIN = """你是一位专业的考研辅导 AI 导师。
请根据提供的题目和答案，给出详细的解析说明。

要求：
- 解释解题思路和关键步骤
- 说明涉及的知识点
- 如果有常见错误，请指出
- 使用中文回答，数学公式使用 LaTeX 格式"""

SYSTEM_STUDY_PLAN = """你是一位考研学习规划专家。
请根据学生的薄弱知识点，制定个性化的学习计划。

要求：
- 按优先级排列学习内容
- 给出具体的时间安排建议
- 推荐学习方法和资源
- 设定可衡量的阶段性目标
- 使用中文回答"""


# ─── 学科推断 ────────────────────────────────────────────────

def _infer_subject(messages: list[dict[str, str]]) -> str:
    """从对话消息中推断学科"""
    # 合并所有用户消息内容
    all_text = ""
    for msg in messages:
        if msg.get("role") == "user":
            all_text += msg.get("content", "") + " "

    all_lower = all_text.lower()

    # 数学关键词
    math_keywords = [
        "数学", "math", "导数", "积分", "微分", "矩阵", "概率", "统计",
        "方程", "函数", "几何", "极限", "向量", "线性代数", "微积分",
        "sin", "cos", "tan", "log", "dx", "dy", "lim", "sum",
    ]
    for kw in math_keywords:
        if kw in all_lower:
            return "math"

    # 英语关键词
    english_keywords = [
        "英语", "english", "单词", "翻译", "语法", "阅读", "作文",
        "vocabulary", "grammar", "reading", "writing", "translate",
        "完形填空", "阅读理解", "英译汉", "汉译英",
    ]
    for kw in english_keywords:
        if kw in all_lower:
            return "english"

    # 政治关键词
    politics_keywords = [
        "政治", "politics", "马原", "毛概", "思修", "史纲", "时政",
        "马克思主义", "中国特色社会主义",
    ]
    for kw in politics_keywords:
        if kw in all_lower:
            return "politics"

    # 专业课关键词
    professional_keywords = [
        "专业课", "计算机", "408", "数据结构", "操作系统", "计算机网络",
        "组成原理", "算法", "编程", "python", "java", "c++",
    ]
    for kw in professional_keywords:
        if kw in all_lower:
            return "professional"

    return "default"


class LLMService:
    """LLM 大语言模型服务（通过多供应商路由层）"""

    def __init__(self) -> None:
        self._rag = get_rag_service()
        self._router = get_router()

    # ── 核心调用 ────────────────────────────────────────────

    def _call_llm(
        self,
        messages: list[dict[str, str]],
        max_tokens: int | None = None,
        temperature: float | None = None,
        subject: str = "default",
    ) -> str:
        """通过路由层调用 LLM"""
        if max_tokens is None:
            max_tokens = settings.LLM_MAX_TOKENS
        if temperature is None:
            temperature = settings.LLM_TEMPERATURE

        # 自动推断学科
        if subject == "default":
            subject = _infer_subject(messages)

        try:
            return self._router.chat_completion(
                messages=messages,
                subject=subject,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        except Exception as e:
            # 安全整改 C4：运行时故障不再静默伪装成成功。
            # 离线模式由 AIRouter 直接返回模拟响应（不会进入此分支）。
            logger.error(
                "LLM 调用失败（运行时故障，不再静默 mock）: %s",
                e,
                exc_info=True,
            )
            raise

    def _mock_response(self, messages: list[dict[str, str]]) -> str:
        """离线模式：生成模拟响应"""
        # 提取最后一条用户消息
        user_msg = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_msg = msg.get("content", "")
                break

        # 根据消息内容智能生成模拟响应
        if "解释" in user_msg or "解析" in user_msg or "讲解" in user_msg:
            return (
                "【模拟解析 - 离线模式】\n\n"
                "这道题目考察的是相关知识点。解题关键步骤如下：\n\n"
                "1. 首先分析题目条件，明确已知量和未知量\n"
                "2. 选择合适的公式或方法\n"
                "3. 代入计算，注意单位换算和符号\n"
                "4. 验证结果的合理性\n\n"
                "💡 **提示**：配置 AI 供应商 API Key 环境变量后，可获得 AI 驱动的详细解析。"
            )
        elif "学习计划" in user_msg or "plan" in user_msg.lower():
            return (
                "【模拟学习计划 - 离线模式】\n\n"
                "📅 **建议学习计划**\n\n"
                "**第一阶段（1-2周）：基础巩固**\n"
                "- 每天复习 2-3 个薄弱知识点\n"
                "- 每个知识点做 5-10 道基础题\n"
                "- 整理错题笔记\n\n"
                "**第二阶段（3-4周）：强化提升**\n"
                "- 针对薄弱环节进行专项训练\n"
                "- 每天完成一套模拟题\n"
                "- 分析错题原因\n\n"
                "**第三阶段（5-6周）：冲刺模拟**\n"
                "- 限时完成真题\n"
                "- 查漏补缺\n"
                "- 调整心态\n\n"
                "💡 **提示**：配置 AI 供应商 API Key 环境变量后，可获得个性化的 AI 学习计划。"
            )
        else:
            return (
                "【模拟回复 - 离线模式】\n\n"
                "你好！我是 SmartLearn 小智，你的考研 AI 导师。\n\n"
                "你的问题我已经收到了。在离线模式下，我无法提供完整的 AI 驱动回答。\n\n"
                "💡 **提示**：配置 AI 供应商 API Key 环境变量后，我可以为你提供：\n"
                "- 详细的题目解析和解题思路\n"
                "- 个性化学习计划\n"
                "- 知识点深度讲解\n"
                "- 答疑解惑\n\n"
                "请设置环境变量，例如：`export GLM_API_KEY=your-api-key`"
            )

    # ── 公开方法 ────────────────────────────────────────────

    def generate_explanation(
        self,
        question: str,
        answer: str,
        context: str = "",
    ) -> str:
        """生成题目解析

        Args:
            question: 题目内容
            answer: 题目答案
            context: 可选的上下文（知识点等）
        """
        # 如果没有提供上下文，使用 RAG 检索
        if not context:
            rag_contexts = self._rag.retrieve_context(question)
            context = self._rag.format_context_for_llm(rag_contexts)

        user_prompt = (
            f"请为以下题目提供详细的解析说明：\n\n"
            f"## 题目\n{question}\n\n"
            f"## 答案\n{answer}\n\n"
            f"## 参考知识点\n{context}"
        )

        messages: list[dict[str, str]] = [
            {"role": "system", "content": SYSTEM_EXPLAIN},
            {"role": "user", "content": user_prompt},
        ]

        return self._call_llm(messages)

    def chat(
        self,
        messages: list[dict[str, str]],
        context: str = "",
    ) -> str:
        """AI 导师对话

        Args:
            messages: 对话历史消息列表，格式 [{"role": "user", "content": "..."}]
            context: 可选的上下文知识
        """
        # 如果没有提供上下文，从最后一条用户消息检索
        if not context:
            last_user = ""
            for msg in reversed(messages):
                if msg.get("role") == "user":
                    last_user = msg.get("content", "")
                    break
            if last_user:
                rag_contexts = self._rag.retrieve_context(last_user)
                context = self._rag.format_context_for_llm(rag_contexts)

        full_messages: list[dict[str, str]] = [
            {"role": "system", "content": SYSTEM_TUTOR},
        ]

        if context:
            full_messages.append(
                {
                    "role": "system",
                    "content": f"以下是与当前对话相关的参考知识点：\n\n{context}",
                }
            )

        full_messages.extend(messages)
        return self._call_llm(full_messages)

    def generate_study_plan(
        self,
        subject: str,
        weak_points: list[str],
    ) -> str:
        """生成学习计划

        Args:
            subject: 学科名称
            weak_points: 薄弱知识点列表
        """
        # 使用 RAG 检索每个薄弱点的详细信息
        weak_point_details: list[str] = []
        for wp in weak_points:
            contexts = self._rag.retrieve_context(f"{subject} {wp}")
            if contexts:
                for ctx in contexts[:2]:
                    weak_point_details.append(
                        f"- {ctx.get('name', '')}: {ctx.get('description', '')}"
                    )

        details_text = "\n".join(weak_point_details) if weak_point_details else "暂无详细信息"

        user_prompt = (
            f"请为以下学生制定一个 {subject} 的学习计划：\n\n"
            f"## 薄弱知识点\n"
            + "\n".join(f"- {wp}" for wp in weak_points)
            + f"\n\n## 薄弱知识点详情\n{details_text}\n\n"
            f"请制定一个为期 4 周的学习计划，包含每周的学习目标和具体任务。"
        )

        messages: list[dict[str, str]] = [
            {"role": "system", "content": SYSTEM_STUDY_PLAN},
            {"role": "user", "content": user_prompt},
        ]

        return self._call_llm(messages, subject=subject)

    def chat_stream(
        self,
        messages: list[dict[str, str]],
        context: str = "",
    ):
        """流式对话（生成器）

        Args:
            messages: 对话历史消息列表
            context: 可选的上下文知识
        """
        if not context:
            last_user = ""
            for msg in reversed(messages):
                if msg.get("role") == "user":
                    last_user = msg.get("content", "")
                    break
            if last_user:
                rag_contexts = self._rag.retrieve_context(last_user)
                context = self._rag.format_context_for_llm(rag_contexts)

        full_messages: list[dict[str, str]] = [
            {"role": "system", "content": SYSTEM_TUTOR},
        ]
        if context:
            full_messages.append(
                {
                    "role": "system",
                    "content": f"以下是与当前对话相关的参考知识点：\n\n{context}",
                }
            )
        full_messages.extend(messages)

        subject = _infer_subject(messages)

        try:
            for chunk in self._router.chat_completion_stream(
                messages=full_messages,
                subject=subject,
                max_tokens=settings.LLM_MAX_TOKENS,
                temperature=settings.LLM_TEMPERATURE,
            ):
                yield chunk
        except Exception as e:
            print(f"LLM 流式调用失败: {e}")
            yield self._mock_response(full_messages)


# 全局单例
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    """获取 LLM 服务单例"""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service