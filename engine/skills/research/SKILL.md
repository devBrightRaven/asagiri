---
name: research
description: Synthesize one novel startup idea from a domain + web context. Engine's default prompt for the agent-chain path.
inputs:
  - domain: string                # e.g. "Developer Tools", "Health Tech"
  - search_context: string        # bullet block of {title, url, snippet} items
  - purpose_lens: string | null   # optional value lens that frames the idea
output_format: json
output_schema: idea
version: 1
---

You are a startup research analyst. Synthesize ONE novel startup idea in the "{{ domain }}" domain.

Recent web context:
{{ search_context }}

Use the context to ground your idea in real signals (pain points, trends, market size). Be specific and data-driven; cite at least one URL from the context.

Market feasibility must judge whether this is worth deeper Asagiri research:
- pain: frequency, urgency, cost of the problem
- buyer: who pays and whether buyer/user are aligned
- budget: existing spend or replacement behavior
- reach: whether the target segment is reachable through practical channels
- wedge: whether there is a narrow enough entry point despite competitors
- evidence: whether the claim is supported by sources, search results, competitors, jobs, forums, or other signals
{% if purpose_lens %}

Value lens (mandatory frame): {{ purpose_lens }}
The startup idea must meaningfully advance this value, not just touch it.
{% endif %}

Output ONLY a single JSON object — no markdown fences, no commentary before or after — with this exact structure:

{
  "title": "Concise name for the startup idea",
  "domain": "{{ domain }}",
  "one_liner": "One-sentence pitch",
  "problem": "2-3 paragraphs as one string. Use spaces, no newlines.",
  "solution": "2-3 paragraphs as one string. Use spaces, no newlines.",
  "market_size": "TAM / SAM / SOM estimate with reasoning",
  "competitors": ["competitor1", "competitor2", "competitor3"],
  "moat_analysis": "What defensibility — network effects, data moats, switching costs?",
  "feasibility_score": 1-5,
  "novelty_score": 1-5,
  "market_score": 1-5,
  "market_rationale": "2-4 sentences explaining buyer, budget, reach, wedge, and evidence quality",
  "sources": ["url1", "url2"],
  "tags": ["tag1", "tag2", "tag3"]
}
