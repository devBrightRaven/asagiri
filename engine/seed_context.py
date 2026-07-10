"""Read distilled upstream seeds for agent research prompts."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_seed_records(path: str | None) -> list[dict[str, Any]]:
    if not path:
        return []
    p = Path(path).expanduser()
    if not p.exists():
        return []
    records: list[dict[str, Any]] = []
    with p.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def format_seed_context(
    records: list[dict[str, Any]],
    domain: str,
    max_items: int = 3,
) -> str:
    if max_items <= 0:
        return ""
    domain_l = domain.lower()
    matches = []
    for r in records:
        domains = r.get("asagiri_domains") or []
        if isinstance(domains, str):
            domains = [domains]
        hay = " ".join(str(r.get(k, "")) for k in ("title", "teaser")).lower()
        if domain in domains or domain_l in hay:
            matches.append(r)
        if len(matches) >= max_items:
            break
    if not matches:
        return ""

    lines = [
        "Relevant Ideabrowser seeds (upstream signals; re-research and mutate, do not copy):"
    ]
    for r in matches:
        title = str(r.get("title") or "Untitled").strip()
        url = str(r.get("url") or "").strip()
        kind = str(r.get("seed_type") or "seed").strip()
        teaser = " ".join(str(r.get("teaser") or "").split())
        if len(teaser) > 220:
            teaser = teaser[:220] + "..."
        lines.append(f"- [{kind}] {title} ({url})")
        if teaser:
            lines.append(f"  {teaser}")
    return "\n".join(lines)
