import type { Metadata } from "next";
import { getIdeabrowserSeedScores, getIdeabrowserSeeds } from "@/lib/data";
import { IdeabrowserSeedsTable } from "@/components/ideabrowser/IdeabrowserSeedsTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ideabrowser Seeds | Asagiri",
  description: "Browse extracted Ideabrowser opportunity seeds",
};

export default async function IdeabrowserSeedsPage() {
  const [seeds, scores] = await Promise.all([
    getIdeabrowserSeeds(),
    getIdeabrowserSeedScores(),
  ]);
  const latestEmailDate = seeds
    .map((seed) => Date.parse(seed.email_date))
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => b - a)[0];

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Ideabrowser Seeds
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Extracted opportunity seeds ready for Asagiri triage.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{seeds.length}</span>{" "}
            seeds
            {latestEmailDate ? (
              <>
                {" "}
                · latest email{" "}
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(latestEmailDate))}
              </>
            ) : null}
          </div>
        </header>

        <IdeabrowserSeedsTable seeds={seeds} initialScores={scores} />
      </div>
    </div>
  );
}
