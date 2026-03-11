---
tags: [plan, opportunity-radar, implementation]
status: spec
source: claude-code
---

# Opportunity Radar V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cognitive training system that auto-researches 10 startup ideas nightly, presents them via a gamified Next.js dashboard with morning ritual flow, spaced repetition, Kanban, and territory map.

**Architecture:** Two independent components sharing a JSON data layer. Python research engine runs nightly via Windows Task Scheduler, writes structured JSON + Markdown to `_startup_radar/data/`. Next.js webapp reads from the same directory, serves a local dashboard at `localhost:3000`. User interactions (ratings, notes, Kanban status) are persisted to `interactions.json`.

**Tech Stack:** Python 3.12 + anthropic + httpx | Next.js 14 + shadcn/ui + Tailwind + framer-motion + recharts + @dnd-kit + D3.js

---

## Track A: Research Engine (Python)

### Task 1: Project Setup + Config

**Files:**
- Create: `_startup_radar/engine/requirements.txt`
- Create: `_startup_radar/engine/config.yaml`
- Create: `_startup_radar/engine/models.py`

**Step 1: Create requirements.txt**

```txt
anthropic>=0.44.0
httpx>=0.27.0
pyyaml>=6.0
jinja2>=3.1
python-dotenv>=1.0
```

**Step 2: Create config.yaml**

```yaml
strategy: mixed  # mixed | focused | themed
ideas_per_day: 10
min_domains_per_day: 5
depth: deep  # light | medium | deep

domains:
  - AI/ML
  - Developer Tools
  - Gaming
  - FinTech
  - Health Tech
  - Education
  - Creator Economy
  - Hardware/IoT
  - Sustainability
  - B2B SaaS
  - Consumer Apps
  - Marketplace
  - Logistics
  - Legal Tech
  - Real Estate Tech

theme_schedule:
  monday: AI/ML
  tuesday: Developer Tools
  wednesday: Gaming
  thursday: FinTech
  friday: Health Tech
  saturday: Creator Economy
  sunday: mixed

output:
  vault_path: "D:/Obsidian/br-os-vault/_startup_radar/data"
  generate_markdown: true
  generate_json: true

search:
  max_sources_per_idea: 3
  language: "en"
```

**Step 3: Create models.py with data classes**

```python
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime, date, timedelta
from typing import Optional
import json


@dataclass(frozen=True)
class Idea:
    id: str
    title: str
    domain: str
    one_liner: str
    problem: str
    solution: str
    market_size: str
    competitors: tuple[str, ...]
    moat_analysis: str
    feasibility_score: int  # 1-5
    novelty_score: int  # 1-5
    sources: tuple[str, ...]
    tags: tuple[str, ...]
    created_at: str
    user_rating: Optional[int] = None
    user_note: Optional[str] = None
    review_dates: tuple[str, ...] = ()
    status: str = "new"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["competitors"] = list(d["competitors"])
        d["sources"] = list(d["sources"])
        d["tags"] = list(d["tags"])
        d["review_dates"] = list(d["review_dates"])
        return d


@dataclass(frozen=True)
class DailyResearch:
    date: str
    ideas: tuple[Idea, ...]
    domains_covered: tuple[str, ...]
    strategy_used: str

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "ideas": [idea.to_dict() for idea in self.ideas],
            "domains_covered": list(self.domains_covered),
            "strategy_used": self.strategy_used,
        }


def compute_review_dates(from_date: str) -> tuple[str, ...]:
    """Spaced repetition: 1, 3, 7, 30 days after."""
    base = date.fromisoformat(from_date)
    intervals = [1, 3, 7, 30]
    return tuple((base + timedelta(days=d)).isoformat() for d in intervals)
```

**Step 4: Install dependencies**

Run: `cd D:/Obsidian/br-os-vault/_startup_radar/engine && pip install -r requirements.txt`

**Step 5: Commit**

```bash
git add _startup_radar/engine/requirements.txt _startup_radar/engine/config.yaml _startup_radar/engine/models.py
git commit -m "feat(radar): add research engine config and data models"
```

---

### Task 2: Research Engine Core

