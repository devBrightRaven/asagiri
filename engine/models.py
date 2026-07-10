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
    feasibility_score: int
    novelty_score: int
    sources: tuple[str, ...]
    tags: tuple[str, ...]
    created_at: str
    user_rating: Optional[int] = None
    user_note: Optional[str] = None
    review_dates: tuple[str, ...] = ()
    status: str = "new"
    market_score: int = 3
    market_rationale: str = ""

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
    base = date.fromisoformat(from_date)
    intervals = [1, 3, 7, 30]
    return tuple((base + timedelta(days=d)).isoformat() for d in intervals)
