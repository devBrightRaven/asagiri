"use client";

import { useEffect, useRef, useState } from "react";
import type { Idea } from "@/lib/types";
import { IdeaCard } from "@/components/IdeaCard";
import { Button } from "@/components/ui/button";

interface ExploreStepProps {
  ideas: Idea[];
  starredIds: Set<string>;
  onToggleStar: (id: string) => void;
  onContinue: () => void;
}

export function ExploreStep({
  ideas,
  starredIds,
  onToggleStar,
  onContinue,
}: ExploreStepProps) {
  const [exploredCount, setExploredCount] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-idea-id");
            if (id && !seenIds.current.has(id)) {
              seenIds.current.add(id);
              setExploredCount(seenIds.current.size);
            }
          }
        }
      },
      { threshold: 0.5 }
    );

    return () => observerRef.current?.disconnect();
  }, []);

  const cardRef = (el: HTMLDivElement | null) => {
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Explore</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Browse today&apos;s startup ideas.
          </p>
        </div>
        <div
          className="text-sm text-muted-foreground tabular-nums"
          aria-live="polite"
          aria-label={`${exploredCount} of ${ideas.length} explored`}
        >
          {exploredCount} of {ideas.length} explored
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {ideas.map((idea) => (
          <div key={idea.id} ref={cardRef} data-idea-id={idea.id}>
            <IdeaCard
              idea={idea}
              isStarred={starredIds.has(idea.id)}
              onToggleStar={onToggleStar}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={onContinue} size="lg">
          Mark favorites and continue
        </Button>
      </div>
    </div>
  );
}
