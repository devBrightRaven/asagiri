"use client";

import { useState, type KeyboardEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Idea } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
  idea: Idea;
  isOverlay?: boolean;
  onKeyboardMove: (ideaId: string, direction: "left" | "right") => void;
}

export function KanbanCard({
  idea,
  isOverlay = false,
  onKeyboardMove,
}: KanbanCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: idea.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onKeyboardMove(idea.id, "left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onKeyboardMove(idea.id, "right");
    } else if (e.key === "Enter" && !e.defaultPrevented) {
      // Enter without modifier opens detail dialog
      if (!e.shiftKey && !e.ctrlKey && !e.altKey) {
        setDialogOpen(true);
      }
    }
  };

  const truncatedOneLiner =
    idea.one_liner.length > 80
      ? `${idea.one_liner.slice(0, 80)}...`
      : idea.one_liner;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="listitem"
      aria-roledescription="draggable item"
      aria-label={`${idea.title}. Use Arrow Left and Arrow Right to move between columns.`}
      data-kanban-card-id={idea.id}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "group/kanban-card cursor-grab rounded-lg bg-card p-3 text-sm ring-1 ring-foreground/10 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "hover:ring-foreground/20",
        isDragging && "opacity-30 cursor-grabbing",
        isOverlay && "rotate-2 shadow-xl ring-primary/40 cursor-grabbing",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug text-foreground">
            {idea.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {truncatedOneLiner}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[0.65rem]">
              {idea.domain}
            </Badge>
          </div>
        </div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="mt-2 w-full"
            />
          }
        >
          View details
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{idea.title}</DialogTitle>
            <DialogDescription>{idea.one_liner}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section>
              <h4 className="mb-1 font-medium text-foreground">Problem</h4>
              <p className="text-muted-foreground">{idea.problem}</p>
            </section>
            <section>
              <h4 className="mb-1 font-medium text-foreground">Solution</h4>
              <p className="text-muted-foreground">{idea.solution}</p>
            </section>
            <section>
              <h4 className="mb-1 font-medium text-foreground">Market Size</h4>
              <p className="text-muted-foreground">{idea.market_size}</p>
            </section>
            {idea.competitors.length > 0 && (
              <section>
                <h4 className="mb-1 font-medium text-foreground">
                  Competitors
                </h4>
                <ul className="list-inside list-disc text-muted-foreground">
                  {idea.competitors.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h4 className="mb-1 font-medium text-foreground">
                Moat Analysis
              </h4>
              <p className="text-muted-foreground">{idea.moat_analysis}</p>
            </section>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{idea.domain}</Badge>
              {idea.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
