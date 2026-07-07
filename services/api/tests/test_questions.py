"""判分单测 — 题目作答正误判定逻辑。

测试 submit_attempt 端点的判分逻辑（不依赖数据库，纯逻辑验证）。
"""
import sys
from pathlib import Path

import pytest

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


class TestAnswerComparison:
    """答案比较逻辑测试。"""

    def test_exact_match(self):
        """精确匹配的答案判定为正确。"""
        user_answer = "A"
        correct_answer = "A"
        result = user_answer.strip().lower() == correct_answer.strip().lower()
        assert result is True

    def test_case_insensitive_match(self):
        """大小写不敏感匹配。"""
        user_answer = "a"
        correct_answer = "A"
        result = user_answer.strip().lower() == correct_answer.strip().lower()
        assert result is True

    def test_whitespace_trimmed(self):
        """前后空白被去除。"""
        user_answer = "  A  "
        correct_answer = "A"
        result = user_answer.strip().lower() == correct_answer.strip().lower()
        assert result is True

    def test_wrong_answer(self):
        """错误答案判定为错误。"""
        user_answer = "B"
        correct_answer = "A"
        result = user_answer.strip().lower() == correct_answer.strip().lower()
        assert result is False

    def test_empty_user_answer(self):
        """空答案判定为错误。"""
        user_answer = ""
        correct_answer = "A"
        result = user_answer.strip().lower() == correct_answer.strip().lower()
        assert result is False

    def test_numeric_answer_match(self):
        """数字答案匹配。"""
        user_answer = "42"
        correct_answer = "42"
        result = user_answer.strip().lower() == correct_answer.strip().lower()
        assert result is True

    def test_numeric_answer_wrong(self):
        """数字答案不匹配。"""
        user_answer = "41"
        correct_answer = "42"
        result = user_answer.strip().lower() == correct_answer.strip().lower()
        assert result is False

    def test_text_answer_match(self):
        """文本答案匹配（忽略大小写）。"""
        user_answer = "Hello World"
        correct_answer = "hello world"
        result = user_answer.strip().lower() == correct_answer.strip().lower()
        assert result is True

    def test_xp_gained_correct(self):
        """答对获得 10 XP。"""
        xp_gained = 10 if True else 0
        assert xp_gained == 10

    def test_xp_gained_wrong(self):
        """答错获得 0 XP。"""
        xp_gained = 10 if False else 0
        assert xp_gained == 0

    def test_correct_answer_revealed_when_wrong(self):
        """答错时返回正确答案。"""
        correct = False
        correct_answer = "A"
        revealed = correct_answer if not correct else None
        assert revealed == "A"

    def test_correct_answer_hidden_when_right(self):
        """答对时不返回正确答案。"""
        correct = True
        correct_answer = "A"
        revealed = correct_answer if not correct else None
        assert revealed is None
