"""Asagiri - Daily Research Runner."""
from __future__ import annotations

import argparse
import io
import sys
from datetime import date
from pathlib import Path

# Fix Windows console encoding for unicode output
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from researcher import (
    load_config, select_domains, run_research, create_provider,
    validate_research_report,
)
from output import write_outputs, update_review_queue


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
        "--spec",
        type=Path,
        help="Generate MVP spec from an idea .md file",
    )
    parser.add_argument(
        "--research",
        type=Path,
        help="Generate technical research report from an idea .md file",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output directory for spec/research generation",
    )
    args = parser.parse_args()

    if not args.config.exists():
        print(f"Config not found: {args.config}")
        sys.exit(1)

    config = load_config(args.config)

    if args.research:
        if not args.research.exists():
            print(f"Idea file not found: {args.research}")
            sys.exit(1)
        output_dir = args.output or Path.cwd()
        output_dir.mkdir(parents=True, exist_ok=True)

        idea_text = args.research.read_text(encoding="utf-8")
        provider = create_provider(config)
        llm_info = config.get("llm", {})
        print(f"=== Asagiri Research Report ===")
        print(f"Idea: {args.research.name}")
        print(f"Provider: {llm_info.get('provider', 'gemini')} ({llm_info.get('model', 'default')})")
        print(f"Output: {output_dir}")
        print()
        print("Researching...")
        report_md = provider.research_report(idea_text)
        report_path = output_dir / "research.md"
        report_path.write_text(report_md, encoding="utf-8")
        # Validate
        result = validate_research_report(report_md)
        if result.valid:
            print(f"Report written to {report_path} [VALID]")
        else:
            print(f"Report written to {report_path} [WARNINGS]")
            for err in result.errors:
                print(f"  - {err}")
        print()
        print("=" * 60)
        print(report_md)
        print("=" * 60)
        return

    if args.spec:
        if not args.spec.exists():
            print(f"Idea file not found: {args.spec}")
            sys.exit(1)
        output_dir = args.output or Path.cwd()
        output_dir.mkdir(parents=True, exist_ok=True)

        idea_text = args.spec.read_text(encoding="utf-8")
        provider = create_provider(config)
        llm_info = config.get("llm", {})
        print(f"=== Asagiri Spec Generator ===")
        print(f"Idea: {args.spec.name}")
        print(f"Provider: {llm_info.get('provider', 'gemini')} ({llm_info.get('model', 'default')})")
        print(f"Output: {output_dir}")
        print()
        print("Generating MVP spec...")
        spec_md = provider.generate_spec(idea_text)
        spec_path = output_dir / "spec.md"
        spec_path.write_text(spec_md, encoding="utf-8")
        print(f"Spec written to {spec_path}")
        print()
        print("=" * 60)
        print(spec_md)
        print("=" * 60)
        return

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

    output_dir = Path(config["output"]["vault_path"])
    write_outputs(research, output_dir)
    update_review_queue(research, output_dir)

    print()
    print(f"Done! {len(research.ideas)} ideas researched.")
    print(f"Domains covered: {', '.join(research.domains_covered)}")


if __name__ == "__main__":
    main()
