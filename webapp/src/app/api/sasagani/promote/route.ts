import { NextRequest, NextResponse } from "next/server";
import { getSasaganiData } from "@/lib/sasagani-data";
import type { Idea } from "@/lib/types";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(request: NextRequest) {
  try {
    const { fragment_ids } = await request.json();
    if (!Array.isArray(fragment_ids) || fragment_ids.length === 0) {
      return NextResponse.json({ error: "fragment_ids is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
    }

    const data = await getSasaganiData();
    const fragments = data.fragments.filter(f => fragment_ids.includes(f.id));
    const connections = data.connections.filter(
      c => fragment_ids.includes(c.fragment_a) || fragment_ids.includes(c.fragment_b)
    );

    const fragmentsText = fragments
      .map(f => `- (${f.type}) ${f.content}${f.note ? ` [note: ${f.note}]` : ""}${f.extracted_content ? `\n  ${f.extracted_content.slice(0, 500)}` : ""}`)
      .join("\n");

    const connectionsText = connections
      .map(c => `- ${c.description} (strength: ${c.strength})`)
      .join("\n");

    const prompt = `Based on the following fragments and their connections, generate a startup idea.

Fragments:
${fragmentsText}

Connections:
${connectionsText || "(none)"}

Generate JSON (no markdown fences):
{
  "title": "Startup idea title",
  "domain": "Domain (choose from: AI/ML, Developer Tools, Gaming, FinTech, Health Tech, Education, Creator Economy, Hardware/IoT, Sustainability, B2B SaaS, Consumer Apps, Marketplace, Logistics, Legal Tech, Real Estate Tech)",
  "one_liner": "One sentence pitch",
  "problem": "2-3 paragraphs with data",
  "solution": "2-3 paragraphs",
  "market_size": "TAM/SAM/SOM estimate",
  "competitors": ["Competitor1", "Competitor2", "Competitor3"],
  "moat_analysis": "Moat analysis",
  "feasibility_score": 3,
  "novelty_score": 4,
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `LLM API error: ${response.status}` }, { status: 502 });
    }

    const result = await response.json();
    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const draft = JSON.parse(cleaned);

    const today = new Date().toISOString().split("T")[0];
    const idea: Partial<Idea> = {
      id: `${today}-sasagani-${Date.now().toString(36)}`,
      title: draft.title ?? "Untitled",
      domain: draft.domain ?? "AI/ML",
      one_liner: draft.one_liner ?? "",
      problem: draft.problem ?? "",
      solution: draft.solution ?? "",
      market_size: draft.market_size ?? "",
      competitors: draft.competitors ?? [],
      moat_analysis: draft.moat_analysis ?? "",
      feasibility_score: draft.feasibility_score ?? 3,
      novelty_score: draft.novelty_score ?? 3,
      sources: fragments.filter(f => f.type === "url").map(f => f.content),
      tags: [...(draft.tags ?? []), "sasagani"],
      created_at: new Date().toISOString(),
      status: "new",
    };

    return NextResponse.json({ draft: idea, source_fragments: fragment_ids });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
