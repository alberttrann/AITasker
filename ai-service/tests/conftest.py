"""
Shared pytest fixtures for the ai-service test suite.

WINDOWS EVENT LOOP POLICY
--------------------------
Python 3.8+ defaults to ProactorEventLoop on Windows. This loop has a known
issue where async TLS stream cleanup (httpcore → anyio → asyncio transport)
uses call_soon() which fails when called during a loop state transition between
tests, producing "RuntimeError: Event loop is closed".

WindowsSelectorEventLoopPolicy fixes this by using SelectorEventLoop, which
handles TLS cleanup synchronously without deferred call_soon scheduling.
This is set at import time so it applies before pytest-asyncio creates any loops.
"""

import sys
import asyncio

# ── Fix Windows ProactorEventLoop TLS cleanup crash ───────────────────────────
# Must be set before any event loop is created (i.e. at module import time).
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock
from httpx import AsyncClient, ASGITransport

from app.main import app


# ── App client fixture ────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client():
    """Async test client for the FastAPI app (function-scoped, mocked LLM)."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


# ── Gemini mock fixture ───────────────────────────────────────────────────────

@pytest.fixture
def mock_llm(monkeypatch):
    """
    Replace call_llm_json_with_system with a controllable mock.
    Tests set mock_llm.return_value to the dict they want returned.

    Usage:
        mock_llm.return_value = {"confidence_score": 0.90, ...}
    """
    mock = AsyncMock()
    monkeypatch.setattr("app.services.llm_client.call_llm_json_with_system", mock)
    monkeypatch.setattr("app.services.llm_client.call_llm_json", mock)
    return mock