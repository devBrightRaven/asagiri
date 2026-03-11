import { NextRequest, NextResponse } from "next/server";
import { getActiveThreads, createThread, archiveThread } from "@/lib/sasagani-data";

export async function GET() {
  const threads = await getActiveThreads();
  return NextResponse.json(threads);
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const thread = await createThread(name.trim());
    return NextResponse.json(thread, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { thread_id, action } = await request.json();
    if (action === "archive") {
      await archiveThread(thread_id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
