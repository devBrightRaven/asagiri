"""Asagiri Research Engine.

Supports multiple LLM providers: Gemini (free), Claude, Perplexity.
"""
from __future__ import annotations

import json
import re
import random
import time
from dataclasses import dataclass
from datetime import datetime, date
from pathlib import Path
from abc import ABC, abstractmethod

import yaml
from dotenv import load_dotenv

from models import Idea, DailyResearch, compute_review_dates

load_dotenv()


# --- Research Report Validation ---

REQUIRED_SECTIONS = [
    "## Existing Solutions",
    "## Available APIs",
    "## Technical Approaches",
    "## Key Challenges",
    "## Cost-Optimized Prototype Strategy",
    "### Cost Table",
    "### The ONE Paid Service Worth It",
]

MAX_TABLE_CELL_CHARS = 80
MAX_TABLE_LINE_CHARS = 500


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    errors: tuple[str, ...]


def validate_research_report(report_md: str) -> ValidationResult:
    """Validate that a research report has all required sections and valid tables."""
    errors = []

    # Check required sections
    for section in REQUIRED_SECTIONS:
        # Match case-insensitively and allow partial matches (e.g. "## Available APIs & Services")
        section_key = section.lstrip("#").strip().lower()
        if section_key not in report_md.lower():
            errors.append(f"Missing section: {section}")

    # Check table formatting
    for line in report_md.split("\n"):
        if "|" in line and line.strip().startswith("|"):
            if len(line) > MAX_TABLE_LINE_CHARS:
                errors.append(
                    f"Table line too long ({len(line)} chars, max {MAX_TABLE_LINE_CHARS}): "
                    f"{line[:60]}..."
                )
            cells = [c.strip() for c in line.split("|") if c.strip()]
            for cell in cells:
                if len(cell) > MAX_TABLE_CELL_CHARS and "---" not in cell:
                    errors.append(
                        f"Table cell too long ({len(cell)} chars, max {MAX_TABLE_CELL_CHARS}): "
                        f"{cell[:40]}..."
                    )

    # Check minimum competitor count
    solutions_match = re.search(
        r"## Existing Solutions(.*?)(?=\n## )", report_md, re.DOTALL
    )
    if solutions_match:
        bullet_count = solutions_match.group(1).count("\n*   **")
        if bullet_count < 3:
            errors.append(f"Too few competitors listed: {bullet_count} (min 3)")

    return ValidationResult(valid=len(errors) == 0, errors=tuple(errors))


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


RESEARCH_REPORT_PROMPT = """You are a technical researcher. Given the following startup idea, research the current landscape and produce a technical research report.

IDEA:
{idea_text}

Search the web for:
1. Existing products, tools, and open-source projects that do something similar
2. Available APIs and services that could be used as building blocks (with pricing)
3. Key technical challenges others have encountered and how they solved them
4. Current state-of-the-art in relevant technologies
5. Community discussions, blog posts, or case studies about similar implementations

Output a structured research report in Markdown with these sections:

# [Project Name] — Technical Research Report

## Existing Solutions
List each competitor/similar product with: name, URL, what it does, pricing, strengths, weaknesses.

## Available APIs & Services
List relevant APIs/services that could be building blocks. Include: name, URL, capability, pricing tier, rate limits if known.

## Technical Approaches
What architectures or approaches have others used? Link to blog posts, repos, or docs.

## Key Challenges
What are the hardest technical problems? How have others solved or failed to solve them?

## Open Source Tools
Relevant libraries, frameworks, or repos. Include: name, GitHub URL, stars if visible, last updated, what it does.

## Feasibility Assessment
Based on your research, what is realistically achievable as a solo-developer MVP in 1-2 days? What requires more time or resources?

## Cost-Optimized Prototype Strategy
Based on your research, design the cheapest possible prototype that still demonstrates the core value proposition. Prioritize:
1. Free tiers and open-source alternatives over paid APIs
2. Local/self-hosted models over cloud APIs where feasible
3. Combining multiple free tools creatively
4. Identify the ONE paid service worth paying for if free options are insufficient (justify why)

Provide a concrete cost estimate: "Prototype budget: $X/month" with line-item breakdown.

IMPORTANT:
- Be specific — include URLs, version numbers, pricing.
- Distinguish between what exists today vs what is theoretical.
- Flag anything that is outdated or deprecated.
- The target user is a solo developer building a prototype on a near-zero budget.
- Output ONLY the markdown report, no preamble."""


