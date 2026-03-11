import { NextRequest, NextResponse } from "next/server";
import { addFragment, getThreadFragments, getSasaganiData, saveSasaganiData } from "@/lib/sasagani-data";
import { extractUrlContent } from "@/lib/sasagani-extract";
import { weave } from "@/lib/sasagani-weave";

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

    // Background: URL extraction + weaving (don't block response)
    void (async () => {
      try {
        if (type === "url") {
          const extracted = await extractUrlContent(content.trim());
          const data = await getSasaganiData();
          await saveSasaganiData({
            ...data,
            fragments: data.fragments.map(f =>
              f.id === fragment.id
                ? { ...f, extracted_content: `${extracted.title}\n${extracted.summary}` }
                : f
            ),
          });
        }
        const freshData = await getSasaganiData();
        const freshFragment = freshData.fragments.find(f => f.id === fragment.id);
        if (freshFragment) {
          await weave(freshFragment);
        }
      } catch (err) {
        console.error("Background weaving error:", err);
      }
    })();

    return NextResponse.json(fragment, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
