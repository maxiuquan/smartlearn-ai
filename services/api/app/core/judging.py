"""判题引擎 — 按题型分派，支持数学符号等价判定.

判题策略：
- 选择题（choice/multiple_choice）：精确匹配选项字母或内容
- 数学题（math/fill_blank）：用 SymPy 做数值/符号等价判定
  - 归一化：去空格、统一大小写、剥离 LaTeX 包裹、去 x= 前缀
  - 符号等价：simplify(a - b) == 0
  - 数值等价：float(a) == float(b)（容差 1e-9）
  - 多答案：answer 支持 `|` 分隔的多解集合
- 填空题（fill_blank）：规范化后精确匹配，支持多答案
- 其他：回退到规范化字符串比较
"""
from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# 题型常量
TYPE_CHOICE = "choice"
TYPE_MULTIPLE_CHOICE = "multiple_choice"
TYPE_MATH = "math"
TYPE_CALCULATION = "calculation"
TYPE_FILL_BLANK = "fill_blank"
TYPE_FILL_IN = "fill_in"
# 所有需要 SymPy 等价判定的题型
_MATH_TYPES = (TYPE_MATH, TYPE_CALCULATION)

_NUM_OK_TYPES = (int, float, complex)

try:
    from sympy import Rational, simplify, sympify
    from sympy.parsing.latex import parse_latex  # 可选，缺失时降级

    _SYMPY_OK = True
except Exception:  # sympy 初始化失败时降级
    _SYMPY_OK = False
    parse_latex = None  # type: ignore[assignment]
    logger.warning("sympy 不可用，数学判题将降级为字符串比较")


def _strip_outer(s: str) -> str:
    """归一化：去首尾空白、统一大小写、去 LaTeX 包裹与 x= 前缀."""
    s = s.strip().lower()
    # 剥离常见 LaTeX 包裹：$...$, \(...\), \[...\]
    s = re.sub(r"^\$+| \$+$", "", s)
    s = re.sub(r"^\\\(|\\\)$", "", s)
    s = re.sub(r"^\\\[|\\\]$", "", s)
    # 去 x=、y= 等变量前缀
    s = re.sub(r"^[a-z]\s*=\s*", "", s)
    return s.strip()


def _parse_equation(expr: str):
    """将等式（含 =）转为左-右的表达式；无 = 则原样返回."""
    if "=" not in expr:
        return None
    parts = expr.split("=", 1)
    if len(parts) != 2:
        return None
    try:
        left = sympify(parts[0], evaluate=True)
        right = sympify(parts[1], evaluate=True)
        return left - right
    except Exception:
        return None


def _try_sympy_eq(user: str, answer: str) -> Optional[bool]:
    """尝试用 SymPy 判定等价，失败返回 None."""
    if not _SYMPY_OK:
        return None
    try:
        # 处理等式：2x+y-z=1  vs  2x+y-z-1=0
        u_eq = _parse_equation(user)
        a_eq = _parse_equation(answer)
        if u_eq is not None and a_eq is not None:
            return simplify(u_eq - a_eq) == 0
        # 一方是等式、另一方是表达式：不匹配
        if u_eq is not None or a_eq is not None:
            return False

        a = sympify(user, evaluate=True)
        b = sympify(answer, evaluate=True)
        if simplify(a - b) == 0:
            return True
        # 数值近似相等（容差）
        if isinstance(a, _NUM_OK_TYPES) and isinstance(b, _NUM_OK_TYPES):
            return abs(float(a) - float(b)) < 1e-9
        # 处理 1/2 vs 0.5
        try:
            fa, fb = float(a), float(b)
            return abs(fa - fb) < 1e-9
        except (TypeError, ValueError):
            return False
    except Exception:
        return None


def _parse_latex_safe(expr: str) -> Optional[str]:
    """尝试解析 LaTeX，失败返回 None."""
    if not _SYMPY_OK or parse_latex is None:
        return None
    try:
        return str(parse_latex(expr))
    except Exception:
        return None


def _normalize_fill(s: str) -> str:
    """填空题规范化：去标点、去多余空白、统一大小写."""
    s = s.strip().lower()
    s = re.sub(r"[。.,，;；!！?？]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s


def judge_answer(user_answer: str, correct_answer: str, question_type: str = "choice") -> bool:
    """判题入口：按题型分派.

    Args:
        user_answer: 用户提交的答案
        correct_answer: 题目标准答案（多答案用 `|` 分隔）
        question_type: 题型

    Returns:
        是否正确
    """
    if not user_answer or not correct_answer:
        return False

    qtype = (question_type or "").strip().lower()
    # 标准答案支持多解：A|B|C
    candidates = [c.strip() for c in correct_answer.split("|") if c.strip()]

    if qtype in (TYPE_CHOICE, TYPE_MULTIPLE_CHOICE):
        # 选择题：比较选项字母（A/B/C/D）或完整文本
        u = user_answer.strip().lower()
        return any(u == c.strip().lower() for c in candidates)

    if qtype in _MATH_TYPES:
        # 数学题：SymPy 等价判定
        u = _strip_outer(user_answer)
        for c in candidates:
            c_norm = _strip_outer(c)
            if u == c_norm:
                return True
            result = _try_sympy_eq(u, c_norm)
            if result is True:
                return True
            # 尝试 LaTeX 解析
            c_latex = _parse_latex_safe(c_norm)
            if c_latex:
                r2 = _try_sympy_eq(u, c_latex)
                if r2 is True:
                    return True
        return False

    if qtype in (TYPE_FILL_BLANK, TYPE_FILL_IN):
        # 填空题：规范化后匹配
        u = _normalize_fill(user_answer)
        return any(u == _normalize_fill(c) for c in candidates)

    # 默认：规范化字符串比较
    u = user_answer.strip().lower()
    return any(u == c.strip().lower() for c in candidates)
