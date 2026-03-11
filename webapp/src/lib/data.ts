import { promises as fs } from "node:fs";
import path from "node:path";
import type { DailyResearch, Interactions, ReviewItem, Stats } from "./types";

const DATA_DIR = process.env.RADAR_DATA_DIR
  || path.resolve("C:/Code/asagiri/data");

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

export async function getInteractions(): Promise<Interactions> {
  const filePath = path.join(DATA_DIR, "interactions.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      ratings: {},
      notes: {},
      statuses: {},
      connections: [],
      ritual_completions: [],
    };
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
