"""Asagiri - Daily Research Runner."""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from researcher import load_config, select_domains, run_research
from output import write_outputs, update_review_queue


def main() -> None:
    parser = argparse.ArgumentParser(description="Asagiri Research Engine")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("D:/Obsidian/br-os-vault/_asagiri/config.yaml"),
        help="Path to config.yaml (default: vault _asagiri/config.yaml)",
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

    print(f"=== Asagiri ===")
    print(f"Date: {date.today().isoformat()}")
    print(f"Strategy: {config['strategy']}")
    print()

    research = run_research(args.config)

    data_dir = Path(config["output"]["data_path"])
    vault_ideas_dir = config["output"].get("vault_ideas_path")
    vault_ideas_path = Path(vault_ideas_dir) if vault_ideas_dir else None
    write_outputs(research, data_dir, vault_ideas_path)
    update_review_queue(research, data_dir)

    print()
    print(f"Done! {len(research.ideas)} ideas researched.")
    print(f"Domains covered: {', '.join(research.domains_covered)}")


if __name__ == "__main__":
    main()
