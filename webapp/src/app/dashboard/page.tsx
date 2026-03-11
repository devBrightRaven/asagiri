import {
  getAllIdeas,
  getInteractions,
  computeStats,
} from "@/lib/data";
import type { Idea } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { IdeaTable } from "@/components/dashboard/IdeaTable";
import { DomainChart } from "@/components/dashboard/DomainChart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [allIdeasByDate, interactions] = await Promise.all([
    getAllIdeas(),
    getInteractions(),
  ]);
  const stats = await computeStats(interactions);

  const flatIdeas: (Idea & { date: string })[] = allIdeasByDate.flatMap(
    ({ date, ideas }) => ideas.map((idea) => ({ ...idea, date }))
  );

  const avgScore =
    flatIdeas.length > 0
      ? flatIdeas.reduce(
          (sum, i) => sum + (i.feasibility_score + i.novelty_score) / 2,
          0
        ) / flatIdeas.length
      : 0;

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Overview of all researched startup ideas
          </p>
        </header>

        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">
            Key statistics
          </h2>
          <StatsCards
            totalIdeas={stats.total_ideas}
            currentStreak={stats.current_streak}
            totalDomains={stats.total_domains}
            avgScore={avgScore}
          />
        </section>

        <section aria-labelledby="domain-chart-heading">
          <h2 id="domain-chart-heading" className="text-xl font-semibold text-foreground">
            Ideas by Domain
          </h2>
          <DomainChart domainCounts={stats.domain_counts} />
        </section>

        <section aria-labelledby="ideas-table-heading">
          <h2 id="ideas-table-heading" className="text-xl font-semibold text-foreground">
            All Ideas
          </h2>
          <IdeaTable
            ideas={flatIdeas}
            interactions={interactions}
          />
        </section>
      </div>
    </div>
  );
}
