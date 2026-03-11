import { getAllIdeas, getInteractions, computeStats } from "@/lib/data";
import { TerritoryMap } from "@/components/territory/TerritoryMap";
import type { Idea } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALL_DOMAINS = [
  "AI/ML",
  "Developer Tools",
  "Gaming",
  "FinTech",
  "Health Tech",
  "Education",
  "Creator Economy",
  "Hardware/IoT",
  "Sustainability",
  "B2B SaaS",
  "Consumer Apps",
  "Marketplace",
  "Logistics",
  "Legal Tech",
  "Real Estate Tech",
] as const;

export interface DomainData {
  domain: string;
  count: number;
  avgFeasibility: number;
  avgNovelty: number;
  engagementPercent: number;
  ideas: DomainIdea[];
}

export interface DomainIdea {
  id: string;
  title: string;
  domain: string;
  oneLiner: string;
  feasibilityScore: number;
  noveltyScore: number;
  hasRating: boolean;
  hasNote: boolean;
}

export default async function TerritoryPage() {
  const [allIdeasByDate, interactions] = await Promise.all([
    getAllIdeas(),
    getInteractions(),
  ]);
  const stats = await computeStats(interactions);

  const ideasByDomain = new Map<string, Idea[]>();
  for (const { ideas } of allIdeasByDate) {
    for (const idea of ideas) {
      const existing = ideasByDomain.get(idea.domain) ?? [];
      ideasByDomain.set(idea.domain, [...existing, idea]);
    }
  }

  const domainDataList: DomainData[] = ALL_DOMAINS.map((domain) => {
    const ideas = ideasByDomain.get(domain) ?? [];
    const count = ideas.length;

    const avgFeasibility =
      count > 0
        ? ideas.reduce((sum, i) => sum + i.feasibility_score, 0) / count
        : 0;
    const avgNovelty =
      count > 0
        ? ideas.reduce((sum, i) => sum + i.novelty_score, 0) / count
        : 0;

    const ratedOrNoted = ideas.filter(
      (i) =>
        interactions.ratings[i.id] !== undefined ||
        interactions.notes[i.id] !== undefined
    );
    const engagementPercent =
      count > 0 ? (ratedOrNoted.length / count) * 100 : 0;

    const domainIdeas: DomainIdea[] = ideas.map((i) => ({
      id: i.id,
      title: i.title,
      domain: i.domain,
      oneLiner: i.one_liner,
      feasibilityScore: i.feasibility_score,
      noveltyScore: i.novelty_score,
      hasRating: interactions.ratings[i.id] !== undefined,
      hasNote: interactions.notes[i.id] !== undefined,
    }));

    return {
      domain,
      count,
      avgFeasibility: Math.round(avgFeasibility * 10) / 10,
      avgNovelty: Math.round(avgNovelty * 10) / 10,
      engagementPercent: Math.round(engagementPercent),
      ideas: domainIdeas,
    };
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <TerritoryMap domains={domainDataList} totalIdeas={stats.total_ideas} />
    </div>
  );
}
