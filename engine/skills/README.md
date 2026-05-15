# Asagiri Skills

Prompt templates loaded by the engine at runtime. Editing a SKILL.md changes
the prompt without touching code.

## Schema

Each skill lives in its own directory under `skills/`:

```
skills/<name>/SKILL.md
```

`SKILL.md` is a YAML-frontmatter + Jinja-body file:

```markdown
---
name: <skill name>
description: <one-line summary, used in catalogs>
inputs:                  # documented inputs (advisory; engine renders any var)
  - var_name: type
output_format: json|text
output_schema: <name>    # references a schema known to the engine
version: <int>
---

Prompt body. Jinja template syntax:
- `{{ variable }}` for substitution
- `{% if foo %}...{% endif %}` for conditionals
- `{% for x in xs %}...{% endfor %}` for iteration
```

## Current skills

- `research/SKILL.md` — synthesize one startup idea from domain + web context.
  Inputs: `domain`, `search_context`, `purpose_lens`. Output: `idea` JSON.

## Adding a skill

1. Create `skills/<your-skill>/SKILL.md`.
2. Document its inputs in frontmatter.
3. Reference it from engine code via `skill_loader.load_skill("<your-skill>")`.

## Why this lives in engine/

These skills are Python-engine-internal prompts, not Claude Code agent skills.
The schema is intentionally Claude-Code-compatible so future migration to a
shared skill catalogue is trivial.
