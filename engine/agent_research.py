"""Agent-driven research orchestration.

Glues `engine.search` (web context) and `engine.agents` (LLM dispatch) into
the full "search → prompt → dispatch → parse → Idea" pipeline. Replaces the
SDK-based `researcher.run_research` for the new thin-orchestrator config
path.

This is the only module in the engine that knows about both `search` and
`agents`. They remain decoupled themselves — search backends don't know
about agents and vice versa.
"""
from __future__ import annotations

import json
import random
import re
import time
from datetime import date, datetime
from pathlib import Path
from typing import Sequence

import yaml

from agents import AgentError, AgentSpec, dispatch, detect_available
from models import DailyResearch, Idea, compute_review_dates
from search import SearchError, search


# Number of search snippets to feed into the prompt by default.
DEFAULT_SEARCH_N = 8
DEFAULT_SNIPPETS_IN_PROMPT = 5

# Subprocess timeout per dispatched agent. Research prompts can take ~30s+,
# so leave generous headroom.
DEFAULT_DISPATCH_TIMEOUT_SEC = 180


def build_search_query(domain: str, purpose_lens: str | None) -> str:
    """Compose a search query that biases toward startup-relevant signal."""
    base = f"{domain} startup trends pain points opportunities 2026"
    if purpose_lens:
        lens_short = purpose_lens.split(":", 1)[0].strip()
        return f"{base} {lens_short}"
    return base


def format_search_context(results: list[dict], max_items: int = DEFAULT_SNIPPETS_IN_PROMPT) -> str:
    """Render search results into a compact bulleted block for prompt inclusion."""
    if not results:
        return "(no live web results available — synthesize from prior knowledge)"
    lines: list[str] = []
    for r in results[:max_items]:
        title = r.get("title", "").strip()
        url = r.get("url", "").strip()
        snippet = (r.get("snippet") or "").strip().replace("\n", " ")
        if len(snippet) > 300:
            snippet = snippet[:300] + "…"
        lines.append(f"- {title} ({url})\n  {snippet}")
    return "\n".join(lines)


