"""P0/P1 整改：新增认证会话/内容版权/支付账务/RAG 索引等表

Revision ID: 006
Revises: 005
Create Date: 2026-07-13

本次迁移落地商用级审查报告 P0/P1 整改所需的数据表：
- P0-2 认证会话：auth_sessions
- P0-5 内容版权：content_assets, content_takedown_requests
- P1-4 支付账务：orders, order_events, outbox_events
- P1-2 持久化 RAG：knowledge_documents, document_chunks, embedding_jobs, index_versions, retrieval_traces

datetime 列统一使用 TIMESTAMP WITHOUT TIME ZONE（与既有表一致）。
updated_at 由应用层 onupdate=func.now() 维护，不依赖数据库触发器。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── P0-2: auth_sessions ──
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False, index=True),
        sa.Column("session_id", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("refresh_token_hash", sa.String(255), nullable=True),
        sa.Column("device_name", sa.String(255), nullable=True),
        sa.Column("device_id", sa.String(128), nullable=True, index=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="false", index=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("revoke_reason", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_active_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )

    # ── P0-5: content_assets ──
    op.create_table(
        "content_assets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset_type", sa.String(30), nullable=False, index=True),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("source_ref", sa.String(500), nullable=True),
        sa.Column("license_type", sa.String(50), nullable=True),
        sa.Column("license_scope", sa.String(200), nullable=True),
        sa.Column("commercial_use", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("ai_processing_allowed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("evidence_file_url", sa.String(500), nullable=True),
        sa.Column("content_ref_id", sa.String(100), nullable=True, index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active", index=True),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── P0-5: content_takedown_requests ──
    op.create_table(
        "content_takedown_requests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "asset_id",
            sa.Integer(),
            sa.ForeignKey("content_assets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("requester_type", sa.String(20), nullable=False),
        sa.Column("requester_id", sa.Integer(), nullable=True),
        sa.Column("requester_name", sa.String(100), nullable=True),
        sa.Column("requester_contact", sa.String(200), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("evidence_url", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── P1-4: orders ──
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_no", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("product_type", sa.String(30), nullable=False),
        sa.Column("product_snapshot", sa.Text(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="CNY"),
        sa.Column("status", sa.String(20), nullable=False, server_default="created", index=True),
        sa.Column("third_party_trade_no", sa.String(128), nullable=True, index=True),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("refunded_at", sa.DateTime(), nullable=True),
        sa.Column("refund_amount_cents", sa.Integer(), nullable=True),
        sa.Column("refund_reason", sa.String(500), nullable=True),
        sa.Column("callback_raw", sa.Text(), nullable=True),
        sa.Column("signature_valid", sa.Boolean(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── P1-4: order_events ──
    op.create_table(
        "order_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "order_id",
            sa.Integer(),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("from_status", sa.String(20), nullable=True),
        sa.Column("to_status", sa.String(20), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("operator_id", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── P1-4: outbox_events ──
    op.create_table(
        "outbox_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("aggregate_type", sa.String(50), nullable=False),
        sa.Column("aggregate_id", sa.Integer(), nullable=False, index=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retry", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(), nullable=True),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── P1-2: knowledge_documents ──
    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("doc_type", sa.String(30), nullable=False, index=True),
        sa.Column("doc_ref_id", sa.String(100), nullable=True, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("source", sa.String(200), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("acl_scope", sa.String(100), nullable=True, server_default="public"),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── P1-2: document_chunks ──
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("knowledge_points", sa.String(500), nullable=True),
        sa.Column("acl_scope", sa.String(100), nullable=True, server_default="public"),
        sa.Column("embedding_model", sa.String(100), nullable=True),
        sa.Column("embedding_version", sa.String(50), nullable=True),
        sa.Column("embedding", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── P1-2: embedding_jobs ──
    op.create_table(
        "embedding_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "chunk_id",
            sa.Integer(),
            sa.ForeignKey("document_chunks.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("idempotency_key", sa.String(100), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retry", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── P1-2: index_versions ──
    op.create_table(
        "index_versions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("version", sa.String(50), nullable=False, unique=True),
        sa.Column("embedding_model", sa.String(100), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="staging"),
        sa.Column("activated_at", sa.DateTime(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── P1-2: retrieval_traces ──
    op.create_table(
        "retrieval_traces",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("request_id", sa.String(64), nullable=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=True, index=True),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("retrieved_chunk_ids", sa.Text(), nullable=True),
        sa.Column("scores", sa.Text(), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("prompt_hash", sa.String(64), nullable=True),
        sa.Column("cost_tokens", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS embedding_jobs_updated_at ON embedding_jobs")
    op.drop_table("embedding_jobs")
    op.drop_table("document_chunks")
    op.execute("DROP TRIGGER IF EXISTS knowledge_documents_updated_at ON knowledge_documents")
    op.drop_table("knowledge_documents")
    op.execute("DROP TRIGGER IF EXISTS outbox_events_updated_at ON outbox_events")
    op.drop_table("outbox_events")
    op.drop_table("order_events")
    op.execute("DROP TRIGGER IF EXISTS orders_updated_at ON orders")
    op.drop_table("orders")
    op.execute("DROP TRIGGER IF EXISTS content_takedown_requests_updated_at ON content_takedown_requests")
    op.drop_table("content_takedown_requests")
    op.execute("DROP TRIGGER IF EXISTS content_assets_updated_at ON content_assets")
    op.drop_table("content_assets")
    op.drop_table("auth_sessions")
