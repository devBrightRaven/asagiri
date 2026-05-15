"""Asagiri Research Engine — LEGACY SDK PATH (deprecated).

Supports SDK-based LLM providers: Gemini (free tier), Anthropic Claude,
Perplexity Sonar. Each provider class is bound to a vendor SDK and pulls
its own web context via that SDK's grounding/search feature.

DEPRECATED as of refactor/thin-orchestrator. Prefer the new agent chain
path in `agent_research.run_agent_research`, which dispatches CLI agents
(claude / codex / gemini-cli / ollama) and decouples web search via
SearXNG. The new path:
  * has no vendor SDK dependency
  * keeps search and generation as separate concerns
  * falls back across backends without re-running search

This module remains importable so `main.py` can still serve old configs
that lack an `agents:` section. Plan: remove after 30 days of stable
chain runs.
"""
from __future__ import annotations

import json
import random
import time
import warnings
from abc import ABC, abstractmethod
from datetime import date, datetime
from pathlib import Path

import yaml
from dotenv import load_dotenv

from models import DailyResearch, Idea, compute_review_dates

load_dotenv()


def _emit_legacy_deprecation_once() -> None:
    """Emit a single DeprecationWarning the first time legacy code path runs."""
    if getattr(_emit_legacy_deprecation_once, "_emitted", False):
        return
    warnings.warn(
        "researcher.run_research (SDK path) is deprecated; "
        "add an `agents:` section to config.yaml to use the agent chain.",
        DeprecationWarning,
        stacklevel=2,
    )
    _emit_legacy_deprecation_once._emitted = True  # type: ignore[attr-defined]

RESEARCH_PROMPT = """You are a startup research analyst. Research a specific startup opportunity in the "{domain}" domain.

Search the web for:
1. Current trends and pain points in this domain
2. Recent startups or products addressing similar problems
3. Market size data
4. Technology feasibility

Then synthesize your findings into a novel startup idea that addresses a real gap you discovered.

Output ONLY valid JSON (no markdown, no explanation) with this exact structure:
{{
  "title": "Concise name for the startup idea",
  "domain": "{domain}",
  "one_liner": "One sentence pitch",
  "problem": "2-3 paragraphs describing the problem, backed by data from your research",
  "solution": "2-3 paragraphs describing the proposed solution and how it works",
  "market_size": "TAM/SAM/SOM estimate with reasoning",
  "competitors": ["competitor1", "competitor2", "competitor3"],
  "moat_analysis": "What defensibility does this idea have? Network effects, data moats, switching costs?",
  "feasibility_score": 1-5,
  "novelty_score": 1-5,
  "sources": ["url1", "url2"],
  "tags": ["tag1", "tag2", "tag3"]
}}

Be specific, data-driven, and creative. The idea should be novel - not just a copy of existing solutions."""


# --- Provider Abstraction (DEPRECATED) ---
#
# These provider classes couple LLM generation with vendor-specific web search.
# Kept for legacy config compatibility. New code should call
# `agent_research.research_one` instead, which decouples search.py from
# agents.py and avoids vendor SDK lock-in.


class LLMProvider(ABC):
    """Abstract base for LLM providers with web search (deprecated)."""

    @abstractmethod
    def research(self, domain: str, purpose_lens: str | None = None) -> str:
        """Send research prompt, return raw text response."""


