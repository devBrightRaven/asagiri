import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  DailyResearch,
  IdeabrowserSeed,
  IdeabrowserSeedScore,
  IdeabrowserSeedScores,
  Interactions,
  ReviewItem,
  Stats,
} from "./types";

const DATA_DIR =
  process.env.RADAR_DATA_DIR || path.resolve(process.cwd(), "..", "data");

const DEFAULT_IDEABROWSER_SEEDS_PATH = path.resolve(
  process.cwd(),
  "..",
  "data",
  "ideabrowser-seeds",
  "ideabrowser-opportunity-seeds.jsonl"
);

const IDEABROWSER_SEED_SCORES_PATH = path.resolve(
  process.cwd(),
  "..",
  "data",
  "ideabrowser-seeds",
  "ideabrowser-seed-scores.json"
);

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseIdeabrowserSeed(line: string, index: number): IdeabrowserSeed | null {
  try {
    const value = JSON.parse(line) as Record<string, unknown>;
    const title = stringValue(value.title) || "Untitled seed";
    const url = stringValue(value.url);
    const seedType = stringValue(value.seed_type) || "unknown";
    const gmailMessageId = stringValue(value.gmail_message_id);

    if (!url) return null;

    return {
      id:
        [gmailMessageId, seedType, url, title].filter(Boolean).join("|") ||
        `${index + 1}-${url}`,
      title,
      seed_type: seedType,
      asagiri_domains: stringArrayValue(value.asagiri_domains),
      email_date: stringValue(value.email_date),
      teaser: stringValue(value.teaser) || null,
      url,
      gmail_message_id: gmailMessageId,
      email_subject: stringValue(value.email_subject),
      extracted_at: stringValue(value.extracted_at),
    };
  } catch {
    return null;
  }
}

function normalizeInteractions(value: Partial<Interactions>): Interactions {
  return {
    ratings: value.ratings ?? {},
    notes: value.notes ?? {},
    statuses: value.statuses ?? {},
    idea_scores: value.idea_scores ?? {},
    connections: value.connections ?? [],
    ritual_completions: value.ritual_completions ?? [],
  };
}

async function getIdeabrowserSeedsPath(): Promise<string> {
  if (process.env.IDEABROWSER_SEEDS_PATH) return process.env.IDEABROWSER_SEEDS_PATH;

  try {
    const raw = await fs.readFile(
      path.resolve(process.cwd(), "..", "config.yaml"),
      "utf-8"
    );
    // ponytail: single scalar read; add a YAML parser if config usage grows.
    const match = raw.match(/^\s*ideabrowser_path:\s*["']?(.+?)["']?\s*$/m);
    return match?.[1] ?? DEFAULT_IDEABROWSER_SEEDS_PATH;
  } catch {
    return DEFAULT_IDEABROWSER_SEEDS_PATH;
  }
}

export async function getAllDates(): Promise<string[]> {
  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function getDailyResearch(date: string): Promise<DailyResearch | null> {
  const filePath = path.join(DATA_DIR, date, "ideas.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getAllIdeas(): Promise<{ date: string; ideas: DailyResearch["ideas"] }[]> {
  const dates = await getAllDates();
  const results = [];
  for (const d of dates) {
    const research = await getDailyResearch(d);
    if (research) {
      results.push({ date: d, ideas: research.ideas });
    }
  }
  return results;
}

export async function getIdeabrowserSeeds(): Promise<IdeabrowserSeed[]> {
  try {
    const raw = await fs.readFile(await getIdeabrowserSeedsPath(), "utf-8");
    return raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map(parseIdeabrowserSeed)
      .filter((seed): seed is IdeabrowserSeed => seed !== null);
  } catch {
    return [];
  }
}

export async function getIdeabrowserSeedScores(): Promise<IdeabrowserSeedScores> {
  try {
    const raw = await fs.readFile(IDEABROWSER_SEED_SCORES_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveIdeabrowserSeedScore(
  id: string,
  score: Omit<IdeabrowserSeedScore, "updated_at">
): Promise<IdeabrowserSeedScores> {
  const scores = await getIdeabrowserSeedScores();
  scores[id] = {
    ...score,
    updated_at: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(IDEABROWSER_SEED_SCORES_PATH), { recursive: true });
  await fs.writeFile(
    IDEABROWSER_SEED_SCORES_PATH,
    JSON.stringify(scores, null, 2),
    "utf-8"
  );
  return scores;
}

export async function getInteractions(): Promise<Interactions> {
  const filePath = path.join(DATA_DIR, "interactions.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return normalizeInteractions(JSON.parse(raw));
  } catch {
    return normalizeInteractions({});
  }
}

export async function saveInteractions(data: Interactions): Promise<void> {
  const filePath = path.join(DATA_DIR, "interactions.json");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function getReviewQueue(date: string): Promise<ReviewItem[]> {
  const filePath = path.join(DATA_DIR, "review-queue.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const queue = JSON.parse(raw);
    return queue[date] || [];
  } catch {
    return [];
  }
}

export async function computeStats(interactions: Interactions): Promise<Stats> {
  const dates = await getAllDates();
  const domainCounts: Record<string, number> = {};
  let totalIdeas = 0;

  for (const d of dates) {
    const research = await getDailyResearch(d);
    if (!research) continue;
    totalIdeas += research.ideas.length;
    for (const idea of research.ideas) {
      const domain = idea.domain;
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  }

  const completions = new Set(interactions.ritual_completions);
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    if (completions.has(ds)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return {
    current_streak: streak,
    longest_streak: Math.max(streak, 0),
    total_ideas: totalIdeas,
    total_domains: Object.keys(domainCounts).length,
    domain_counts: domainCounts,
  };
}
