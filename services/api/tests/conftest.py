"""pytest 共享 fixtures — API 服务测试基础设施。"""
import asyncio
import os
import sys
from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# 设置测试环境变量（在导入 app 之前）
os.environ.setdefault("ENVIRONMENT", "testing")
os.environ.setdefault("JWT_SECRET", "test-secret-key-at-least-32-characters-long-xxxxx")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("AI_ENGINE_AUTH_ENABLED", "false")


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """创建异步 HTTP 测试客户端（基于 ASGI transport，不打实际网络）。"""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def event_loop():
    """为每个测试创建独立的事件循环。"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