class GeminiProvider(LLMProvider):
    """Google Gemini with Google Search grounding (free tier).

    Uses two-step approach because response_mime_type is incompatible
    with Google Search tool:
    1. Research with web search (free-form text)
    2. Format into JSON (structured output)
    """

    def __init__(self, model: str = "gemini-2.5-flash"):
        from google import genai
        from google.genai import types

        self._genai = genai
        self._types = types
        self._client = genai.Client()
        self._model = model

    def research(self, domain: str, purpose_lens: str | None = None) -> str:
        types = self._types

        # Step 1: Research with web search (free-form)
        lens_instruction = ""
        if purpose_lens:
            lens_instruction = (
                f" Focus especially on opportunities that advance this value: "
                f"{purpose_lens}. The startup idea should meaningfully contribute "
                f"to this purpose, not just tangentially."
            )
        research_prompt = (
            f"Research the \"{domain}\" domain for startup opportunities. "
            f"Find: 1) Current trends and pain points, 2) Recent startups, "
            f"3) Market size data, 4) Technology feasibility.{lens_instruction} "
            f"Be specific with data, URLs, and numbers."
        )
        research_response = self._client.models.generate_content(
            model=self._model,
            contents=research_prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.7,
                max_output_tokens=4096,
            ),
        )
        research_text = research_response.text or ""

        # Step 2: Format into JSON (structured output, no web search)
        format_prompt = (
            f'Based on this research about the "{domain}" domain:\n\n'
            f"{research_text}\n\n"
            f"Synthesize a NOVEL startup idea and output ONLY valid JSON "
            f"(no markdown, no explanation) with this structure:\n"
            f'{{"title": "...", "domain": "{domain}", "one_liner": "...", '
            f'"problem": "2-3 paragraphs as a single string, use spaces not newlines", '
            f'"solution": "2-3 paragraphs as a single string, use spaces not newlines", '
            f'"market_size": "TAM/SAM/SOM", '
            f'"competitors": ["c1","c2","c3"], '
            f'"moat_analysis": "...", '
            f'"feasibility_score": 1-5, "novelty_score": 1-5, '
            f'"sources": ["url1","url2"], '
            f'"tags": ["t1","t2","t3"]}}'
        )
        format_response = self._client.models.generate_content(
            model=self._model,
            contents=format_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.5,
                max_output_tokens=4096,
            ),
        )
        return format_response.text


class ClaudeProvider(LLMProvider):
    """Anthropic Claude with web search."""

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        import anthropic
        self._client = anthropic.Anthropic()
        self._model = model

    def research(self, domain: str) -> str:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            tools=[{"type": "web_search_20250305"}],
            messages=[
                {"role": "user", "content": RESEARCH_PROMPT.format(domain=domain)}
            ],
        )
        text_content = ""
        for block in response.content:
            if block.type == "text":
                text_content += block.text
        return text_content


class PerplexityProvider(LLMProvider):
    """Perplexity Sonar API (built-in web search)."""

    def __init__(self, model: str = "sonar"):
        import httpx
        import os
        self._api_key = os.environ["PERPLEXITY_API_KEY"]
        self._model = model
        self._httpx = httpx

    def research(self, domain: str) -> str:
        response = self._httpx.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self._model,
                "messages": [
                    {"role": "user", "content": RESEARCH_PROMPT.format(domain=domain)}
                ],
                "max_tokens": 4096,
                "temperature": 0.9,
            },
            timeout=120,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


def create_provider(config: dict) -> LLMProvider:
    """Factory: create the right LLM provider from config."""
    llm_config = config.get("llm", {})
    provider = llm_config.get("provider", "gemini")
    model = llm_config.get("model", "")

    if provider == "gemini":
        return GeminiProvider(model or "gemini-2.0-flash-001")
    elif provider == "claude":
        return ClaudeProvider(model or "claude-sonnet-4-20250514")
    elif provider == "perplexity":
        return PerplexityProvider(model or "sonar")
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


# --- Core Logic ---

def load_config(config_path: Path) -> dict:
    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def select_domains(config: dict, today: date) -> list[str]:
    strategy = config["strategy"]
    all_domains = config["domains"]
    n = config["ideas_per_day"]
    min_domains = config["min_domains_per_day"]

    if strategy == "themed":
        day_name = today.strftime("%A").lower()
        theme = config["theme_schedule"].get(day_name, "mixed")
        if theme != "mixed":
            themed_count = n // 2
            random_count = n - themed_count
            other_domains = [d for d in all_domains if d != theme]
            random_domains = random.sample(
                other_domains, min(random_count, len(other_domains))
            )
            return [theme] * themed_count + random_domains

    selected = []
    pool = list(all_domains)
    random.shuffle(pool)
    base_domains = pool[:min_domains]
    for d in base_domains:
        selected.append(d)
    while len(selected) < n:
        selected.append(random.choice(all_domains))
    random.shuffle(selected)
    return selected[:n]