def build_research_prompt(
    domain: str,
    search_context: str,
    purpose_lens: str | None,
) -> str:
    """Construct the prompt fed to a CLI agent for one idea."""
    lens_clause = ""
    if purpose_lens:
        lens_clause = (
            f"\n\nValue lens (mandatory frame): {purpose_lens}\n"
            f"The startup idea must meaningfully advance this value, not just touch it."
        )
    return f"""You are a startup research analyst. Synthesize ONE novel startup idea in the "{domain}" domain.

Recent web context:
{search_context}

Use the context to ground your idea in real signals (pain points, trends, market size). Be specific and data-driven; cite at least one URL from the context.{lens_clause}

Output ONLY a single JSON object — no markdown fences, no commentary before or after — with this exact structure:

{{
  "title": "Concise name for the startup idea",
  "domain": "{domain}",
  "one_liner": "One-sentence pitch",
  "problem": "2-3 paragraphs as one string. Use spaces, no newlines.",
  "solution": "2-3 paragraphs as one string. Use spaces, no newlines.",
  "market_size": "TAM / SAM / SOM estimate with reasoning",
  "competitors": ["competitor1", "competitor2", "competitor3"],
  "moat_analysis": "What defensibility — network effects, data moats, switching costs?",
  "feasibility_score": 1-5,
  "novelty_score": 1-5,
  "sources": ["url1", "url2"],
  "tags": ["tag1", "tag2", "tag3"]
}}
"""


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.+?)\s*```", re.DOTALL)


def parse_idea_response(text: str) -> dict:
    """Extract the JSON object from an agent's stdout, tolerant of common wrappers.

    Strategy:
      1. If the text is bracketed by ```fences```, extract the contents.
      2. Else find the first `{` and the last `}` and treat that span as JSON.
      3. json.loads the result; failures propagate.
    """
    s = text.strip()

    match = _JSON_FENCE_RE.search(s)
    if match:
        s = match.group(1).strip()

    # Trim any leading prose before the JSON object.
    first = s.find("{")
    last = s.rfind("}")
    if first != -1 and last != -1 and last > first:
        s = s[first : last + 1]

    return json.loads(s)


def research_one(
    domain: str,
    idea_id: str,
    today_str: str,
    agents_chain: Sequence[AgentSpec],
    purpose_lens: str | None = None,
    search_n: int = DEFAULT_SEARCH_N,
    dispatch_timeout: int = DEFAULT_DISPATCH_TIMEOUT_SEC,
) -> Idea:
    """Search → prompt → dispatch → parse for a single idea slot.

    Search failures degrade gracefully (prompt notes "no live results");
    dispatch failures propagate (the caller decides whether to skip or retry).
    """
    query = build_search_query(domain, purpose_lens)
    try:
        search_results = search(query, n=search_n)
    except SearchError:
        search_results = []

    search_context = format_search_context(search_results)
    prompt = build_research_prompt(domain, search_context, purpose_lens)

    result = dispatch(prompt, list(agents_chain), timeout=dispatch_timeout)
    data = parse_idea_response(result.output)

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
        review_dates=compute_review_dates(today_str),
    )


# --- Full daily run ---


def _select_domains(config: dict, today: date) -> list[str]:
    """Pick domains for today. Same logic as legacy researcher.select_domains."""
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

    selected: list[str] = []
    pool = list(all_domains)
    random.shuffle(pool)
    selected.extend(pool[:min_domains])
    while len(selected) < n:
        selected.append(random.choice(all_domains))
    random.shuffle(selected)
    return selected[:n]


def _pick_lens_for_day(config: dict, today: date) -> tuple[str | None, float]:
    purpose_config = config.get("purpose", {})
    lenses = purpose_config.get("lenses", [])
    ratio = purpose_config.get("ratio", 0.8)
    if not lenses:
        return None, ratio
    lens_index = today.timetuple().tm_yday % len(lenses)
    return lenses[lens_index], ratio


def run_agent_research(config_path: Path) -> DailyResearch:
    """Full daily pipeline using the agent dispatch chain.

    Returns DailyResearch; the caller writes to disk / vault.
    """
    with open(config_path, encoding="utf-8") as f:
        config = yaml.safe_load(f)

    agents_config = config.get("agents", {})
    min_tier = int(agents_config.get("min_tier", 8))
    search_n = int(agents_config.get("search_n", DEFAULT_SEARCH_N))
    dispatch_timeout = int(
        agents_config.get("dispatch_timeout", DEFAULT_DISPATCH_TIMEOUT_SEC)
    )
    ollama_model = agents_config.get("ollama_model")  # None => fall back to env

    chain = detect_available(min_tier=min_tier, ollama_model=ollama_model)
    if not chain:
        raise AgentError(
            f"No CLI agents available with tier >= {min_tier}. "
            "Install claude / codex / gemini-cli and ensure they're on PATH."
        )
    print(f"  Agents in chain: {' -> '.join(f'{a.name}(t{a.tier})' for a in chain)}")

    today = date.today()
    today_str = today.isoformat()
    domains = _select_domains(config, today)
    today_lens, ratio = _pick_lens_for_day(config, today)
    if today_lens:
        print(f"  Purpose lens: {today_lens.split(':')[0]}")

    ideas: list[Idea] = []
    for i, domain in enumerate(domains):
        idea_id = f"{today_str}-{i + 1:03d}"
        use_lens = today_lens if (random.random() < ratio and today_lens) else None
        lens_tag = " [lens]" if use_lens else " [explore]"
        print(f"  [{i + 1}/{len(domains)}] {domain}...{lens_tag}")
        try:
            idea = research_one(
                domain=domain,
                idea_id=idea_id,
                today_str=today_str,
                agents_chain=chain,
                purpose_lens=use_lens,
                search_n=search_n,
                dispatch_timeout=dispatch_timeout,
            )
            ideas.append(idea)
            print(f"    -> [{result_agent_hint(idea)}] {idea.title}")
        except AgentError as e:
            print(f"    ERROR (agents): {e}")
        except Exception as e:
            print(f"    ERROR: {e}")
        # Light cooldown to be gentle on local SearXNG and CLI rate limits
        time.sleep(0.5)

    return DailyResearch(
        date=today_str,
        ideas=tuple(ideas),
        domains_covered=tuple(sorted(set(domains))),
        strategy_used=config["strategy"],
    )


def result_agent_hint(idea: Idea) -> str:
    """Best-effort short tag for which agent likely served — currently unknown
    at the Idea level because DispatchResult is not threaded through. Future:
    extend Idea with a `served_by` field."""
    return "agent"