SPEC_PROMPT = """You are a senior software architect. Given the following startup idea, create a detailed MVP specification.

IDEA:
{idea_text}

Research the web for:
1. Best practices and common tech stacks for this type of product
2. Existing open-source projects or tools in this space
3. Key technical challenges and how others have solved them

Then produce a comprehensive MVP spec document in Markdown format with these sections:

# [Project Name] — MVP Spec

## Overview
One paragraph summary of what this MVP does.

## MVP Scope
List exactly 3-5 core features. Each feature should have:
- Feature name
- One-sentence description
- Acceptance criteria (2-3 bullet points)

## Tech Stack
- Language/framework choices with brief reasoning
- Key libraries/dependencies
- Why this stack (not alternatives)

## Data Models
Define each model with fields, types, and relationships.

## API / CLI Design
List endpoints or CLI commands with input/output.

## File Structure
Show the project directory tree.

## Non-Goals (v1)
What is explicitly OUT of scope for MVP.

## Open Questions
Any decisions that need user input.

IMPORTANT:
- Keep MVP small — a solo developer should be able to build it in 1-2 days.
- Prefer CLI tools over web apps unless the idea specifically needs a UI.
- Prefer simple file-based storage over databases for MVP.
- Be specific about file paths, function signatures, and data shapes.
- Output ONLY the markdown document, no preamble or explanation."""


# --- Provider Abstraction ---

