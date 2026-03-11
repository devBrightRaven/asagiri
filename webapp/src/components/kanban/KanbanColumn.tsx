"use client";

import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: string;
  label: string;
  count: number;
  isOver: boolean;
  horizontal?: boolean;
  children: ReactNode;
}

export function KanbanColumn({
  id,
  label,
  count,
  isOver,
  horizontal = false,
  children,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      role="region"
      aria-label={`${label} column, ${count} ${count === 1 ? "item" : "items"}`}
      className={cn(
        "flex flex-col rounded-xl bg-muted/40 ring-1 ring-foreground/5 transition-colors",
        !horizontal && "min-h-[10rem]",
        isOver && "bg-primary/5 ring-primary/30",
      )}
    >
      {!horizontal && (
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            {label}
          </h2>
          <Badge variant="secondary" className="font-mono tabular-nums">
            {count}
          </Badge>
        </div>
      )}
      <div
        role="list"
        aria-label={`${label} ideas`}
        className={cn(
          "gap-2 px-2 pb-2",
          horizontal
            ? "flex flex-wrap"
            : "flex flex-1 flex-col",
        )}
      >
        {children}
      </div>
    </section>
  );
}
