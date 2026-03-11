export interface Idea {
  id: string;
  title: string;
  domain: string;
  one_liner: string;
  problem: string;
  solution: string;
  market_size: string;
  competitors: string[];
  moat_analysis: string;
  feasibility_score: number;
  novelty_score: number;
  sources: string[];
  tags: string[];
  created_at: string;
  user_rating: number | null;
  user_note: string | null;
  review_dates: string[];
  status: "new" | "interested" | "researching" | "passed" | "executing";
}

export interface DailyResearch {
  date: string;
  ideas: Idea[];
  domains_covered: string[];
  strategy_used: string;
}

export interface Interactions {
  ratings: Record<string, number>;
  notes: Record<string, string>;
  statuses: Record<string, Idea["status"]>;
  connections: ConnectionEntry[];
  ritual_completions: string[];
}

export interface ConnectionEntry {
  date: string;
  idea_a: string;
  idea_b: string;
  connection: string;
}

export interface ReviewItem {
  id: string;
  title: string;
  domain: string;
}

export interface Stats {
  current_streak: number;
  longest_streak: number;
  total_ideas: number;
  total_domains: number;
  domain_counts: Record<string, number>;
}
