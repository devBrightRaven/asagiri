"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { format } from "date-fns";
import type { Idea, Interactions, ReviewItem, Stats } from "@/lib/types";
import { StreakCounter } from "@/components/StreakCounter";
import { ReviewStep } from "./ReviewStep";
import { ExploreStep } from "./ExploreStep";
import { ConnectStep } from "./ConnectStep";
import { CompleteStep } from "./CompleteStep";
import { Progress } from "@/components/ui/progress";

const STEPS = ["Review", "Explore", "Connect", "Complete"] as const;
type Step = (typeof STEPS)[number];

interface RitualFlowProps {
  todayDate: string;
  ideas: Idea[];
  reviewItems: ReviewItem[];
  interactions: Interactions;
  stats: Stats;
}

export function RitualFlow({
  todayDate,
  ideas,
  reviewItems,
  interactions,
  stats,
}: RitualFlowProps) {
  const prefersReducedMotion = useReducedMotion();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const [id, status] of Object.entries(interactions.statuses)) {
      if (status === "interested") initial.add(id);
    }
    return initial;
  });
  const [connectionData, setConnectionData] = useState<{
    ideaA: string;
    ideaB: string;
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentStep = STEPS[currentStepIndex];
  const progressValue = ((currentStepIndex + 1) / STEPS.length) * 100;

  const ideasMap = useMemo(() => {
    const map = new Map<string, Idea>();
    for (const idea of ideas) {
      map.set(idea.id, idea);
    }
    return map;
  }, [ideas]);

  const toggleStar = useCallback((id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const domainsExplored = useMemo(() => {
    const domains = new Set<string>();
    for (const idea of ideas) {
      domains.add(idea.domain);
    }
    return Array.from(domains);
  }, [ideas]);

  const goToNext = useCallback(() => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  const handleConnectSubmit = useCallback(
    async (data: { ideaA: string; ideaB: string; text: string } | null) => {
      setConnectionData(data);
      setIsSaving(true);

      try {
        const updatedInteractions: Interactions = {
          ...interactions,
          statuses: { ...interactions.statuses },
          connections: [...interactions.connections],
          ritual_completions: [...interactions.ritual_completions],
        };

        for (const id of starredIds) {
          updatedInteractions.statuses[id] = "interested";
        }

        if (data) {
          updatedInteractions.connections.push({
            date: todayDate,
            idea_a: data.ideaA,
            idea_b: data.ideaB,
            connection: data.text,
          });
        }

        if (!updatedInteractions.ritual_completions.includes(todayDate)) {
          updatedInteractions.ritual_completions.push(todayDate);
        }

        await fetch("/api/interactions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedInteractions),
        });
      } catch (err) {
        console.error("Failed to save interactions:", err);
      } finally {
        setIsSaving(false);
        goToNext();
      }
    },
    [interactions, starredIds, todayDate, goToNext]
  );

  const motionVariants = prefersReducedMotion
    ? { initial: {}, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
      };

  return (
    <div
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6"
      aria-label="Morning Ritual"
    >

      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Morning Ritual</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(todayDate), "EEEE, MMMM d, yyyy")}
          </p>
          <p className="mt-1 font-mono text-xs tracking-wider text-primary/70">
            Ten instant perspective jumps through the morning mist.
          </p>
        </div>
        <StreakCounter streak={stats.current_streak} />
      </header>

      {/* Step indicator */}
      <nav aria-label="Ritual progress" className="mb-8 space-y-3">
        <div className="flex justify-between">
          {STEPS.map((step, i) => (
            <span
              key={step}
              className={`text-xs font-medium ${
                i <= currentStepIndex
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
              aria-current={i === currentStepIndex ? "step" : undefined}
            >
              {step}
            </span>
          ))}
        </div>
        <Progress
          value={progressValue}
          aria-label={`Step ${currentStepIndex + 1} of ${STEPS.length}: ${currentStep}`}
        />
      </nav>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          variants={motionVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        >
          {currentStep === "Review" && (
            <ReviewStep
              reviewItems={reviewItems}
              ideasMap={ideasMap}
              starredIds={starredIds}
              onToggleStar={toggleStar}
              onContinue={goToNext}
            />
          )}
          {currentStep === "Explore" && (
            <ExploreStep
              ideas={ideas}
              starredIds={starredIds}
              onToggleStar={toggleStar}
              onContinue={goToNext}
            />
          )}
          {currentStep === "Connect" && (
            <ConnectStep
              ideas={ideas}
              starredIds={starredIds}
              onToggleStar={toggleStar}
              onSubmit={handleConnectSubmit}
            />
          )}
          {currentStep === "Complete" && (
            <CompleteStep
              streak={stats.current_streak + 1}
              totalIdeasExplored={ideas.length}
              domainsExplored={domainsExplored}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {isSaving && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
          role="status"
          aria-live="assertive"
        >
          <p className="text-sm text-muted-foreground">Saving...</p>
        </div>
      )}
    </div>
  );
}
