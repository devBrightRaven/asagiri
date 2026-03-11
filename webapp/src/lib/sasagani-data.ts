import { promises as fs } from "node:fs";
import path from "node:path";
import type { Connection, Fragment, SasaganiData, Thread } from "./types";

const DATA_DIR = process.env.RADAR_DATA_DIR
  || path.resolve("C:/Code/asagiri/data");

const SASAGANI_DIR = path.join(DATA_DIR, "sasagani");
const DATA_FILE = path.join(SASAGANI_DIR, "data.json");

const MAX_ACTIVE_THREADS = 3;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyData(): SasaganiData {
  return { threads: [], fragments: [], connections: [] };
}

export async function getSasaganiData(): Promise<SasaganiData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return emptyData();
  }
}

export async function saveSasaganiData(data: SasaganiData): Promise<void> {
  await fs.mkdir(SASAGANI_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function createThread(name: string): Promise<Thread> {
  const data = await getSasaganiData();
  const activeCount = data.threads.filter((t) => t.status === "active").length;

  if (activeCount >= MAX_ACTIVE_THREADS) {
    throw new Error(
      `Cannot create thread: already at maximum of ${MAX_ACTIVE_THREADS} active threads`,
    );
  }

  const now = new Date().toISOString();
  const thread: Thread = {
    id: generateId(),
    name,
    status: "active",
    created_at: now,
    updated_at: now,
  };

  await saveSasaganiData({
    ...data,
    threads: [...data.threads, thread],
  });

  return thread;
}

export async function archiveThread(threadId: string): Promise<void> {
  const data = await getSasaganiData();
  const now = new Date().toISOString();

  await saveSasaganiData({
    ...data,
    threads: data.threads.map((t) =>
      t.id === threadId
        ? { ...t, status: "archived" as const, updated_at: now }
        : t
    ),
  });
}

export async function addFragment(
  threadId: string,
  type: Fragment["type"],
  content: string,
  note?: string,
): Promise<Fragment> {
  const data = await getSasaganiData();
  const thread = data.threads.find((t) => t.id === threadId);

  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }
  if (thread.status !== "active") {
    throw new Error(`Thread is not active: ${threadId}`);
  }

  const now = new Date().toISOString();
  const fragment: Fragment = {
    id: generateId(),
    thread_id: threadId,
    type,
    content,
    ...(note != null ? { note } : {}),
    created_at: now,
  };

  await saveSasaganiData({
    ...data,
    fragments: [...data.fragments, fragment],
    threads: data.threads.map((t) =>
      t.id === threadId ? { ...t, updated_at: now } : t
    ),
  });

  return fragment;
}

export async function addConnection(
  fragmentA: string,
  fragmentB: string,
  threadIds: string[],
  description: string,
  strength: number,
): Promise<Connection> {
  const clampedStrength = Math.max(0, Math.min(1, strength));
  const now = new Date().toISOString();

  const connection: Connection = {
    id: generateId(),
    fragment_a: fragmentA,
    fragment_b: fragmentB,
    thread_ids: threadIds,
    description,
    strength: clampedStrength,
    created_at: now,
    updated_at: now,
  };

  const data = await getSasaganiData();
  await saveSasaganiData({
    ...data,
    connections: [...data.connections, connection],
  });

  return connection;
}

export async function getActiveThreads(): Promise<Thread[]> {
  const data = await getSasaganiData();
  return data.threads.filter((t) => t.status === "active");
}

export async function getThreadFragments(threadId: string): Promise<Fragment[]> {
  const data = await getSasaganiData();
  return data.fragments.filter((f) => f.thread_id === threadId);
}

export async function getConnectionsForThread(threadId: string): Promise<Connection[]> {
  const data = await getSasaganiData();
  return data.connections.filter((c) => c.thread_ids.includes(threadId));
}

export async function getAllConnections(): Promise<Connection[]> {
  const data = await getSasaganiData();
  return data.connections;
}