**Files:**
- Create: `_startup_radar/engine/.env.example`
- Create: `_startup_radar/engine/researcher.py`

**Step 1: Create .env.example**

```
ANTHROPIC_API_KEY=sk-ant-...
```

**Step 2: Create researcher.py**

This is the core engine. It:
1. Loads config.yaml
2. Selects today's domains based on strategy
3. For each idea slot: web search -> Claude analysis -> structured output
4. Returns list of Idea objects

```python
"""Opportunity Radar Research Engine.

Uses Claude API with web search to research startup ideas.
"""
from __future__ import annotations

import json
import random
import os
from datetime import datetime, date
from pathlib import Path

import anthropic
import yaml
from dotenv import load_dotenv

from models import Idea, DailyResearch, compute_review_dates

load_dotenv()

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


def load_config(config_path: Path) -> dict:
    with open(config_path) as f:
        return yaml.safe_load(f)


def select_domains(config: dict, today: date) -> list[str]:
    """Select domains for today based on strategy."""
    strategy = config["strategy"]
    all_domains = config["domains"]
    n = config["ideas_per_day"]
    min_domains = config["min_domains_per_day"]

    if strategy == "themed":
        day_name = today.strftime("%A").lower()
        theme = config["theme_schedule"].get(day_name, "mixed")
        if theme != "mixed":
            # Half themed, half random for interleaving
            themed_count = n // 2
            random_count = n - themed_count
            other_domains = [d for d in all_domains if d != theme]
            random_domains = random.sample(
                other_domains, min(random_count, len(other_domains))
            )
            return [theme] * themed_count + random_domains

    # mixed or focused: ensure min_domains coverage
    selected = []
    pool = list(all_domains)
    random.shuffle(pool)

    # First ensure minimum domain coverage
    base_domains = pool[:min_domains]
    for d in base_domains:
        selected.append(d)

    # Fill remaining slots randomly
    while len(selected) < n:
        selected.append(random.choice(all_domains))

    random.shuffle(selected)  # interleave
    return selected[:n]


def research_idea(client: anthropic.Anthropic, domain: str, idea_id: str, today_str: str) -> Idea:
    """Research a single startup idea using Claude with web search."""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        tools=[{"type": "web_search_20250305"}],
        messages=[
            {
                "role": "user",
                "content": RESEARCH_PROMPT.format(domain=domain),
            }
        ],
    )

    # Extract text from response
    text_content = ""
    for block in response.content:
        if block.type == "text":
            text_content += block.text

    # Parse JSON from response
    # Handle potential markdown wrapping
    json_str = text_content.strip()
    if json_str.startswith("```"):
        json_str = json_str.split("\n", 1)[1]
        json_str = json_str.rsplit("```", 1)[0]

    data = json.loads(json_str)

    review_dates = compute_review_dates(today_str)

    return Idea(
        id=idea_id,
        title=data["title"],
        domain=data["domain"],
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
    client = anthropic.Anthropic()

    today = date.today()
    today_str = today.isoformat()
    domains = select_domains(config, today)

    ideas = []
    for i, domain in enumerate(domains):
        idea_id = f"{today_str}-{i+1:03d}"
        print(f"  [{i+1}/{len(domains)}] Researching: {domain}...")
        try:
            idea = research_idea(client, domain, idea_id, today_str)
            ideas.append(idea)
            print(f"    -> {idea.title}")
        except Exception as e:
            print(f"    ERROR: {e}")
            continue

    unique_domains = tuple(sorted(set(domains)))

    return DailyResearch(
        date=today_str,
        ideas=tuple(ideas),
        domains_covered=unique_domains,
        strategy_used=config["strategy"],
    )
```

**Step 3: Commit**

```bash
git add _startup_radar/engine/researcher.py _startup_radar/engine/.env.example
git commit -m "feat(radar): add core research engine with Claude web search"
```

---

### Task 3: Output Generator (JSON + Markdown)

**Files:**
- Create: `_startup_radar/engine/output.py`
- Create: `_startup_radar/engine/templates/idea.md.j2`

**Step 1: Create Jinja2 template for Obsidian markdown**

```jinja2
---
tags: [startup-idea, {{ idea.domain | lower | replace("/", "-") | replace(" ", "-") }}{% for tag in idea.tags %}, {{ tag }}{% endfor %}]
status: reference
source: agent
domain: "{{ idea.domain }}"
feasibility: {{ idea.feasibility_score }}
novelty: {{ idea.novelty_score }}
---

# {{ idea.title }}

> {{ idea.one_liner }}

## Problem

{{ idea.problem }}

## Solution

{{ idea.solution }}

## Market Size

{{ idea.market_size }}

## Competitors

{% for c in idea.competitors %}- {{ c }}
{% endfor %}

## Moat Analysis

{{ idea.moat_analysis }}

## Scores

| Metric | Score |
|--------|-------|
| Feasibility | {{ idea.feasibility_score }}/5 |
| Novelty | {{ idea.novelty_score }}/5 |

## Sources

{% for s in idea.sources %}- {{ s }}
{% endfor %}
```

**Step 2: Create output.py**

```python
"""Output generator: writes research results to JSON + Markdown."""
from __future__ import annotations

import json
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from models import DailyResearch


TEMPLATE_DIR = Path(__file__).parent / "templates"


def slugify(text: str) -> str:
    return (
        text.lower()
        .replace(" ", "-")
        .replace("/", "-")
        .replace("&", "and")
        .replace(":", "")
        .replace(",", "")
    )[:60]


def write_outputs(research: DailyResearch, output_dir: Path) -> None:
    """Write daily research to JSON and Markdown files."""
    day_dir = output_dir / research.date
    day_dir.mkdir(parents=True, exist_ok=True)

    # Write JSON
    json_path = day_dir / "ideas.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(research.to_dict(), f, ensure_ascii=False, indent=2)

    # Write individual Markdown files
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template("idea.md.j2")

    for idea in research.ideas:
        slug = slugify(idea.title)
        md_path = day_dir / f"{idea.id}-{slug}.md"
        content = template.render(idea=idea)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(content)

    print(f"Wrote {len(research.ideas)} ideas to {day_dir}")


def update_review_queue(research: DailyResearch, data_dir: Path) -> None:
    """Update the spaced repetition review queue."""
    queue_path = data_dir / "review-queue.json"

    if queue_path.exists():
        with open(queue_path, encoding="utf-8") as f:
            queue = json.load(f)
    else:
        queue = {}

    for idea in research.ideas:
        for review_date in idea.review_dates:
            if review_date not in queue:
                queue[review_date] = []
            queue[review_date].append(
                {"id": idea.id, "title": idea.title, "domain": idea.domain}
            )

    with open(queue_path, "w", encoding="utf-8") as f:
        json.dump(queue, f, ensure_ascii=False, indent=2)
```

**Step 3: Commit**

```bash
git add _startup_radar/engine/output.py _startup_radar/engine/templates/
git commit -m "feat(radar): add JSON + Markdown output generator with review queue"
```

---

### Task 4: Main Entry Point + CLI

**Files:**
- Create: `_startup_radar/engine/main.py`

**Step 1: Create main.py**

```python
"""Opportunity Radar - Daily Research Runner.

Usage:
    python main.py                  # Run with default config
    python main.py --config path    # Run with custom config
    python main.py --dry-run        # Preview domains without researching
"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from researcher import load_config, select_domains, run_research
from output import write_outputs, update_review_queue


def main() -> None:
    parser = argparse.ArgumentParser(description="Opportunity Radar Research Engine")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).parent / "config.yaml",
        help="Path to config.yaml",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview domain selection without running research",
    )
    args = parser.parse_args()

    if not args.config.exists():
        print(f"Config not found: {args.config}")
        sys.exit(1)

    config = load_config(args.config)

    if args.dry_run:
        today = date.today()
        domains = select_domains(config, today)
        print(f"Date: {today.isoformat()}")
        print(f"Strategy: {config['strategy']}")
        print(f"Domains ({len(domains)}):")
        for i, d in enumerate(domains, 1):
            print(f"  {i}. {d}")
        return

    print(f"=== Opportunity Radar ===")
    print(f"Date: {date.today().isoformat()}")
    print(f"Strategy: {config['strategy']}")
    print()

    research = run_research(args.config)

    output_dir = Path(config["output"]["vault_path"])
    write_outputs(research, output_dir)
    update_review_queue(research, output_dir)

    print()
    print(f"Done! {len(research.ideas)} ideas researched.")
    print(f"Domains covered: {', '.join(research.domains_covered)}")


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
git add _startup_radar/engine/main.py
git commit -m "feat(radar): add CLI entry point with dry-run support"
```

---

### Task 5: Generate Seed Data (First Run)

**Step 1: Create .env with API key**

Run: `cp _startup_radar/engine/.env.example _startup_radar/engine/.env`
Then manually add ANTHROPIC_API_KEY.

**Step 2: Dry run to verify domain selection**

Run: `cd D:/Obsidian/br-os-vault/_startup_radar/engine && python main.py --dry-run`

**Step 3: Run first research (generates today's data)**

Run: `cd D:/Obsidian/br-os-vault/_startup_radar/engine && python main.py`

Expected: Creates `_startup_radar/data/2026-03-07/ideas.json` + 10 markdown files.

---

## Track B: Webapp Dashboard (Next.js)

### Task 6: Next.js Project Setup

**Step 1: Create Next.js project**

Run:
```bash
cd D:/Obsidian/br-os-vault/_startup_radar
pnpm create next-app@latest webapp --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

**Step 2: Install shadcn/ui**

Run:
```bash
cd D:/Obsidian/br-os-vault/_startup_radar/webapp
pnpm dlx shadcn@latest init -d
```

**Step 3: Install additional dependencies**

Run:
```bash
cd D:/Obsidian/br-os-vault/_startup_radar/webapp
pnpm add framer-motion recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities d3 @types/d3 date-fns lucide-react
```

**Step 4: Install shadcn components**

Run:
```bash
cd D:/Obsidian/br-os-vault/_startup_radar/webapp
pnpm dlx shadcn@latest add card button badge dialog input textarea tabs progress tooltip separator scroll-area
```

**Step 5: Commit**

```bash
git add _startup_radar/webapp/
git commit -m "feat(radar): scaffold Next.js webapp with shadcn/ui"
```

---

### Task 7: Data Layer

**Files:**
- Create: `webapp/src/lib/types.ts`
- Create: `webapp/src/lib/data.ts`

**Step 1: Create TypeScript types matching Python models**

```typescript
// types.ts
export interface Idea {
  id: string;
  title: string;
  domain: string;
  one_liner: string;
  problem: string;
  solution: string;
  market_size: string;
  competitors: string[];
  moat_analysis: string;
  feasibility_score: number;
  novelty_score: number;
  sources: string[];
  tags: string[];
  created_at: string;
  user_rating: number | null;
  user_note: string | null;
  review_dates: string[];
  status: "new" | "interested" | "researching" | "passed" | "executing";
}

export interface DailyResearch {
  date: string;
  ideas: Idea[];
  domains_covered: string[];
  strategy_used: string;
}

export interface Interactions {
  ratings: Record<string, number>;          // idea_id -> rating
  notes: Record<string, string>;            // idea_id -> note
  statuses: Record<string, Idea["status"]>; // idea_id -> kanban status
  connections: ConnectionEntry[];           // user-submitted connections
  ritual_completions: string[];             // dates completed
}

export interface ConnectionEntry {
  date: string;
  idea_a: string;
  idea_b: string;
  connection: string;
}

export interface ReviewItem {
  id: string;
  title: string;
  domain: string;
}

export interface Stats {
  current_streak: number;
  longest_streak: number;
  total_ideas: number;
  total_domains: number;
  domain_counts: Record<string, number>;
}
```

**Step 2: Create data access layer (server-side file reads)**

```typescript
// data.ts
import { promises as fs } from "fs";
import path from "path";
import type { DailyResearch, Interactions, ReviewItem, Stats } from "./types";

const DATA_DIR = process.env.RADAR_DATA_DIR
  || path.resolve("D:/Obsidian/br-os-vault/_startup_radar/data");

export async function getAllDates(): Promise<string[]> {
  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function getDailyResearch(date: string): Promise<DailyResearch | null> {
  const filePath = path.join(DATA_DIR, date, "ideas.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getInteractions(): Promise<Interactions> {
  const filePath = path.join(DATA_DIR, "interactions.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      ratings: {},
      notes: {},
      statuses: {},
      connections: [],
      ritual_completions: [],
    };
  }
}

export async function saveInteractions(data: Interactions): Promise<void> {
  const filePath = path.join(DATA_DIR, "interactions.json");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function getReviewQueue(date: string): Promise<ReviewItem[]> {
  const filePath = path.join(DATA_DIR, "review-queue.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const queue = JSON.parse(raw);
    return queue[date] || [];
  } catch {
    return [];
  }
}

export async function computeStats(interactions: Interactions): Promise<Stats> {
  const dates = await getAllDates();
  let domainCounts: Record<string, number> = {};
  let totalIdeas = 0;

  for (const d of dates) {
    const research = await getDailyResearch(d);
    if (!research) continue;
    totalIdeas += research.ideas.length;
    for (const idea of research.ideas) {
      const domain = idea.domain.split(" ")[0]; // normalize
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  }

  // Compute streak
  const completions = new Set(interactions.ritual_completions);
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    if (completions.has(ds)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const longestStreak = Math.max(streak, interactions.ritual_completions.length > 0 ? 1 : 0);

  return {
    current_streak: streak,
    longest_streak: longestStreak,
    total_ideas: totalIdeas,
    total_domains: Object.keys(domainCounts).length,
    domain_counts: domainCounts,
  };
}
```

**Step 3: Create API routes for interactions (write operations)**

Create: `webapp/src/app/api/interactions/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getInteractions, saveInteractions } from "@/lib/data";

export async function GET() {
  const data = await getInteractions();
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  await saveInteractions(body);
  return NextResponse.json({ ok: true });
}
```

**Step 4: Commit**

```bash
git add webapp/src/lib/ webapp/src/app/api/
git commit -m "feat(radar): add data layer and API routes"
```

---

### Task 8: Morning Ritual Flow Page

**Files:**
- Create: `webapp/src/app/page.tsx` (replace default)
- Create: `webapp/src/components/ritual/RitualFlow.tsx`
- Create: `webapp/src/components/ritual/ReviewStep.tsx`
- Create: `webapp/src/components/ritual/ExploreStep.tsx`
- Create: `webapp/src/components/ritual/ConnectStep.tsx`
- Create: `webapp/src/components/ritual/CompleteStep.tsx`
- Create: `webapp/src/components/IdeaCard.tsx`
- Create: `webapp/src/components/StreakCounter.tsx`

This is the largest task. The ritual flow is a multi-step wizard:

1. **ReviewStep** - Shows ideas from review queue (spaced repetition)
2. **ExploreStep** - Shows today's 10 new ideas as cards, allows starring
3. **ConnectStep** - Prompts user to find a connection between 2 starred ideas
4. **CompleteStep** - Shows streak, marks ritual done

Each component is a self-contained step. The parent `RitualFlow` manages which step is active.

Implementation: Full React components with shadcn/ui cards, framer-motion page transitions, and the streak counter as a persistent header element.

**Note:** This task is large. Implement each component file one at a time. The exact code will be written during execution as it depends on shadcn's actual component API after init.

**Step 1-4:** Create each component file with full implementation.
**Step 5:** Replace `page.tsx` with the ritual flow as the landing page.
**Step 6:** Test locally with `pnpm dev`.
**Step 7:** Commit.

```bash
git add webapp/src/
git commit -m "feat(radar): add morning ritual flow with review, explore, connect steps"
```

---

### Task 9: Dashboard Overview Page

**Files:**
- Create: `webapp/src/app/dashboard/page.tsx`
- Create: `webapp/src/components/dashboard/StatsCards.tsx`
- Create: `webapp/src/components/dashboard/IdeaTable.tsx`
- Create: `webapp/src/components/dashboard/DomainChart.tsx`

Dashboard shows:
- Stats cards (total ideas, streak, domains covered)
- Filterable/sortable table of all ideas
- Domain distribution bar chart (recharts)
- Date range picker

**Step 1-3:** Create each component.
**Step 4:** Wire up the page with server component data loading.
**Step 5:** Commit.

```bash
git commit -m "feat(radar): add dashboard overview with stats, table, and charts"
```

---

### Task 10: Kanban Board Page

**Files:**
- Create: `webapp/src/app/kanban/page.tsx`
- Create: `webapp/src/components/kanban/KanbanBoard.tsx`
- Create: `webapp/src/components/kanban/KanbanColumn.tsx`
- Create: `webapp/src/components/kanban/KanbanCard.tsx`

Columns: New | Interested | Researching | Passed | Executing

Uses @dnd-kit for drag-and-drop. Persists status changes to interactions.json via API route.

**Step 1-3:** Create components with dnd-kit integration.
**Step 4:** Commit.

```bash
git commit -m "feat(radar): add Kanban board with drag-and-drop"
```

---

### Task 11: Territory Map Page

**Files:**
- Create: `webapp/src/app/territory/page.tsx`
- Create: `webapp/src/components/territory/TerritoryMap.tsx`

A treemap or bubble chart visualization using D3.js showing:
- Each domain as a colored region
- Size = number of ideas researched in that domain
- Color intensity = depth of engagement (ratings, notes)
- Empty/light areas = unexplored domains

**Step 1-2:** Create D3 treemap component.
**Step 3:** Commit.

```bash
git commit -m "feat(radar): add territory map visualization"
```

---

### Task 12: Navigation + Layout

**Files:**
- Modify: `webapp/src/app/layout.tsx`
- Create: `webapp/src/components/Navbar.tsx`

Top navigation bar with:
- Logo / "Opportunity Radar"
- Streak counter (always visible)
- Links: Ritual | Dashboard | Kanban | Territory

**Step 1-2:** Create navbar, update layout.
**Step 3:** Commit.

```bash
git commit -m "feat(radar): add navigation and layout"
```

---

## Track C: Integration

### Task 13: Windows Task Scheduler Setup

**Files:**
- Create: `_startup_radar/engine/run-nightly.bat`
- Create: `_startup_radar/docs/scheduler-setup.md`

**Step 1: Create batch file**

```bat
@echo off
cd /d D:\Obsidian\br-os-vault\_startup_radar\engine
python main.py >> research.log 2>&1
```

**Step 2: Create setup instructions**

Document how to create a Windows Task Scheduler task:
- Trigger: Daily at 23:00
- Action: Run `run-nightly.bat`
- Conditions: Start only if network available

**Step 3: Commit**

```bash
git add _startup_radar/engine/run-nightly.bat _startup_radar/docs/scheduler-setup.md
git commit -m "feat(radar): add Windows Task Scheduler setup"
```

---

### Task 14: End-to-End Verification

**Step 1:** Run research engine manually to generate seed data.
**Step 2:** Start webapp: `cd webapp && pnpm dev`
**Step 3:** Verify:
- [ ] Morning ritual flow loads with today's ideas
- [ ] Can star ideas
- [ ] Can submit connection note
- [ ] Streak increments
- [ ] Dashboard shows stats
- [ ] Kanban drag-and-drop works
- [ ] Territory map renders

**Step 4: Final commit**

```bash
git commit -m "feat(radar): Opportunity Radar V1 complete"
```

---

## Execution Order (Optimized for 1 Day)

Tracks A and B can run in parallel after Task 1.

```
Task 1  (config + models)         ~15 min
Task 2  (research engine)         ~30 min   |  Task 6  (Next.js setup)     ~15 min
Task 3  (output generator)        ~20 min   |  Task 7  (data layer)        ~30 min
Task 4  (CLI entry)               ~10 min   |  Task 8  (ritual flow)       ~90 min
Task 5  (seed data)               ~20 min   |  Task 9  (dashboard)         ~60 min
                                            |  Task 10 (kanban)            ~45 min
                                            |  Task 11 (territory map)     ~45 min
                                            |  Task 12 (nav + layout)      ~20 min
Task 13 (scheduler)               ~10 min
Task 14 (E2E verification)        ~20 min
                                  ─────────────────────────────────
                                  Total estimate: ~6-7 hours
```
