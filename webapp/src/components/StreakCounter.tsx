"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakCounterProps {
  streak: number;
  size?: "compact" | "large";
}

export function StreakCounter({ streak, size = "compact" }: StreakCounterProps) {
  const prefersReducedMotion = useReducedMotion();
  const [displayedStreak, setDisplayedStreak] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedStreak(streak);
      return;
    }
    let current = 0;
    const step = Math.max(1, Math.floor(streak / 20));
    const interval = setInterval(() => {
      current = Math.min(current + step, streak);
      setDisplayedStreak(current);
      if (current >= streak) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [streak, prefersReducedMotion]);

  const isLarge = size === "large";

  return (
    <div
      className={`inline-flex items-center gap-2 ${isLarge ? "gap-3" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`${streak} day streak`}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Flame
          className={`text-orange-500 ${isLarge ? "size-10" : "size-5"}`}
          aria-hidden="true"
        />
      </motion.div>
      <div className="flex items-baseline gap-1">
        <motion.span
          key={displayedStreak}
          className={`font-mono font-bold tabular-nums text-primary ${
            isLarge ? "text-5xl" : "text-lg"
          }`}
          initial={prefersReducedMotion ? false : { y: -4, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {displayedStreak}
        </motion.span>
        <span
          className={`text-muted-foreground ${
            isLarge ? "text-lg" : "text-xs hidden sm:inline"
          }`}
        >
          day streak
        </span>
      </div>
    </div>
  );
}
