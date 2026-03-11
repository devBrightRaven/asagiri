import { NextResponse } from "next/server";
import { getInteractions, computeStats } from "@/lib/data";

export async function GET() {
  const interactions = await getInteractions();
  const stats = await computeStats(interactions);
  return NextResponse.json(stats);
}
