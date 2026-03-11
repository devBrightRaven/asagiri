import { NextRequest, NextResponse } from "next/server";
import { getInteractions, saveInteractions } from "@/lib/data";

export async function GET() {
  const data = await getInteractions();
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  await saveInteractions(body);
  return NextResponse.json({ ok: true });
}