class LLMProvider(ABC):
    """Abstract base for LLM providers with web search."""

    @abstractmethod
    def research(self, domain: str) -> str:
        """Send research prompt, return raw text response."""

    @abstractmethod
    def generate_spec(self, idea_text: str) -> str:
        """Generate MVP spec from an idea description, return markdown."""

    @abstractmethod
    def research_report(self, idea_text: str) -> str:
        """Generate technical research report from an idea, return markdown."""


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

    def research(self, domain: str) -> str:
        types = self._types

        # Step 1: Research with web search (free-form)
        research_prompt = (
            f"Research the \"{domain}\" domain for startup opportunities. "
            f"Find: 1) Current trends and pain points, 2) Recent startups, "
            f"3) Market size data, 4) Technology feasibility. "
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

    def generate_spec(self, idea_text: str) -> str:
        types = self._types

        # Step 1: Research tech/competitors with web search
        research_prompt = (
            f"Research the following startup idea for technical implementation:\n\n"
            f"{idea_text}\n\n"
            f"Find: 1) Best tech stacks for this type of product, "
            f"2) Existing open-source tools in this space, "
            f"3) Key technical challenges and solutions. "
            f"Be specific with library names, versions, and URLs."
        )
        research_response = self._client.models.generate_content(
            model=self._model,
            contents=research_prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.5,
                max_output_tokens=8192,
            ),
        )
        research_text = research_response.text or ""

        # Step 2: Generate spec using research context
        spec_prompt = SPEC_PROMPT.format(idea_text=idea_text) + (
            f"\n\nAdditional research context:\n{research_text}"
        )
        spec_response = self._client.models.generate_content(
            model=self._model,
            contents=spec_prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=8192,
            ),
        )
        return spec_response.text

    def research_report(self, idea_text: str) -> str:
        types = self._types

        # Step 1: Deep web research on the idea's domain
        research_response = self._client.models.generate_content(
            model=self._model,
            contents=(
                f"Research the following startup idea thoroughly. "
                f"Find existing products, available APIs with pricing, "
                f"open-source tools, technical approaches, and key challenges.\n\n"
                f"{idea_text}"
            ),
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.3,
                max_output_tokens=8192,
            ),
        )
        research_text = research_response.text or ""

        # Step 2: Format into structured report
        report_response = self._client.models.generate_content(
            model=self._model,
            contents=(
                RESEARCH_REPORT_PROMPT.format(idea_text=idea_text)
                + f"\n\nResearch findings:\n{research_text}"
            ),
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=8192,
            ),
        )
        report_text = report_response.text or ""

        # Step 3: Generate cost-optimized prototype strategy
        cost_response = self._client.models.generate_content(
            model=self._model,
            contents=(
                f"Based on this research report:\n\n{report_text}\n\n"
                f"Design the cheapest possible prototype strategy for a solo developer.\n\n"
                f"Rules:\n"
                f"- Prefer free tiers and open-source over paid APIs\n"
                f"- Prefer local/self-hosted models (e.g. Ollama, ComfyUI) over cloud APIs\n"
                f"- Identify the minimum viable set of tools needed\n"
                f"- Suggest the ONE paid service worth paying for if free options are insufficient\n\n"
                f"Output format — use EXACTLY this markdown structure:\n\n"
                f"## Cost-Optimized Prototype Strategy\n\n"
                f"[1-2 sentence summary]\n\n"
                f"### Cost Table\n\n"
                f"| Category | Tool | Cost | Free Tier | When Free Runs Out |\n"
                f"|----------|------|------|-----------|--------------------|\n"
                f"| 3D Models | ... | $0 | 50 models/mo | $12/mo for 150 |\n"
                f"| ... | ... | ... | ... | ... |\n\n"
                f"IMPORTANT: Keep EVERY table cell under 30 characters. Use short phrases, not sentences.\n\n"
                f"### Total Monthly Cost\n\n"
                f"$X/month (itemized)\n\n"
                f"### The ONE Paid Service Worth It\n\n"
                f"[Name] — [1 sentence why]"
            ),
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.2,
                max_output_tokens=4096,
            ),
        )
        cost_text = cost_response.text or ""

        full_report = report_text + "\n\n" + cost_text

        # Validate and retry cost section if table is malformed
        result = validate_research_report(full_report)
        if not result.valid:
            table_errors = [e for e in result.errors if "Table" in e]
            if table_errors:
                print(f"    Cost table malformed, regenerating...")
                cost_response = self._client.models.generate_content(
                    model=self._model,
                    contents=(
                        f"The previous cost table had formatting errors:\n"
                        + "\n".join(table_errors) + "\n\n"
                        f"Regenerate ONLY the '## Cost-Optimized Prototype Strategy' section.\n"
                        f"Rules: Keep EVERY table cell under 30 characters. "
                        f"Keep table lines under 500 characters total.\n"
                        f"Use the same data from this report:\n\n{report_text[:3000]}"
                    ),
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=2048,
                    ),
                )
                cost_text = cost_response.text or cost_text
                full_report = report_text + "\n\n" + cost_text

            # Log remaining validation issues
            final_result = validate_research_report(full_report)
            if not final_result.valid:
                print(f"    Validation warnings:")
                for err in final_result.errors:
                    print(f"      - {err}")

        return full_report


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

    def generate_spec(self, idea_text: str) -> str:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=8192,
            tools=[{"type": "web_search_20250305"}],
            messages=[
                {"role": "user", "content": SPEC_PROMPT.format(idea_text=idea_text)}
            ],
        )
        text_content = ""
        for block in response.content:
            if block.type == "text":
                text_content += block.text
        return text_content

    def research_report(self, idea_text: str) -> str:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=8192,
            tools=[{"type": "web_search_20250305"}],
            messages=[
                {"role": "user", "content": RESEARCH_REPORT_PROMPT.format(idea_text=idea_text)}
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

    def generate_spec(self, idea_text: str) -> str:
        response = self._httpx.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self._model,
                "messages": [
                    {"role": "user", "content": SPEC_PROMPT.format(idea_text=idea_text)}
                ],
                "max_tokens": 8192,
                "temperature": 0.3,
            },
            timeout=180,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    def research_report(self, idea_text: str) -> str:
        response = self._httpx.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self._model,
                "messages": [
                    {"role": "user", "content": RESEARCH_REPORT_PROMPT.format(idea_text=idea_text)}
                ],
                "max_tokens": 8192,
                "temperature": 0.3,
            },
            timeout=180,
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
    with open(config_path) as f:
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


def research_idea(provider: LLMProvider, domain: str, idea_id: str, today_str: str) -> Idea:
    """Research a single startup idea using the configured provider."""
    text = provider.research(domain)
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
    """Run the full daily research pipeline."""
    config = load_config(config_path)
    provider = create_provider(config)

    llm_info = config.get("llm", {})
    provider_name = llm_info.get("provider", "gemini")
    model_name = llm_info.get("model", "default")
    print(f"  Provider: {provider_name} ({model_name})")

    today = date.today()
    today_str = today.isoformat()
    domains = select_domains(config, today)

    max_retries = 3
    ideas = []
    for i, domain in enumerate(domains):
        idea_id = f"{today_str}-{i+1:03d}"
        print(f"  [{i+1}/{len(domains)}] Researching: {domain}...")
        for attempt in range(max_retries):
            try:
                idea = research_idea(provider, domain, idea_id, today_str)
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
