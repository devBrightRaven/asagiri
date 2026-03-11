"use client";

import { useMemo, useState, useCallback } from "react";
import { format, parseISO, isWithinInterval } from "date-fns";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Idea, Interactions } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type IdeaWithDate = Idea & { date: string };

interface IdeaTableProps {
  ideas: IdeaWithDate[];
  interactions: Interactions;
}

type SortField = "date" | "title" | "domain" | "feasibility_score" | "novelty_score" | "status" | "rating";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 15;

const STATUS_ORDER: Record<Idea["status"], number> = {
  executing: 0,
  researching: 1,
  interested: 2,
  new: 3,
  passed: 4,
};

function getEffectiveStatus(idea: IdeaWithDate, interactions: Interactions): Idea["status"] {
  return interactions.statuses[idea.id] ?? idea.status;
}

function getRating(idea: IdeaWithDate, interactions: Interactions): number | null {
  return interactions.ratings[idea.id] ?? idea.user_rating;
}

export function IdeaTable({ ideas, interactions }: IdeaTableProps) {
  const prefersReducedMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const domains = useMemo(
    () => Array.from(new Set(ideas.map((i) => i.domain))).sort(),
    [ideas]
  );

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir(field === "date" ? "desc" : "asc");
      }
      setPage(0);
    },
    [sortField]
  );

  const filtered = useMemo(() => {
    let result = ideas;

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(lower));
    }
    if (domainFilter !== "all") {
      result = result.filter((i) => i.domain === domainFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((i) => getEffectiveStatus(i, interactions) === statusFilter);
    }
    if (dateFrom || dateTo) {
      result = result.filter((i) => {
        const d = parseISO(i.date);
        const start = dateFrom ? parseISO(dateFrom) : new Date(0);
        const end = dateTo ? parseISO(dateTo) : new Date("2099-12-31");
        return isWithinInterval(d, { start, end });
      });
    }

    return result;
  }, [ideas, search, domainFilter, statusFilter, dateFrom, dateTo, interactions]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;

    copy.sort((a, b) => {
      switch (sortField) {
        case "date":
          return dir * a.date.localeCompare(b.date);
        case "title":
          return dir * a.title.localeCompare(b.title);
        case "domain":
          return dir * a.domain.localeCompare(b.domain);
        case "feasibility_score":
          return dir * (a.feasibility_score - b.feasibility_score);
        case "novelty_score":
          return dir * (a.novelty_score - b.novelty_score);
        case "status": {
          const sa = STATUS_ORDER[getEffectiveStatus(a, interactions)] ?? 99;
          const sb = STATUS_ORDER[getEffectiveStatus(b, interactions)] ?? 99;
          return dir * (sa - sb);
        }
        case "rating": {
          const ra = getRating(a, interactions) ?? -1;
          const rb = getRating(b, interactions) ?? -1;
          return dir * (ra - rb);
        }
        default:
          return 0;
      }
    });

    return copy;
  }, [filtered, sortField, sortDir, interactions]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="ml-1 inline size-3.5 text-muted-foreground" aria-hidden="true" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 inline size-3.5" aria-hidden="true" />
      : <ChevronDown className="ml-1 inline size-3.5" aria-hidden="true" />;
  }

  function ariaSortValue(field: SortField): "ascending" | "descending" | "none" {
    if (sortField !== field) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filter ideas">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="idea-search" className="mb-1 block text-xs font-medium text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="idea-search"
              aria-label="Search ideas by title"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Domain
          </span>
          <div
            role="radiogroup"
            aria-label="Filter by domain"
            className="flex gap-1 overflow-x-auto pb-1"
          >
            {["all", ...domains].map((d) => {
              const isSelected = domainFilter === d;
              return (
                <Button
                  key={d}
                  role="radio"
                  aria-checked={isSelected}
                  variant={isSelected ? "default" : "outline"}
                  size="xs"
                  onClick={() => { setDomainFilter(d); setPage(0); }}
                  className="shrink-0"
                >
                  {d === "all" ? "All" : d}
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Status
          </span>
          <div
            role="radiogroup"
            aria-label="Filter by status"
            className="flex gap-1 overflow-x-auto pb-1"
          >
            {(["all", "new", "interested", "researching", "passed", "executing"] as const).map((s) => {
              const isSelected = statusFilter === s;
              return (
                <Button
                  key={s}
                  role="radio"
                  aria-checked={isSelected}
                  variant={isSelected ? "default" : "outline"}
                  size="xs"
                  onClick={() => { setStatusFilter(s); setPage(0); }}
                  className="shrink-0"
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="date-from" className="mb-1 block text-xs font-medium text-muted-foreground">
            From
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div>
          <label htmlFor="date-to" className="mb-1 block text-xs font-medium text-muted-foreground">
            To
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm" aria-label="Startup ideas table">
          <caption className="sr-only">
            {sorted.length} startup ideas, sorted by {sortField} {sortDir === "asc" ? "ascending" : "descending"}.
            Showing page {page + 1} of {totalPages}.
          </caption>
          <thead>
            <tr className="border-b border-foreground/10 bg-muted/50">
              {([
                ["date", "Date"],
                ["title", "Title"],
                ["domain", "Domain"],
                ["feasibility_score", "Feasibility"],
                ["novelty_score", "Novelty"],
                ["status", "Status"],
                ["rating", "Rating"],
              ] as [SortField, string][]).map(([field, label]) => (
                <th
                  key={field}
                  scope="col"
                  aria-sort={ariaSortValue(field)}
                  className="cursor-pointer px-3 py-2 text-left font-medium text-muted-foreground select-none whitespace-nowrap hover:text-foreground"
                >
                  <button
                    type="button"
                    onClick={() => handleSort(field)}
                    className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    aria-label={`Sort by ${label}`}
                  >
                    {label}
                    <SortIcon field={field} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No ideas match the current filters.
                </td>
              </tr>
            )}
            {paged.map((idea) => {
              const status = getEffectiveStatus(idea, interactions);
              const rating = getRating(idea, interactions);
              const isExpanded = expandedId === idea.id;

              return (
                <AnimatePresence key={idea.id} initial={false}>
                  <tr
                    className="border-b border-foreground/5 transition-colors hover:bg-muted/30 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : idea.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedId(isExpanded ? null : idea.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isExpanded}
                    aria-label={`${idea.title} — click to ${isExpanded ? "collapse" : "expand"} details`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {format(parseISO(idea.date), "MMM d")}
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-2 font-medium">
                      {idea.title}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{idea.domain}</Badge>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{idea.feasibility_score}</td>
                    <td className="px-3 py-2 tabular-nums">{idea.novelty_score}</td>
                    <td className="px-3 py-2">
                      <Badge variant={status === "executing" ? "default" : "outline"}>
                        {status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {rating != null ? rating : <span className="text-muted-foreground">--</span>}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${idea.id}-detail`}>
                      <td colSpan={7} className="bg-muted/20 px-3 py-0">
                        <motion.div
                          initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 py-3 text-sm">
                            <p><span className="font-medium">One-liner:</span> {idea.one_liner}</p>
                            <p><span className="font-medium">Problem:</span> {idea.problem}</p>
                            <p><span className="font-medium">Solution:</span> {idea.solution}</p>
                            <p><span className="font-medium">Market size:</span> {idea.market_size}</p>
                            {idea.competitors.length > 0 && (
                              <p><span className="font-medium">Competitors:</span> {idea.competitors.join(", ")}</p>
                            )}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {idea.tags.map((tag) => (
                                <Badge key={tag} variant="outline">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Ideas table pagination" className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {sorted.length} ideas total — page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
