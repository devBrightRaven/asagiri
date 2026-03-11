"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { LayoutGrid, Table, X, Star, MessageSquare, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import type { DomainData, DomainIdea } from "@/app/territory/page";

interface TerritoryMapProps {
  domains: DomainData[];
  totalIdeas: number;
}

type SortKey = "count" | "avgFeasibility" | "avgNovelty" | "domain";

export function TerritoryMap({ domains, totalIdeas }: TerritoryMapProps) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const prefersReducedMotion = useReducedMotion();

  const explored = domains.filter((d) => d.count > 0);
  const unexplored = domains.filter((d) => d.count === 0);

  const sortedExplored = useMemo(() => {
    const sorted = [...explored];
    switch (sortKey) {
      case "count":
        sorted.sort((a, b) => b.count - a.count);
        break;
      case "avgFeasibility":
        sorted.sort((a, b) => b.avgFeasibility - a.avgFeasibility);
        break;
      case "avgNovelty":
        sorted.sort((a, b) => b.avgNovelty - a.avgNovelty);
        break;
      case "domain":
        sorted.sort((a, b) => a.domain.localeCompare(b.domain));
        break;
    }
    return sorted;
  }, [explored, sortKey]);

  const selectedDomainData = useMemo(
    () => domains.find((d) => d.domain === selectedDomain) ?? null,
    [domains, selectedDomain]
  );

  const maxCount = Math.max(...explored.map((d) => d.count), 1);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold uppercase tracking-wider">
            Territory Map
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalIdeas} ideas across {explored.length} explored / {domains.length} total domains
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="View toggle"
            className="flex gap-1 rounded-lg border border-border p-1"
          >
            <Button
              variant={view === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
            >
              <LayoutGrid className="mr-1.5 size-3.5" aria-hidden="true" />
              Grid
            </Button>
            <Button
              variant={view === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
            >
              <Table className="mr-1.5 size-3.5" aria-hidden="true" />
              Table
            </Button>
          </div>
        </div>
      </header>

      {view === "grid" ? (
        <div className="space-y-8">
          {/* Sort control */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Sort by</span>
            <div role="radiogroup" aria-label="Sort order" className="flex gap-1">
              {([
                { key: "count", label: "Ideas" },
                { key: "avgFeasibility", label: "Feasibility" },
                { key: "avgNovelty", label: "Novelty" },
                { key: "domain", label: "A-Z" },
              ] as const).map(({ key, label }) => (
                <Button
                  key={key}
                  variant={sortKey === key ? "secondary" : "ghost"}
                  size="sm"
                  role="radio"
                  aria-checked={sortKey === key}
                  onClick={() => setSortKey(key)}
                  className="h-7 text-xs"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Explored domains — card grid */}
          {sortedExplored.length > 0 && (
            <section>
              <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Explored ({explored.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedExplored.map((d) => (
                  <DomainCard
                    key={d.domain}
                    domain={d}
                    maxCount={maxCount}
                    isSelected={selectedDomain === d.domain}
                    onClick={() =>
                      setSelectedDomain((prev) =>
                        prev === d.domain ? null : d.domain
                      )
                    }
                    reducedMotion={!!prefersReducedMotion}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Unexplored domains */}
          {unexplored.length > 0 && (
            <section>
              <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Uncharted ({unexplored.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {unexplored.map((d) => (
                  <span
                    key={d.domain}
                    className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"
                  >
                    {d.domain}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <DomainTable domains={domains} />
      )}

      {/* Selected Domain Detail */}
      <AnimatePresence>
        {selectedDomainData && selectedDomainData.count > 0 && (
          <motion.div
            key="detail"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-mono uppercase tracking-wider">
                      {selectedDomainData.domain}
                    </CardTitle>
                    <CardDescription>
                      {selectedDomainData.count} idea{selectedDomainData.count !== 1 ? "s" : ""} |
                      Feasibility {selectedDomainData.avgFeasibility} |
                      Novelty {selectedDomainData.avgNovelty}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSelectedDomain(null)}
                    aria-label="Close domain detail"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedDomainData.ideas.map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} />
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DomainCard({
  domain,
  maxCount,
  isSelected,
  onClick,
  reducedMotion,
}: {
  domain: DomainData;
  maxCount: number;
  isSelected: boolean;
  onClick: () => void;
  reducedMotion: boolean;
}) {
  const barWidth = (domain.count / maxCount) * 100;
  const engaged = domain.ideas.filter((i) => i.hasRating || i.hasNote).length;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`cyber-card group w-full rounded-lg border p-4 text-left transition-all
        ${isSelected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-primary/30"
        }
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      aria-pressed={isSelected}
      aria-label={`${domain.domain}: ${domain.count} ideas, feasibility ${domain.avgFeasibility}, novelty ${domain.avgNovelty}`}
    >
      {/* Domain name + count */}
      <div className="flex items-start justify-between">
        <span className="font-mono text-sm font-semibold text-foreground">
          {domain.domain}
        </span>
        <span className="font-mono text-lg font-bold tabular-nums text-primary">
          {domain.count}
        </span>
      </div>

      {/* Bar */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span>F {domain.avgFeasibility}</span>
        <span>N {domain.avgNovelty}</span>
        {engaged > 0 && (
          <span className="flex items-center gap-1 text-primary">
            <Star className="size-3" aria-hidden="true" />
            {engaged} engaged
          </span>
        )}
      </div>
    </motion.button>
  );
}

function DomainTable({ domains }: { domains: DomainData[] }) {
  const sorted = useMemo(
    () => [...domains].sort((a, b) => b.count - a.count),
    [domains]
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Domain statistics for all startup idea territories
        </caption>
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left">
            <th className="px-4 py-3 font-mono text-xs font-medium uppercase tracking-wider" scope="col">Domain</th>
            <th className="px-4 py-3 font-mono text-xs font-medium uppercase tracking-wider text-right" scope="col">Ideas</th>
            <th className="px-4 py-3 font-mono text-xs font-medium uppercase tracking-wider text-right" scope="col">Feasibility</th>
            <th className="px-4 py-3 font-mono text-xs font-medium uppercase tracking-wider text-right" scope="col">Novelty</th>
            <th className="px-4 py-3 font-mono text-xs font-medium uppercase tracking-wider text-right" scope="col">Engaged</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => {
            const engaged = d.ideas.filter((i) => i.hasRating || i.hasNote).length;
            return (
              <tr
                key={d.domain}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3 font-medium">{d.domain}</td>
                <td className="px-4 py-3 text-right tabular-nums">{d.count || "--"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {d.count > 0 ? d.avgFeasibility : "--"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {d.count > 0 ? d.avgNovelty : "--"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {d.count > 0 ? `${engaged}/${d.count}` : "--"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IdeaRow({ idea }: { idea: DomainIdea }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted/30">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{idea.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          {idea.oneLiner}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-mono">F{idea.feasibilityScore}</span>
          <span className="font-mono">N{idea.noveltyScore}</span>
          {idea.hasRating && (
            <span className="flex items-center gap-1 text-primary">
              <Star className="size-3" aria-hidden="true" /> Rated
            </span>
          )}
          {idea.hasNote && (
            <span className="flex items-center gap-1 text-primary">
              <MessageSquare className="size-3" aria-hidden="true" /> Noted
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
