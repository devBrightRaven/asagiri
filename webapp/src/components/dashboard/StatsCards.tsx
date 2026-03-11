"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Lightbulb, Flame, Globe, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface StatsCardsProps {
  totalIdeas: number;
  currentStreak: number;
  totalDomains: number;
  avgScore: number;
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const prefersReducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayed(value);
      return;
    }
    let current = 0;
    const steps = 30;
    const increment = value / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      current = Math.min(step * increment, value);
      setDisplayed(current);
      if (step >= steps) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [value, prefersReducedMotion]);

  return (
    <motion.span
      className="text-4xl font-mono font-bold tabular-nums text-primary"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {decimals > 0 ? displayed.toFixed(decimals) : Math.round(displayed)}
    </motion.span>
  );
}

const cards = [
  {
    key: "total",
    label: "ideas researched",
    icon: Lightbulb,
    iconClass: "text-blue-500",
    getValue: (p: StatsCardsProps) => p.totalIdeas,
    decimals: 0,
  },
  {
    key: "streak",
    label: "day streak",
    icon: Flame,
    iconClass: "text-orange-500",
    getValue: (p: StatsCardsProps) => p.currentStreak,
    decimals: 0,
  },
  {
    key: "domains",
    label: "/15 domains",
    icon: Globe,
    iconClass: "text-emerald-500",
    getValue: (p: StatsCardsProps) => p.totalDomains,
    decimals: 0,
  },
  {
    key: "avg",
    label: "avg score",
    icon: TrendingUp,
    iconClass: "text-violet-500",
    getValue: (p: StatsCardsProps) => p.avgScore,
    decimals: 1,
  },
] as const;

export function StatsCards(props: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key} className="cyber-card transition-all duration-300">
            <CardContent className="flex items-center gap-4 py-5">
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20"
                aria-hidden="true"
              >
                <Icon className={`size-6 ${card.iconClass}`} />
              </div>
              <div className="min-w-0">
                <AnimatedNumber
                  value={card.getValue(props)}
                  decimals={card.decimals}
                />
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
