import { NextRequest, NextResponse } from "next/server";
import { addFragment, getSasaganiData } from "@/lib/sasagani-data";
import { weave } from "@/lib/sasagani-weave";

export async function POST(request: NextRequest) {
  try {
    const { idea_id, idea_title, idea_one_liner, thread_id } =
      await request.json();
    if (!idea_id || !thread_id) {
      return NextResponse.json(
        { error: "idea_id and thread_id are required" },
        { status: 400 },
      );
    }

    const content = `[Asagiri Idea] ${idea_title}: ${idea_one_liner}`;
    const fragment = await addFragment(
      thread_id,
      "text",
      content,
      `from asagiri engine idea ${idea_id}`,
    );

    // Background weaving
    void (async () => {
      try {
        const data = await getSasaganiData();
        const fresh = data.fragments.find((f) => f.id === fragment.id);
        if (fresh) await weave(fresh);
      } catch (err) {
        console.error("Ingest weaving error:", err);
      }
    })();

    return NextResponse.json(fragment, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
