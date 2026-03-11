"use client";

import { useState, useCallback, useRef, useId } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  rectIntersection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ChevronDown } from "lucide-react";
import type { Idea, Interactions } from "@/lib/types";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_COLUMNS: { id: Idea["status"]; label: string }[] = [
  { id: "interested", label: "Interested" },
  { id: "researching", label: "Researching" },
  { id: "executing", label: "Executing" },
  { id: "passed", label: "Passed" },
];

const ALL_COLUMNS = [{ id: "new" as const, label: "New" }, ...STATUS_COLUMNS];

interface KanbanBoardProps {
  ideas: (Idea & { _date: string })[];
  interactions: Interactions;
}

export function KanbanBoard({ ideas, interactions }: KanbanBoardProps) {
  const [statuses, setStatuses] = useState<Record<string, Idea["status"]>>(
    () => interactions.statuses,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [inboxOpen, setInboxOpen] = useState(false);
  const announcementId = useId();
  const savingRef = useRef(false);

  const getIdeaStatus = useCallback(
    (ideaId: string): Idea["status"] => statuses[ideaId] ?? "new",
    [statuses],
  );

  const ideaMap = new Map(ideas.map((idea) => [idea.id, idea]));

  const newIdeas = ideas.filter((idea) => getIdeaStatus(idea.id) === "new");
  const statusColumnIdeas = STATUS_COLUMNS.map((col) => ({
    ...col,
    ideas: ideas.filter((idea) => getIdeaStatus(idea.id) === col.id),
  }));

  const activeIdea = activeId ? ideaMap.get(activeId) : undefined;

  const persistStatuses = useCallback(
    async (next: Record<string, Idea["status"]>) => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const updated: Interactions = { ...interactions, statuses: next };
        await fetch("/api/interactions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
      } finally {
        savingRef.current = false;
      }
    },
    [interactions],
  );

  const moveIdea = useCallback(
    (ideaId: string, targetColumn: Idea["status"]) => {
      const idea = ideaMap.get(ideaId);
      const colLabel =
        ALL_COLUMNS.find((c) => c.id === targetColumn)?.label ?? targetColumn;

      setStatuses((prev) => {
        const next = { ...prev, [ideaId]: targetColumn };
        persistStatuses(next);
        return next;
      });

      if (idea) {
        setAnnouncement(`Moved ${idea.title} to ${colLabel}`);
      }
    },
    [ideaMap, persistStatuses],
  );

  const handleKeyboardMove = useCallback(
    (ideaId: string, direction: "left" | "right") => {
      const currentStatus = getIdeaStatus(ideaId);
      const currentIndex = ALL_COLUMNS.findIndex((c) => c.id === currentStatus);
      const nextIndex =
        direction === "right"
          ? Math.min(currentIndex + 1, ALL_COLUMNS.length - 1)
          : Math.max(currentIndex - 1, 0);

      if (nextIndex !== currentIndex) {
        moveIdea(ideaId, ALL_COLUMNS[nextIndex].id);
      }
    },
    [getIdeaStatus, moveIdea],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const over = event.over?.id;
    setOverId(over ? String(over) : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverId(null);

      if (!over) return;

      const ideaId = String(active.id);
      const targetColumn = String(over.id) as Idea["status"];

      if (ALL_COLUMNS.some((c) => c.id === targetColumn)) {
        const currentStatus = getIdeaStatus(ideaId);
        if (currentStatus !== targetColumn) {
          moveIdea(ideaId, targetColumn);
        }
      }

      requestAnimationFrame(() => {
        const el = document.querySelector(
          `[data-kanban-card-id="${ideaId}"]`,
        ) as HTMLElement | null;
        el?.focus();
      });
    },
    [getIdeaStatus, moveIdea],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  return (
    <>
      <div
        aria-live="assertive"
        aria-atomic="true"
        id={announcementId}
        className="sr-only"
      >
        {announcement}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Inbox — collapsible New ideas */}
        <section className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setInboxOpen((prev) => !prev)}
            className="mb-2 flex w-full items-center justify-between px-4 py-3 text-left"
            aria-expanded={inboxOpen}
          >
            <span className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Inbox — {newIdeas.length} unsorted
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                inboxOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </Button>
          {inboxOpen && (
            <KanbanColumn
              id="new"
              label="New"
              count={newIdeas.length}
              isOver={overId === "new"}
              horizontal
            >
              {newIdeas.map((idea) => (
                <KanbanCard
                  key={idea.id}
                  idea={idea}
                  onKeyboardMove={handleKeyboardMove}
                />
              ))}
            </KanbanColumn>
          )}
        </section>

        {/* Status columns */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statusColumnIdeas.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              count={col.ideas.length}
              isOver={overId === col.id}
            >
              {col.ideas.map((idea) => (
                <KanbanCard
                  key={idea.id}
                  idea={idea}
                  onKeyboardMove={handleKeyboardMove}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>

        <DragOverlay>
          {activeIdea ? (
            <KanbanCard idea={activeIdea} isOverlay onKeyboardMove={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
