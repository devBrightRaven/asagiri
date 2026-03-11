"use client";

import type { Idea, ReviewItem } from "@/lib/types";
import { IdeaCard } from "@/components/IdeaCard";
import { Button } from "@/components/ui/button";

interface ReviewStepProps {
  reviewItems: ReviewItem[];
  ideasMap: Map<string, Idea>;
  starredIds: Set<string>;
  onToggleStar: (id: string) => void;
  onContinue: () => void;
}

export function ReviewStep({
  reviewItems,
  ideasMap,
  starredIds,
  onToggleStar,
  onContinue,
}: ReviewStepProps) {
  if (reviewItems.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <h2 className="text-xl font-semibold">No Reviews Today</h2>
        <p className="text-muted-foreground max-w-md">
          You have no ideas scheduled for review today. Continue to explore
          new ideas.
        </p>
        <Button onClick={onContinue} size="lg">
          Skip to Explore
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Revisit these ideas from previous sessions.
        </p>
      </div>
      <div className="grid gap-4">
        {reviewItems.map((item) => {
          const idea = ideasMap.get(item.id);
          if (!idea) return null;
          return (
            <IdeaCard
              key={item.id}
              idea={idea}
              isStarred={starredIds.has(item.id)}
              onToggleStar={onToggleStar}
            />
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={onContinue} size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
