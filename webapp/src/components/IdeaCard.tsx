"use client";

import { useState } from "react";
import { Star, Network, Check, Loader2 } from "lucide-react";
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

interface SasaganiThread {
  id: string;
  name: string;
  status: string;
}

type IngestStatus = "idle" | "loading-threads" | "picking" | "sending" | "done" | "error";

function useSasaganiIngest(idea: Idea) {
  const [status, setStatus] = useState<IngestStatus>("idle");
  const [threads, setThreads] = useState<SasaganiThread[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const openPicker = async () => {
    setStatus("loading-threads");
    setErrorMsg("");
    try {
      const res = await fetch("/api/sasagani/threads");
      if (!res.ok) throw new Error("Failed to load threads");
      const data: SasaganiThread[] = await res.json();
      if (data.length === 0) {
        setErrorMsg("No active threads. Create one in Sasagani first.");
        setStatus("error");
        return;
      }
      setThreads(data);
      setStatus("picking");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const send = async (threadId: string) => {
    setStatus("sending");
    try {
      const res = await fetch("/api/sasagani/ingest-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea_id: idea.id,
          idea_title: idea.title,
          idea_one_liner: idea.one_liner,
          thread_id: threadId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send");
      }
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setThreads([]);
    setErrorMsg("");
  };

  return { status, threads, errorMsg, openPicker, send, reset };
}

export function IdeaCard({ idea, isStarred, onToggleStar }: IdeaCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sasaganiOpen, setSasaganiOpen] = useState(false);
  const sasagani = useSasaganiIngest(idea);
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
              onClick={() => {
                sasagani.openPicker();
                setSasaganiOpen(true);
              }}
              aria-label={`Send ${idea.title} to Sasagani thread`}
            >
              {sasagani.status === "done" ? (
                <Check className="size-4 text-green-500" aria-hidden="true" />
              ) : sasagani.status === "sending" || sasagani.status === "loading-threads" ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : (
                <Network className="size-4 text-muted-foreground" aria-hidden="true" />
              )}
            </Button>
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
          <Dialog
            open={sasaganiOpen}
            onOpenChange={(open) => {
              setSasaganiOpen(open);
              if (!open) sasagani.reset();
            }}
          >
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Send to Sasagani</DialogTitle>
                <DialogDescription>
                  Pick a thread to ferment this idea in.
                </DialogDescription>
              </DialogHeader>
              {sasagani.status === "loading-threads" && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading threads" />
                </div>
              )}
              {sasagani.status === "error" && (
                <p className="text-sm text-destructive py-2" role="alert">{sasagani.errorMsg}</p>
              )}
              {sasagani.status === "picking" && (
                <fieldset className="space-y-2" aria-label="Available threads">
                  {sasagani.threads.map((thread) => (
                    <Button
                      key={thread.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        sasagani.send(thread.id);
                        setSasaganiOpen(false);
                      }}
                    >
                      <Network className="size-4 mr-2 shrink-0" aria-hidden="true" />
                      {thread.name}
                    </Button>
                  ))}
                </fieldset>
              )}
              {sasagani.status === "sending" && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Sending" />
                </div>
              )}
              <DialogFooter showCloseButton />
            </DialogContent>
          </Dialog>

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
