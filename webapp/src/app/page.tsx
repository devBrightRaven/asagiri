import { format } from "date-fns";
import {
  getDailyResearch,
  getInteractions,
  getReviewQueue,
  computeStats,
} from "@/lib/data";
import { RitualFlow } from "@/components/ritual/RitualFlow";

export const dynamic = "force-dynamic";

export default async function Home() {
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const [research, interactions, reviewItems] = await Promise.all([
    getDailyResearch(todayDate),
    getInteractions(),
    getReviewQueue(todayDate),
  ]);
  const stats = await computeStats(interactions);

  if (!research || research.ideas.length === 0) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-4"
        aria-label="No data available"
      >
        <h1 className="text-2xl font-bold">Asagiri</h1>
        <p className="text-muted-foreground text-center max-w-md">
          No research data yet for today ({todayDate}). Run the research engine
          to generate today&apos;s startup ideas.
        </p>
      </div>
    );
  }

  return (
    <RitualFlow
      todayDate={todayDate}
      ideas={research.ideas}
      reviewItems={reviewItems}
      interactions={interactions}
      stats={stats}
    />
  );
}
