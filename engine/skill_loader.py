"""Load and render Asagiri skills (SKILL.md prompt templates).

Each skill is a directory under `skills/` containing a single `SKILL.md` file
with YAML frontmatter followed by a Jinja-templated body. `load_skill("name")`
returns a `Skill` whose `.render(**vars)` produces the final prompt string.

This is intentionally simple — no dependency on Claude Code's skill machinery
— but uses the same YAML-frontmatter shape so a skill written here can be
moved into a Claude Code plugin later.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from jinja2 import Environment, StrictUndefined


SKILLS_DIR = Path(__file__).parent / "skills"

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n(.*)$", re.DOTALL)


@dataclass(frozen=True)
class Skill:
    name: str
    description: str
    frontmatter: dict[str, Any]
    body: str
    path: Path

    def render(self, **vars: Any) -> str:
        env = Environment(undefined=StrictUndefined, autoescape=False, trim_blocks=False, lstrip_blocks=False)
        template = env.from_string(self.body)
        return template.render(**vars)


def load_skill(name: str, skills_dir: Path | None = None) -> Skill:
    """Load `skills/<name>/SKILL.md` into a Skill object."""
    root = skills_dir or SKILLS_DIR
    skill_path = root / name / "SKILL.md"
    if not skill_path.exists():
        raise FileNotFoundError(f"Skill not found: {skill_path}")

    raw = skill_path.read_text(encoding="utf-8")
    match = _FRONTMATTER_RE.match(raw)
    if not match:
        raise ValueError(f"Skill missing YAML frontmatter: {skill_path}")

    frontmatter_raw, body = match.group(1), match.group(2)
    frontmatter = yaml.safe_load(frontmatter_raw) or {}

    return Skill(
        name=frontmatter.get("name", name),
        description=frontmatter.get("description", ""),
        frontmatter=frontmatter,
        body=body.lstrip("\n"),
        path=skill_path,
    )
