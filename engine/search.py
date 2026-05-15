"""Asagiri search abstraction with pluggable backends and fallback chain.

Decouples web search from LLM providers. Engine code calls `search()`; the
module dispatches to one or more backends (SearXNG first, optional Brave
fallback). When all backends fail the chain raises `SearchError`.

Return shape from `search()` is a list of plain dicts with keys
`{title, url, snippet, engine}` — JSON-friendly so output layers don't need
to know about internal dataclasses.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterable

import httpx


class SearchError(Exception):
    """Raised when every backend in the chain fails."""


@dataclass(frozen=True)
class SearchResult:
    title: str
    url: str
    snippet: str
    engine: str


class SearchBackend(ABC):
    name: str

    @abstractmethod
    def search(self, query: str, n: int) -> list[SearchResult]:
        ...


class SearxngBackend(SearchBackend):
    name = "searxng"

    def __init__(self, base_url: str, timeout: float = 10.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    def search(self, query: str, n: int) -> list[SearchResult]:
        resp = httpx.get(
            f"{self._base_url}/search",
            params={"q": query, "format": "json"},
            timeout=self._timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        out: list[SearchResult] = []
        for r in data.get("results", [])[:n]:
            engines = r.get("engines") or [r.get("engine", "searxng")]
            out.append(
                SearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    snippet=r.get("content", ""),
                    engine="+".join(engines),
                )
            )
        return out


class BraveBackend(SearchBackend):
    name = "brave"

    def __init__(self, api_key: str, timeout: float = 10.0) -> None:
        self._api_key = api_key
        self._timeout = timeout

    def search(self, query: str, n: int) -> list[SearchResult]:
        resp = httpx.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": n},
            headers={
                "X-Subscription-Token": self._api_key,
                "Accept": "application/json",
            },
            timeout=self._timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        out: list[SearchResult] = []
        for r in data.get("web", {}).get("results", [])[:n]:
            out.append(
                SearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    snippet=r.get("description", ""),
                    engine="brave",
                )
            )
        return out


class FallbackChain(SearchBackend):
    name = "fallback"

    def __init__(self, backends: Iterable[SearchBackend]) -> None:
        self._backends = list(backends)

    def search(self, query: str, n: int) -> list[SearchResult]:
        errors: list[str] = []
        for backend in self._backends:
            try:
                return backend.search(query, n)
            except Exception as e:
                errors.append(f"{backend.name}: {e}")
        raise SearchError(f"All backends failed: {' | '.join(errors)}")


def build_default_chain() -> FallbackChain:
    """Build a chain from env vars.

    - `SEARXNG_URL` (default `http://localhost:8888`): primary backend.
    - `BRAVE_API_KEY` (optional): if set, Brave is appended as fallback.
    """
    backends: list[SearchBackend] = []
    searxng_url = os.environ.get("SEARXNG_URL", "http://localhost:8888")
    backends.append(SearxngBackend(searxng_url))

    brave_key = os.environ.get("BRAVE_API_KEY")
    if brave_key:
        backends.append(BraveBackend(brave_key))

    return FallbackChain(backends)


def search(query: str, n: int = 10) -> list[dict]:
    """Convenience entry point — build default chain and run a query.

    Returns a list of plain dicts so the result is trivially serializable.
    """
    chain = build_default_chain()
    return [
        {"title": r.title, "url": r.url, "snippet": r.snippet, "engine": r.engine}
        for r in chain.search(query, n)
    ]
