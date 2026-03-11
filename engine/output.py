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


def write_outputs(research: DailyResearch, data_dir: Path, vault_ideas_dir: Path | None = None) -> None:
    """Write JSON to data_dir, Markdown to vault_ideas_dir (or data_dir if not set)."""
    day_dir = data_dir / research.date
    day_dir.mkdir(parents=True, exist_ok=True)

    json_path = day_dir / "ideas.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(research.to_dict(), f, ensure_ascii=False, indent=2)

    md_dir = vault_ideas_dir or day_dir
    md_dir.mkdir(parents=True, exist_ok=True)

    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template("idea.md.j2")

    for idea in research.ideas:
        slug = slugify(idea.title)
        md_path = md_dir / f"{idea.id}-{slug}.md"
        content = template.render(idea=idea)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(content)

    print(f"Wrote {len(research.ideas)} ideas (JSON: {day_dir}, MD: {md_dir})")


def update_review_queue(research: DailyResearch, data_dir: Path) -> None:
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
