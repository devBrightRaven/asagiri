"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { StreakCounter } from "@/components/StreakCounter";
import { Button } from "@/components/ui/button";

interface CompleteStepProps {
  streak: number;
  totalIdeasExplored: number;
  domainsExplored: string[];
}

export function CompleteStep({
  streak,
  totalIdeasExplored,
  domainsExplored,
}: CompleteStepProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center gap-8 py-12 text-center">
      <motion.div
        initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
      >
        <CheckCircle2
          className="size-16 text-green-500"
          aria-hidden="true"
        />
      </motion.div>

      <motion.h2
        className="text-2xl font-bold"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        Ritual Complete!
      </motion.h2>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <StreakCounter streak={streak} size="large" />
      </motion.div>

      <motion.div
        className="space-y-2 text-muted-foreground"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.3 }}
        role="status"
        aria-live="polite"
      >
        <p>
          You explored{" "}
          <span className="text-foreground font-medium">{totalIdeasExplored}</span>{" "}
          ideas across{" "}
          <span className="text-foreground font-medium">
            {domainsExplored.length}
          </span>{" "}
          domains.
        </p>
        {domainsExplored.length > 0 && (
          <p className="text-sm">
            {domainsExplored.join(", ")}
          </p>
        )}
      </motion.div>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.3 }}
      >
        <Button size="lg" onClick={() => window.location.reload()}>
          Go to Dashboard
        </Button>
      </motion.div>
    </div>
  );
}
