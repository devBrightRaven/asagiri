"use client";

import type { Connection, Fragment } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConnectionListProps {
  connections: Connection[];
  fragments: Fragment[];
  compact?: boolean;
}

function getFragmentLabel(fragment: Fragment | undefined): string {
  if (!fragment) return "（未知）";

  if (fragment.type === "url") {
    try {
      return new URL(fragment.content).hostname;
    } catch {
      return fragment.content.slice(0, 30);
    }
  }

  const text = fragment.content;
  return text.length > 30 ? `${text.slice(0, 30)}…` : text;
}

function strengthColor(strength: number): string {
  if (strength >= 0.7) return "border-l-green-500";
  if (strength >= 0.4) return "border-l-yellow-500";
  return "border-l-gray-400";
}

export function ConnectionList({
  connections,
  fragments,
  compact = false,
}: ConnectionListProps) {
  const sorted = connections.toSorted((a, b) => b.strength - a.strength);
  const fragmentMap = new Map(fragments.map((f) => [f.id, f]));

  if (sorted.length === 0) return null;

  return (
    <ul className="space-y-2" aria-label="絲線列表">
      {sorted.map((conn) => {
        const fragA = fragmentMap.get(conn.fragment_a);
        const fragB = fragmentMap.get(conn.fragment_b);
        const pct = Math.round(conn.strength * 100);

        return (
          <li
            key={conn.id}
            className={cn(
              "rounded border-l-2 bg-accent/50 px-3 py-2 text-sm",
              strengthColor(conn.strength),
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex-1 truncate">{conn.description}</span>
              <span
                className="shrink-0 text-xs font-medium text-muted-foreground"
                aria-label={`強度 ${pct}%`}
              >
                {pct}%
              </span>
            </div>
            {!compact && (
              <p className="mt-1 text-xs text-muted-foreground">
                {getFragmentLabel(fragA)} ↔ {getFragmentLabel(fragB)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
