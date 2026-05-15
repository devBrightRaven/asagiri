"""Tests for engine/skill_loader.py — SKILL.md frontmatter + Jinja rendering."""
from __future__ import annotations

from pathlib import Path

import pytest

from skill_loader import Skill, load_skill


def _write_skill(tmp_path: Path, name: str, content: str) -> Path:
    skill_dir = tmp_path / name
    skill_dir.mkdir(parents=True)
    skill_path = skill_dir / "SKILL.md"
    skill_path.write_text(content, encoding="utf-8")
    return tmp_path


def test_load_skill_parses_frontmatter(tmp_path):
    root = _write_skill(tmp_path, "test", """---
name: test-skill
description: A test skill
inputs:
  - foo: string
---

Body here with {{ foo }}.
""")
    s = load_skill("test", skills_dir=root)
    assert s.name == "test-skill"
    assert s.description == "A test skill"
    assert s.frontmatter["inputs"] == [{"foo": "string"}]
    assert "{{ foo }}" in s.body


def test_render_substitutes_jinja_vars(tmp_path):
    root = _write_skill(tmp_path, "t", """---
name: t
description: x
---

Hello {{ who }}.
""")
    s = load_skill("t", skills_dir=root)
    assert s.render(who="World") == "Hello World."


def test_render_supports_conditional_blocks(tmp_path):
    root = _write_skill(tmp_path, "t", """---
name: t
description: x
---

A.
{% if extra %}
EXTRA: {{ extra }}.
{% endif %}
B.
""")
    s = load_skill("t", skills_dir=root)
    with_extra = s.render(extra="yes")
    without = s.render(extra=None)
    assert "EXTRA: yes." in with_extra
    assert "EXTRA" not in without


def test_render_raises_on_missing_var(tmp_path):
    root = _write_skill(tmp_path, "t", """---
name: t
description: x
---

{{ required_var }}
""")
    s = load_skill("t", skills_dir=root)
    from jinja2.exceptions import UndefinedError
    with pytest.raises(UndefinedError):
        s.render()  # required_var not supplied


def test_load_skill_raises_on_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_skill("nonexistent", skills_dir=tmp_path)


def test_load_skill_raises_on_missing_frontmatter(tmp_path):
    root = _write_skill(tmp_path, "t", "No frontmatter here, just a body.")
    with pytest.raises(ValueError, match="frontmatter"):
        load_skill("t", skills_dir=root)


# --- Integration with the built-in research skill ---

def test_research_skill_loads():
    s = load_skill("research")
    assert s.name == "research"
    assert "startup" in s.description.lower() or "idea" in s.description.lower()
    assert "{{ domain }}" in s.body
    assert "{{ search_context }}" in s.body
    assert "{% if purpose_lens %}" in s.body


def test_research_skill_renders_without_lens():
    s = load_skill("research")
    rendered = s.render(
        domain="AI/ML",
        search_context="* T1 - https://u1\n  S1",
        purpose_lens=None,
    )
    assert "AI/ML" in rendered
    assert "T1" in rendered
    assert "Value lens" not in rendered  # conditional block skipped


def test_research_skill_renders_with_lens():
    s = load_skill("research")
    rendered = s.render(
        domain="Health Tech",
        search_context="X",
        purpose_lens="accessible independence: live without dependency",
    )
    assert "Health Tech" in rendered
    assert "accessible independence" in rendered
    assert "Value lens" in rendered
