import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import { getDailyResearch } from "@/lib/data";
import { writeFumigarasuHandoff } from "@/lib/fumigarasu-handoff.mjs";

const outputDir =
  process.env.FUMIGARASU_HANDOFF_DIR ||
  path.resolve(process.cwd(), "..", "data", "fumigarasu-handoff");

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : "";
  const ideaId = typeof body?.ideaId === "string" ? body.ideaId : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !ideaId) {
    return NextResponse.json({ error: "date and ideaId are required" }, { status: 400 });
  }

  const research = await getDailyResearch(date);
  const idea = research?.ideas.find((candidate) => candidate.id === ideaId);
  if (!idea) {
    return NextResponse.json({ error: "idea not found" }, { status: 404 });
  }

  try {
    const result = await writeFumigarasuHandoff({ idea, date, outputDir });
    return NextResponse.json({ created: result.created, filename: result.filename });
  } catch (error) {
    console.error("fumigarasu handoff failed", error);
    return NextResponse.json({ error: "could not write handoff" }, { status: 500 });
  }
}
