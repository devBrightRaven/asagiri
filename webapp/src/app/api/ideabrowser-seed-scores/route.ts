import { NextRequest, NextResponse } from "next/server";
import {
  getIdeabrowserSeedScores,
  saveIdeabrowserSeedScore,
} from "@/lib/data";

function scoreValue(value: unknown): number | null {
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 1 && value <= 5 ? value : null;
}

export async function GET() {
  return NextResponse.json(await getIdeabrowserSeedScores());
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Missing seed id" }, { status: 400 });
  }

  const scores = await saveIdeabrowserSeedScore(id, {
    feasibility: scoreValue(body.feasibility),
    market: scoreValue(body.market),
  });

  return NextResponse.json({ ok: true, score: scores[id] });
}
