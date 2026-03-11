"use client";

import { useState, useMemo } from "react";
import type { Idea } from "@/lib/types";
import { IdeaCard } from "@/components/IdeaCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ConnectStepProps {
  ideas: Idea[];
  starredIds: Set<string>;
  onToggleStar: (id: string) => void;
  onSubmit: (connection: { ideaA: string; ideaB: string; text: string } | null) => void;
}

export function ConnectStep({
  ideas,
  starredIds,
  onToggleStar,
  onSubmit,
}: ConnectStepProps) {
  const [connectionText, setConnectionText] = useState("");

  const starredIdeas = useMemo(
    () => ideas.filter((i) => starredIds.has(i.id)),
    [ideas, starredIds]
  );

  const pair = useMemo(() => {
    if (starredIdeas.length < 2) return null;
    const shuffled = [...starredIdeas].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]] as const;
  }, [starredIdeas]);

  const handleSubmit = () => {
    if (pair && connectionText.trim()) {
      onSubmit({
        ideaA: pair[0].id,
        ideaB: pair[1].id,
        text: connectionText.trim(),
      });
    } else {
      onSubmit(null);
    }
  };

  if (!pair) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Connect</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Reflect on today&apos;s themes and patterns.
          </p>
        </div>
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 space-y-4">
          <p className="text-sm text-foreground">
            What patterns or themes did you notice across today&apos;s ideas?
          </p>
          <div>
            <label htmlFor="theme-notes" className="sr-only">
              Your observations
            </label>
            <Textarea
              id="theme-notes"
              placeholder="Share any observations... (optional)"
              value={connectionText}
              onChange={(e) => setConnectionText(e.target.value)}
              className="min-h-24"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onSubmit(null)}>
            Skip
          </Button>
          <Button onClick={handleSubmit} size="lg">
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Connect</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Find connections between your starred ideas.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <IdeaCard
          idea={pair[0]}
          isStarred={starredIds.has(pair[0].id)}
          onToggleStar={onToggleStar}
        />
        <IdeaCard
          idea={pair[1]}
          isStarred={starredIds.has(pair[1].id)}
          onToggleStar={onToggleStar}
        />
      </div>
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
        <label htmlFor="connection-text" className="text-sm font-medium text-foreground">
          What connection do you see between these two ideas?
        </label>
        <Textarea
          id="connection-text"
          placeholder="They both address... (optional)"
          value={connectionText}
          onChange={(e) => setConnectionText(e.target.value)}
          className="min-h-24"
        />
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => onSubmit(null)}>
          Skip
        </Button>
        <Button onClick={handleSubmit} size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
