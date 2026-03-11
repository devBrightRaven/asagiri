import { NextRequest, NextResponse } from "next/server";
import { getConnectionsForThread, getAllConnections } from "@/lib/sasagani-data";

export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get("thread_id");
  if (threadId) {
    const connections = await getConnectionsForThread(threadId);
    return NextResponse.json(connections);
  }
  const connections = await getAllConnections();
  return NextResponse.json(connections);
}
