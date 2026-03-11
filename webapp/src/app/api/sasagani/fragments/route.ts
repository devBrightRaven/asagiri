import { NextRequest, NextResponse } from "next/server";
import { addFragment, getThreadFragments } from "@/lib/sasagani-data";

export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get("thread_id");
  if (!threadId) {
    return NextResponse.json({ error: "thread_id is required" }, { status: 400 });
  }
  const fragments = await getThreadFragments(threadId);
  return NextResponse.json(fragments);
}

export async function POST(request: NextRequest) {
  try {
    const { thread_id, type, content, note } = await request.json();
    if (!thread_id || !type || !content) {
      return NextResponse.json({ error: "thread_id, type, content are required" }, { status: 400 });
    }
    if (!["url", "text", "voice"].includes(type)) {
      return NextResponse.json({ error: "type must be url, text, or voice" }, { status: 400 });
    }
    const fragment = await addFragment(thread_id, type, content.trim(), note?.trim());
    return NextResponse.json(fragment, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