def parse_json_response(text: str) -> dict:
    """Extract JSON from LLM response, handling markdown wrapping."""
    json_str = text.strip()
    if json_str.startswith("```"):
        json_str = json_str.split("\n", 1)[1]
        json_str = json_str.rsplit("```", 1)[0]
    return json.loads(json_str)


def research_idea(provider: LLMProvider, domain: str, idea_id: str, today_str: str, purpose_lens: str | None = None) -> Idea:
    """Research a single startup idea using the configured provider."""
    text = provider.research(domain, purpose_lens=purpose_lens)
    data = parse_json_response(text)
    review_dates = compute_review_dates(today_str)

    return Idea(
        id=idea_id,
        title=data["title"],
        domain=data.get("domain", domain),
        one_liner=data["one_liner"],
        problem=data["problem"],
        solution=data["solution"],
        market_size=data["market_size"],
        competitors=tuple(data.get("competitors", [])),
        moat_analysis=data.get("moat_analysis", ""),
        feasibility_score=int(data.get("feasibility_score", 3)),
        novelty_score=int(data.get("novelty_score", 3)),
        sources=tuple(data.get("sources", [])),
        tags=tuple(data.get("tags", [])),
        created_at=datetime.now().isoformat(),
        review_dates=review_dates,
    )


def run_research(config_path: Path) -> DailyResearch:
    """Run the full daily research pipeline (LEGACY SDK path).

    Prefer `agent_research.run_agent_research`. This function is kept for
    backwards compatibility with configs that still declare an `llm:`
    provider without an `agents:` section.
    """
    _emit_legacy_deprecation_once()
    config = load_config(config_path)
    provider = create_provider(config)

    llm_info = config.get("llm", {})
    provider_name = llm_info.get("provider", "gemini")
    model_name = llm_info.get("model", "default")
    print(f"  Provider: {provider_name} ({model_name})")

    today = date.today()
    today_str = today.isoformat()
    domains = select_domains(config, today)

    # Purpose lens selection
    purpose_config = config.get("purpose", {})
    lenses = purpose_config.get("lenses", [])
    ratio = purpose_config.get("ratio", 0.8)
    today_lens = None
    if lenses:
        # Rotate through lenses by day of year
        lens_index = today.timetuple().tm_yday % len(lenses)
        today_lens = lenses[lens_index]
        print(f"  Purpose lens: {today_lens.split(':')[0]}")

    max_retries = 3
    ideas = []
    for i, domain in enumerate(domains):
        idea_id = f"{today_str}-{i+1:03d}"
        # 80:20 — most ideas use the lens, some are pure exploration
        use_lens = today_lens if (random.random() < ratio and today_lens) else None
        lens_tag = " [lens]" if use_lens else " [explore]"
        print(f"  [{i+1}/{len(domains)}] Researching: {domain}...{lens_tag}")
        for attempt in range(max_retries):
            try:
                idea = research_idea(provider, domain, idea_id, today_str, purpose_lens=use_lens)
                ideas.append(idea)
                print(f"    -> {idea.title}")
                break
            except Exception as e:
                err = str(e)
                if "429" in err and attempt < max_retries - 1:
                    wait = 60 * (attempt + 1)
                    print(f"    Rate limited, waiting {wait}s (attempt {attempt+1}/{max_retries})...")
                    time.sleep(wait)
                else:
                    print(f"    ERROR: {e}")
                    break

    unique_domains = tuple(sorted(set(domains)))

    return DailyResearch(
        date=today_str,
        ideas=tuple(ideas),
        domains_covered=unique_domains,
        strategy_used=config["strategy"],
    )
