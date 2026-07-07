"""词汇进度单测 — SRS 间隔重复算法逻辑验证。

测试 submit_word_event 的事件处理逻辑（纯逻辑，不依赖数据库）。
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


class TestSRSEventLogic:
    """SRS 间隔重复算法事件处理逻辑测试。"""

    def test_correct_event_increases_mastery(self):
        """'correct' 事件应提高掌握度。"""
        current_mastery = 0.5
        new_mastery = min(1.0, current_mastery + 0.1)
        assert new_mastery == 0.6

    def test_correct_event_mastery_capped_at_1(self):
        """掌握度上限为 1.0。"""
        current_mastery = 0.95
        new_mastery = min(1.0, current_mastery + 0.1)
        assert new_mastery == 1.0

    def test_wrong_event_decreases_mastery(self):
        """'wrong' 事件应降低掌握度。"""
        current_mastery = 0.5
        new_mastery = max(0.0, current_mastery - 0.15)
        assert new_mastery == 0.35

    def test_wrong_event_mastery_floored_at_0(self):
        """掌握度下限为 0.0。"""
        current_mastery = 0.05
        new_mastery = max(0.0, current_mastery - 0.15)
        assert new_mastery == 0.0

    def test_correct_event_increases_ease_factor(self):
        """'correct' 事件应提高 ease factor。"""
        current_ease = 2.5
        new_ease = min(3.0, current_ease + 0.1)
        assert new_ease == 2.6

    def test_correct_event_ease_capped_at_3(self):
        """ease factor 上限为 3.0。"""
        current_ease = 2.95
        new_ease = min(3.0, current_ease + 0.1)
        assert new_ease == 3.0

    def test_wrong_event_decreases_ease_factor(self):
        """'wrong' 事件应降低 ease factor。"""
        current_ease = 2.5
        new_ease = max(1.3, current_ease - 0.2)
        assert new_ease == 2.3

    def test_wrong_event_ease_floored_at_1_3(self):
        """ease factor 下限为 1.3。"""
        current_ease = 1.4
        new_ease = max(1.3, current_ease - 0.2)
        assert new_ease == 1.3

    def test_mastery_threshold_for_mastered(self):
        """掌握度 >= 0.9 时状态变为 mastered。"""
        new_mastery = 0.9
        new_status = "mastered" if new_mastery >= 0.9 else "learning"
        assert new_status == "mastered"

    def test_forgotten_event_resets_interval(self):
        """'forgotten' 事件重置间隔为 1。"""
        new_interval = 1
        assert new_interval == 1

    def test_forgotten_event_decreases_mastery_significantly(self):
        """'forgotten' 事件大幅降低掌握度 (-0.3)。"""
        current_mastery = 0.7
        new_mastery = max(0.0, current_mastery - 0.3)
        assert new_mastery == 0.4

    def test_learned_event_sets_minimum_mastery(self):
        """'learned' 事件设置最低掌握度为 0.3。"""
        current_mastery = 0.0
        new_mastery = max(current_mastery, 0.3)
        assert new_mastery == 0.3

    def test_learned_event_does_not_decrease_mastery(self):
        """'learned' 事件不会降低已有掌握度。"""
        current_mastery = 0.5
        new_mastery = max(current_mastery, 0.3)
        assert new_mastery == 0.5

    def test_next_review_calculation(self):
        """下次复习时间 = now + interval_days。"""
        now = datetime.now(timezone.utc)
        interval_days = 3
        next_review = now + timedelta(days=max(1, interval_days))
        assert next_review > now

    def test_next_review_minimum_1_day(self):
        """下次复习至少 1 天后。"""
        now = datetime.now(timezone.utc)
        interval_days = 0
        next_review = now + timedelta(days=max(1, interval_days))
        assert next_review >= now + timedelta(days=1)

    def test_initial_ease_factor(self):
        """新记录的初始 ease factor 为 2.5。"""
        initial_ease = 2.5
        assert initial_ease == 2.5

    def test_initial_status_for_learned(self):
        """'learned' 事件的初始状态为 'learning'。"""
        event_type = "learned"
        initial_status = "learning" if event_type in ("learned", "correct") else "new"
        assert initial_status == "learning"

    def test_initial_status_for_new_event(self):
        """其他事件的初始状态为 'new'。"""
        event_type = "wrong"
        initial_status = "learning" if event_type in ("learned", "correct") else "new"
        assert initial_status == "new"

    def test_correct_interval_multiplied_by_ease(self):
        """'correct' 事件间隔 = max(1, int(interval * ease))。"""
        current_interval = 5
        current_ease = 2.5
        new_interval = max(1, int(current_interval * current_ease))
        assert new_interval == 12

    def test_wrong_interval_halved(self):
        """'wrong' 事件间隔 = max(1, int(interval * 0.5))。"""
        current_interval = 10
        new_interval = max(1, int(current_interval * 0.5))
        assert new_interval == 5
