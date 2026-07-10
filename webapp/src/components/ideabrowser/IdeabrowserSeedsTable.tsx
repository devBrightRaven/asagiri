"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import type {
  IdeabrowserSeed,
  IdeabrowserSeedScore,
  IdeabrowserSeedScores,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface IdeabrowserSeedsTableProps {
  seeds: IdeabrowserSeed[];
  initialScores: IdeabrowserSeedScores;
}

const PAGE_SIZE = 50;

function dateValue(seed: IdeabrowserSeed): number {
  const parsed = Date.parse(seed.email_date);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatEmailDate(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value || "Unknown";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}

function priorityScore(score: IdeabrowserSeedScore | undefined): number | null {
  if (!score || score.feasibility == null || score.market == null) return null;
  return (score.feasibility + score.market) / 2;
}

export function IdeabrowserSeedsTable({
  seeds,
  initialScores,
}: IdeabrowserSeedsTableProps) {
  const [search, setSearch] = useState("");
  const [seedType, setSeedType] = useState("all");
  const [domain, setDomain] = useState("all");
  const [scores, setScores] = useState(initialScores);
  const [page, setPage] = useState(0);

  const seedTypes = useMemo(
    () => Array.from(new Set(seeds.map((seed) => seed.seed_type))).sort(),
    [seeds]
  );
  const domains = useMemo(
    () =>
      Array.from(new Set(seeds.flatMap((seed) => seed.asagiri_domains))).sort(),
    [seeds]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return seeds
      .filter((seed) => {
        if (!query) return true;
        return (
          seed.title.toLowerCase().includes(query) ||
          (seed.teaser ?? "").toLowerCase().includes(query)
        );
      })
      .filter((seed) => seedType === "all" || seed.seed_type === seedType)
      .filter(
        (seed) =>
          domain === "all" || seed.asagiri_domains.includes(domain)
      )
      .sort((a, b) => dateValue(b) - dateValue(a));
  }, [seeds, search, seedType, domain]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleSeeds = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const scoredCount = Object.values(scores).filter(
    (score) => score.feasibility != null || score.market != null
  ).length;

  function resetPage() {
    setPage(0);
  }

  async function updateScore(
    seedId: string,
    field: "feasibility" | "market",
    rawValue: string
  ) {
    const current = scores[seedId] ?? {
      feasibility: null,
      market: null,
      updated_at: "",
    };
    const next = {
      ...current,
      [field]: rawValue ? Number(rawValue) : null,
    };

    setScores((previous) => ({ ...previous, [seedId]: next }));

    await fetch("api/ideabrowser-seed-scores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: seedId,
        feasibility: next.feasibility,
        market: next.market,
      }),
    });
  }

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-end gap-3"
        role="search"
        aria-label="Filter Ideabrowser seeds"
      >
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="seed-search"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Search title / teaser
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="seed-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Repairing AI search..."
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="seed-type-filter"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Seed type
          </label>
          <select
            id="seed-type-filter"
            value={seedType}
            onChange={(event) => {
              setSeedType(event.target.value);
              resetPage();
            }}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All types</option>
            {seedTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="seed-domain-filter"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Domain
          </label>
          <select
            id="seed-domain-filter"
            value={domain}
            onChange={(event) => {
              setDomain(event.target.value);
              resetPage();
            }}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All domains</option>
            {domains.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {filtered.length} of {seeds.length} seeds · {scoredCount} scored ·
          newest email first
        </p>
        <p>
          Page {page + 1} of {totalPages}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <table className="w-full table-fixed text-sm" aria-label="Ideabrowser opportunity seeds">
          <caption className="sr-only">
            Ideabrowser opportunity seeds sorted by email date descending.
          </caption>
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[32%]" />
            <col className="w-[10%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-foreground/10 bg-muted/50">
              <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                Title
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                Seed type
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                Asagiri domains
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                Email date ↓
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                Teaser
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                Score
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                URL
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleSeeds.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No Ideabrowser seeds match the current filters.
                </td>
              </tr>
            )}

            {visibleSeeds.map((seed) => {
              const score = scores[seed.id];
              const priority = priorityScore(score);

              return (
                <tr
                  key={seed.id}
                  className="border-b border-foreground/5 align-top transition-colors hover:bg-muted/30"
                >
                  <td className="break-words px-3 py-2 text-sm font-medium leading-tight text-foreground">
                    {seed.title}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{seed.seed_type}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {seed.asagiri_domains.length > 0 ? (
                        seed.asagiri_domains.map((item) => (
                          <Badge key={item} variant="outline">
                            {item}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {formatEmailDate(seed.email_date)}
                  </td>
                  <td className="break-words px-3 py-2 text-sm leading-snug text-muted-foreground">
                    {seed.teaser ?? "No teaser extracted."}
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="w-10">Feas.</span>
                        <select
                          value={score?.feasibility ?? ""}
                          onChange={(event) =>
                            updateScore(seed.id, "feasibility", event.target.value)
                          }
                          aria-label={`Feasibility score for ${seed.title}`}
                          className="h-6 w-12 rounded border border-input bg-background px-1 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <option value="">--</option>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="w-10">Market</span>
                        <select
                          value={score?.market ?? ""}
                          onChange={(event) =>
                            updateScore(seed.id, "market", event.target.value)
                          }
                          aria-label={`Market score for ${seed.title}`}
                          className="h-6 w-12 rounded border border-input bg-background px-1 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <option value="">--</option>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                      {priority != null ? (
                        <Badge variant={priority >= 4 ? "default" : "outline"}>
                          {priority.toFixed(1)}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={seed.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Open
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Ideabrowser seeds pagination"
          className="flex items-center justify-end gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPage((current) => Math.min(totalPages - 1, current + 1))
            }
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
