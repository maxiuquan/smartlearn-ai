"""
AI 对话历史持久化服务

将用户与 AI 的对话保存到 ``ai_conversations`` 表（ORM 已定义），
并支持查询历史对话。

设计依据：优化设计-2026-07-08 组G（G04 / A-P1-5）
注意：chat_router.py 的集成由组H统一修改（避免文件冲突）。
"""
import json
import logging
from typing import Any, Optional

import asyncpg

from app.db import get_pool

logger = logging.getLogger("ai_engine.conversation")


class ConversationService:
    """AI 对话历史持久化服务。

    通过 asyncpg 原始 SQL 访问共享 PostgreSQL 的 ``ai_conversations`` 表。
    表结构由 api 服务的 Alembic 迁移创建（``AIConversation`` ORM）。
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self._pool: Optional[asyncpg.Pool] = pool

    async def _ensure_pool(self) -> asyncpg.Pool:
        """惰性获取连接池。"""
        if self._pool is None:
            self._pool = await get_pool()
        return self._pool

    async def save(
        self,
        user_id: int,
        messages: list[dict[str, Any]],
        cited_kp: Optional[list] = None,
        token_cost: int = 0,
        provider: str = "",
        model: str = "",
    ) -> int:
        """保存一条对话记录到 ``ai_conversations`` 表。

        Args:
            user_id: 用户 ID（users 表外键）。
            messages: 对话消息列表 ``[{"role": "user", "content": "..."}, ...]``。
            cited_kp: 引用的知识点 ID 列表（可选）。
            token_cost: 本次对话消耗的 token 数。
            provider: AI 供应商标识（如 ``"glm"``）。
            model: 模型名称（如 ``"glm-4-flash"``）。

        Returns:
            新插入行的主键 ``id``。
        """
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO ai_conversations
                    (user_id, messages, cited_kp, token_cost, provider, model)
                VALUES
                    ($1, $2, $3, $4, $5, $6)
                RETURNING id
                """,
                user_id,
                json.dumps(messages, ensure_ascii=False),
                json.dumps(cited_kp, ensure_ascii=False) if cited_kp else None,
                token_cost,
                provider or None,
                model or None,
            )
            conv_id = row["id"] if row else 0
            logger.info(
                "Saved conversation id=%d for user_id=%d (provider=%s, model=%s)",
                conv_id, user_id, provider, model,
            )
            return conv_id

    async def get_history(
        self,
        user_id: int,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """查询用户最近的对话历史。

        Args:
            user_id: 用户 ID。
            limit: 返回条数上限（默认 20）。

        Returns:
            对话记录列表，按 ``created_at DESC`` 排序，每条包含
            ``id``/``user_id``/``messages``/``cited_kp``/``token_cost``/
            ``provider``/``model``/``created_at``。
        """
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, user_id, messages, cited_kp,
                       token_cost, provider, model, created_at
                FROM ai_conversations
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                user_id,
                limit,
            )
            results = []
            for r in rows:
                messages = r["messages"]
                if isinstance(messages, str):
                    messages = json.loads(messages)
                cited_kp = r["cited_kp"]
                if isinstance(cited_kp, str):
                    cited_kp = json.loads(cited_kp)
                results.append({
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "messages": messages,
                    "cited_kp": cited_kp,
                    "token_cost": r["token_cost"],
                    "provider": r["provider"],
                    "model": r["model"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                })
            return results
