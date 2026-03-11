import type { Fragment, Connection } from "./types";
import { getSasaganiData, addConnection } from "./sasagani-data";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

interface DiscoveredConnection {
  fragment_a_id: string;
  fragment_b_id: string;
  description: string;
  strength: number;
}

function buildPrompt(newFragment: Fragment, existingFragments: Fragment[]): string {
  const existing = existingFragments
    .map(f => `[${f.id}] (${f.type}) ${f.content}${f.note ? ` — note: ${f.note}` : ""}${f.extracted_content ? `\n  summary: ${f.extracted_content.slice(0, 300)}` : ""}`)
    .join("\n");

  return `You are a spider sensing vibrations on a web. A new fragment has landed on the web. Find which existing fragments it connects to — like silk threads linking two points.

New fragment:
[${newFragment.id}] (${newFragment.type}) ${newFragment.content}${newFragment.note ? ` — note: ${newFragment.note}` : ""}${newFragment.extracted_content ? `\n  summary: ${newFragment.extracted_content.slice(0, 300)}` : ""}

Existing fragments on the web:
${existing}

Rules:
- Only report connections you genuinely sense — do not force links
- Connections can be: thematic, complementary, contradictory, extending, inspiring
- strength 0.1-0.3 = faint vibration, 0.4-0.6 = clear thread, 0.7-1.0 = strong silk
- If no connections exist, return empty array

Return JSON array (no markdown fences):
[{"fragment_a_id": "new_fragment_id", "fragment_b_id": "existing_fragment_id", "description": "one sentence describing the thread between them", "strength": 0.5}]`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }
  const data: GeminiResponse = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
}

function parseConnections(raw: string): DiscoveredConnection[] {
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c: unknown): c is DiscoveredConnection =>
        typeof c === "object" && c !== null &&
        "fragment_a_id" in c && "fragment_b_id" in c &&
        "description" in c && "strength" in c
    );
  } catch {
    return [];
  }
}

export async function weave(newFragment: Fragment): Promise<Connection[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set, skipping weaving");
    return [];
  }

  const data = await getSasaganiData();
  const otherFragments = data.fragments.filter(f => f.id !== newFragment.id);
  if (otherFragments.length === 0) return [];

  const prompt = buildPrompt(newFragment, otherFragments);
  const raw = await callGemini(prompt, apiKey);
  const discovered = parseConnections(raw);

  const newConnections: Connection[] = [];
  for (const d of discovered) {
    const a = data.fragments.find(f => f.id === d.fragment_a_id);
    const b = data.fragments.find(f => f.id === d.fragment_b_id);
    if (!a || !b) continue;

    const threadIds = [...new Set([a.thread_id, b.thread_id])];
    const connection = await addConnection(
      d.fragment_a_id,
      d.fragment_b_id,
      threadIds,
      d.description,
      d.strength,
    );
    newConnections.push(connection);
  }

  return newConnections;
}
