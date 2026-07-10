"""Tests for engine/search.py — search abstraction with fallback chain."""
from __future__ import annotations

import json
import os
from unittest.mock import patch, MagicMock

import httpx
import pytest

from search import (
    SearchError,
    SearchResult,
    SearxngBackend,
    BraveBackend,
    FallbackChain,
    build_default_chain,
    search,
)


# --- SearxngBackend ---

def test_searxng_parses_results():
    fake_payload = {
        "results": [
            {
                "title": "Hacker News",
                "url": "https://news.ycombinator.com",
                "content": "links for the intellectually curious",
                "engines": ["duckduckgo", "google"],
            },
            {
                "title": "HN clones",
                "url": "https://example.com/hn",
                "content": "list of clones",
                "engines": ["google"],
            },
        ]
    }
    mock_resp = MagicMock()
    mock_resp.json.return_value = fake_payload
    mock_resp.raise_for_status.return_value = None
    with patch("search.httpx.get", return_value=mock_resp) as mock_get:
        backend = SearxngBackend("http://localhost:8888")
        results = backend.search("hacker news", n=10)
    assert len(results) == 2
    assert results[0].title == "Hacker News"
    assert results[0].url == "https://news.ycombinator.com"
    assert results[0].snippet.startswith("links")
    assert "duckduckgo" in results[0].engine
    mock_get.assert_called_once()
    args, kwargs = mock_get.call_args
    assert kwargs["params"]["format"] == "json"


def test_searxng_caps_at_n():
    fake = {"results": [{"title": f"r{i}", "url": f"https://x/{i}", "content": ""} for i in range(20)]}
    mock_resp = MagicMock()
    mock_resp.json.return_value = fake
    mock_resp.raise_for_status.return_value = None
    with patch("search.httpx.get", return_value=mock_resp):
        backend = SearxngBackend("http://localhost:8888")
        results = backend.search("q", n=5)
    assert len(results) == 5


def test_searxng_raises_on_http_error():
    mock_resp = MagicMock()
    mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        "503", request=MagicMock(), response=MagicMock(status_code=503)
    )
    with patch("search.httpx.get", return_value=mock_resp):
        backend = SearxngBackend("http://localhost:8888")
        with pytest.raises(httpx.HTTPStatusError):
            backend.search("q", n=10)


def test_searxng_raises_on_connection_error():
    with patch("search.httpx.get", side_effect=httpx.ConnectError("refused")):
        backend = SearxngBackend("http://localhost:8888")
        with pytest.raises(httpx.ConnectError):
            backend.search("q", n=10)


# --- BraveBackend ---

def test_brave_parses_results_and_sends_auth_header():
    fake = {
        "web": {
            "results": [
                {"title": "T1", "url": "https://u1", "description": "S1"},
                {"title": "T2", "url": "https://u2", "description": "S2"},
            ]
        }
    }
    mock_resp = MagicMock()
    mock_resp.json.return_value = fake
    mock_resp.raise_for_status.return_value = None
    with patch("search.httpx.get", return_value=mock_resp) as mock_get:
        backend = BraveBackend("test-key")
        results = backend.search("q", n=10)
    assert len(results) == 2
    assert results[0].engine == "brave"
    args, kwargs = mock_get.call_args
    assert kwargs["headers"]["X-Subscription-Token"] == "test-key"


# --- FallbackChain ---

def test_chain_uses_first_when_succeeds():
    a = MagicMock(spec=SearxngBackend)
    a.name = "a"
    a.search.return_value = [SearchResult("T", "u", "s", "a")]
    b = MagicMock(spec=BraveBackend)
    b.name = "b"
    chain = FallbackChain([a, b])
    results = chain.search("q", n=10)
    assert results[0].engine == "a"
    a.search.assert_called_once()
    b.search.assert_not_called()


def test_chain_falls_back_when_first_fails():
    a = MagicMock(spec=SearxngBackend)
    a.name = "searxng"
    a.search.side_effect = httpx.ConnectError("down")
    b = MagicMock(spec=BraveBackend)
    b.name = "brave"
    b.search.return_value = [SearchResult("T", "u", "s", "brave")]
    chain = FallbackChain([a, b])
    results = chain.search("q", n=10)
    assert results[0].engine == "brave"
    a.search.assert_called_once()
    b.search.assert_called_once()


def test_chain_raises_search_error_when_all_fail():
    a = MagicMock(spec=SearxngBackend)
    a.name = "searxng"
    a.search.side_effect = httpx.ConnectError("down")
    b = MagicMock(spec=BraveBackend)
    b.name = "brave"
    b.search.side_effect = httpx.HTTPStatusError(
        "500", request=MagicMock(), response=MagicMock(status_code=500)
    )
    chain = FallbackChain([a, b])
    with pytest.raises(SearchError) as exc_info:
        chain.search("q", n=10)
    msg = str(exc_info.value)
    assert "searxng" in msg
    assert "brave" in msg


def test_chain_empty_raises():
    chain = FallbackChain([])
    with pytest.raises(SearchError):
        chain.search("q", n=10)


# --- build_default_chain ---

def test_default_chain_has_searxng_only_when_no_brave_key(monkeypatch):
    monkeypatch.delenv("BRAVE_API_KEY", raising=False)
    monkeypatch.setenv("SEARXNG_URL", "http://localhost:8888")
    chain = build_default_chain()
    assert len(chain._backends) == 1
    assert isinstance(chain._backends[0], SearxngBackend)


def test_default_chain_adds_brave_when_key_present(monkeypatch):
    monkeypatch.setenv("BRAVE_API_KEY", "key123")
    monkeypatch.setenv("SEARXNG_URL", "http://localhost:8888")
    chain = build_default_chain()
    assert len(chain._backends) == 2
    assert isinstance(chain._backends[1], BraveBackend)


# --- module-level search() ---

def test_search_returns_plain_dicts(monkeypatch):
    monkeypatch.delenv("BRAVE_API_KEY", raising=False)
    fake = {"results": [{"title": "T", "url": "https://u", "content": "S", "engines": ["google"]}]}
    mock_resp = MagicMock()
    mock_resp.json.return_value = fake
    mock_resp.raise_for_status.return_value = None
    with patch("search.httpx.get", return_value=mock_resp):
        out = search("q", n=10)
    assert isinstance(out, list)
    assert isinstance(out[0], dict)
    assert set(out[0].keys()) == {"title", "url", "snippet", "engine"}


# --- Integration test (requires live SearXNG on localhost:8888) ---

@pytest.mark.integration
def test_live_searxng_returns_results():
    if not os.environ.get("RUN_INTEGRATION"):
        pytest.skip("set RUN_INTEGRATION=1 to run")
    backend = SearxngBackend("http://localhost:8888")
    results = backend.search("hacker news", n=5)
    assert len(results) > 0
    assert all(r.url.startswith("http") for r in results)
