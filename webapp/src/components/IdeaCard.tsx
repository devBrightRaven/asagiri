"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { Idea } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface IdeaCardProps {
  idea: Idea;
  isStarred: boolean;
  onToggleStar: (id: string) => void;
}

function ScoreIndicator({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${label}: ${score} out of 10`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = score >= (i + 1) * 2;
          const half = !filled && score >= (i + 1) * 2 - 1;
          return (
            <div
              key={i}
              className={`size-2 rounded-full border border-muted-foreground/30 ${
                filled
                  ? "bg-primary"
                  : half
                    ? "bg-primary/50"
                    : "bg-transparent"
              }`}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <span className="text-xs font-medium tabular-nums">{score}</span>
    </div>
  );
}

export function IdeaCard({ idea, isStarred, onToggleStar }: IdeaCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="cyber-card transition-all duration-300">
        <CardHeader>
          <CardTitle>{idea.title}</CardTitle>
          <CardDescription>{idea.one_liner}</CardDescription>
          <CardAction>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onToggleStar(idea.id)}
              aria-label={isStarred ? `Remove ${idea.title} from favorites` : `Add ${idea.title} to favorites`}
              aria-pressed={isStarred}
            >
              <Star
                className={`size-4 ${
                  isStarred
                    ? "fill-yellow-500 text-yellow-500"
                    : "text-muted-foreground"
                }`}
                aria-hidden="true"
              />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{idea.domain}</Badge>
            {idea.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex gap-4">
            <ScoreIndicator label="Feasibility" score={idea.feasibility_score} />
            <ScoreIndicator label="Novelty" score={idea.novelty_score} />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={<Button variant="ghost" size="sm" />}
            >
              View details
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{idea.title}</DialogTitle>
                <DialogDescription>{idea.one_liner}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-base">
                <section>
                  <h4 className="font-mono font-semibold text-primary mb-1 uppercase tracking-wider text-sm">Problem</h4>
                  <p className="text-muted-foreground leading-relaxed">{idea.problem}</p>
                </section>
                <section>
                  <h4 className="font-mono font-semibold text-primary mb-1 uppercase tracking-wider text-sm">Solution</h4>
                  <p className="text-muted-foreground leading-relaxed">{idea.solution}</p>
                </section>
                <section>
                  <h4 className="font-mono font-semibold text-primary mb-1 uppercase tracking-wider text-sm">Market Size</h4>
                  <p className="text-muted-foreground leading-relaxed">{idea.market_size}</p>
                </section>
                {idea.competitors.length > 0 && (
                  <section>
                    <h4 className="font-mono font-semibold text-primary mb-1 uppercase tracking-wider text-sm">Competitors</h4>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {idea.competitors.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </section>
                )}
                <section>
                  <h4 className="font-mono font-semibold text-primary mb-1 uppercase tracking-wider text-sm">Moat Analysis</h4>
                  <p className="text-muted-foreground">{idea.moat_analysis}</p>
                </section>
                <div className="flex gap-4">
                  <ScoreIndicator label="Feasibility" score={idea.feasibility_score} />
                  <ScoreIndicator label="Novelty" score={idea.novelty_score} />
                </div>
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
        </CardContent>
      </Card>
    </motion.div>
  );
}
