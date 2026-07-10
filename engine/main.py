"""Asagiri - Daily Research Runner.

Two execution paths exist:

* **agent chain** (new, thin-orchestrator): when `agents:` section is present
  in the config or `--use-agents` is passed. Dispatches research prompts
  through detected CLI agents (claude / codex / gemini / ollama) and pulls
  web context from a local SearXNG instance.
* **legacy SDK** (Gemini / Claude / Perplexity): when `llm:` is present and
  `agents:` is not. Kept for backward compatibility until the chain path
  has been stable in production.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from agent_research import run_agent_research, _select_domains as agent_select_domains
from output import write_outputs, update_review_queue
from researcher import load_config, run_research, select_domains


def _resolve_data_dir(config: dict) -> Path:
    """Read the JSON-output directory, tolerating legacy `vault_path` key."""
    out = config.get("output", {})
    raw = out.get("data_path") or out.get("vault_path")
    if not raw:
        raise KeyError("config.output requires `data_path` (or legacy `vault_path`)")
    return Path(raw)


def _should_use_agent_chain(config: dict, forced: bool) -> bool:
    if forced:
        return True
    return "agents" in config


def main() -> None:
    parser = argparse.ArgumentParser(description="Asagiri Research Engine")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).parent.parent / "config.yaml",
        help="Path to config.yaml",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview domain selection without running research",
    )
    parser.add_argument(
        "--use-agents",
        action="store_true",
        help="Force agent-chain path even when config lacks an `agents:` section",
    )
    args = parser.parse_args()

    if not args.config.exists():
        print(f"Config not found: {args.config}")
        sys.exit(1)

    config = load_config(args.config)
    use_agents = _should_use_agent_chain(config, args.use_agents)

    if args.dry_run:
        today = date.today()
        select_fn = agent_select_domains if use_agents else select_domains
        domains = select_fn(config, today)
        print(f"Date: {today.isoformat()}")
        print(f"Strategy: {config['strategy']}")
        print(f"Path: {'agent chain' if use_agents else 'legacy SDK'}")
        print(f"Domains ({len(domains)}):")
        for i, d in enumerate(domains, 1):
            print(f"  {i}. {d}")
        return

    print(f"=== Asagiri ===")
    print(f"Date: {date.today().isoformat()}")
    print(f"Strategy: {config['strategy']}")
    print(f"Path: {'agent chain' if use_agents else 'legacy SDK'}")
    print()

    if use_agents:
        research = run_agent_research(args.config)
    else:
        research = run_research(args.config)

    data_dir = _resolve_data_dir(config)
    vault_ideas_dir = config["output"].get("vault_ideas_path")
    vault_ideas_path = Path(vault_ideas_dir) if vault_ideas_dir else None
    write_outputs(research, data_dir, vault_ideas_path)
    update_review_queue(research, data_dir)

    print()
    print(f"Done! {len(research.ideas)} ideas researched.")
    print(f"Domains covered: {', '.join(research.domains_covered)}")


if __name__ == "__main__":
    main()
