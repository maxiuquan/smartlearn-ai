"""P0-01 (R7): GameAnswerEvent 唯一约束补全

Revision ID: 012
Revises: 011
Create Date: 2026-07-14

R7 审计报告要求：GameAnswerEvent 增加 UNIQUE(session_id, question_id)，
防止同一 session 对同一题目重复写入答题事件（DB 级幂等兜底）。
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "012"
down_revision: str = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """添加 (session_id, question_id) 唯一约束."""
    # 先清理潜在重复数据（保留每组最小 id）
    op.execute(
        """
        DELETE FROM game_answer_events
        WHERE id NOT IN (
            SELECT min_id FROM (
                SELECT MIN(id) AS min_id
                FROM game_answer_events
                GROUP BY session_id, question_id
            ) AS keep_ids
        )
        """
    )
    op.create_unique_constraint(
        "uq_game_answer_session_question",
        "game_answer_events",
        ["session_id", "question_id"],
    )


def downgrade() -> None:
    """移除 (session_id, question_id) 唯一约束."""
    op.drop_constraint(
        "uq_game_answer_session_question", "game_answer_events", type_="unique"
    )
