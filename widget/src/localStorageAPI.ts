// src/localStorageAPI.ts
//
// Demo backend — drops in for SasaganiAPI when the widget is loaded
// without a `data-api` attribute (or with `data-api="demo"`). All state
// lives in localStorage on the visitor's browser; nothing is sent over
// the network. Lets the showcase page run a fully interactive UI
// without exposing the real Asagiri webapp.
//
// Naive auto-connection: when a new fragment shares a word (length > 4)
// with one of the last 3 fragments in the thread, generate a synthetic
// Connection so the MiniWeb visualization has something to draw.

import type { Fragment, Thread, Connection, ISasaganiAPI } from "./types";

const STORAGE_KEY = "sasagani-demo-v1";

interface DemoState {
  threads: Thread[];
  fragments: Fragment[];
  connections: Connection[];
}

function emptyState(): DemoState {
  return { threads: [], fragments: [], connections: [] };
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      threads: Array.isArray(parsed.threads) ? parsed.threads : [],
      fragments: Array.isArray(parsed.fragments) ? parsed.fragments : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    };
  } catch {
    return emptyState();
  }
}

function saveState(state: DemoState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage disabled or full — silently fall back to volatile in-session
  }
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9一-鿿]+/u)
    .filter((w) => w.length > 4);
}

function findSharedWord(a: string, b: string): string | null {
  const seen = new Set(tokens(a));
  for (const w of tokens(b)) {
    if (seen.has(w)) return w;
  }
  return null;
}

export class LocalStorageAPI implements ISasaganiAPI {
  private inboxThreadId: string | null = null;

  async ensureInboxThread(): Promise<string> {
    if (this.inboxThreadId) return this.inboxThreadId;
    const state = loadState();
    let inbox = state.threads.find(
      (t) => t.name === "inbox" && t.status === "active"
    );
    if (!inbox) {
      inbox = {
        id: uid(),
        name: "inbox",
        status: "active",
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      const next: DemoState = {
        ...state,
        threads: [...state.threads, inbox],
      };
      saveState(next);
    }
    this.inboxThreadId = inbox.id;
    return inbox.id;
  }

  async addFragment(
    threadId: string,
    type: "url" | "text" | "voice",
    content: string,
    note?: string
  ): Promise<Fragment> {
    const state = loadState();
    const fragment: Fragment = {
      id: uid(),
      thread_id: threadId,
      type,
      content,
      note,
      created_at: nowISO(),
    };

    // Naive auto-connect: link to last 3 fragments in this thread if a
    // long-ish word overlaps. Gives MiniWeb something to draw without an
    // LLM. Pure heuristic, no semantic claim.
    const prev = state.fragments
      .filter((f) => f.thread_id === threadId)
      .slice(-3);
    const newConnections: Connection[] = [];
    for (const p of prev) {
      const shared = findSharedWord(p.content, content);
      if (shared) {
        newConnections.push({
          id: uid(),
          fragment_a: p.id,
          fragment_b: fragment.id,
          thread_ids: [threadId],
          description: `both mention "${shared}"`,
          strength: 0.5,
          created_at: nowISO(),
        });
      }
    }

    const next: DemoState = {
      ...state,
      fragments: [...state.fragments, fragment],
      connections: [...state.connections, ...newConnections],
    };
    saveState(next);
    return fragment;
  }

  async getRecentFragments(threadId: string, limit: number = 5): Promise<Fragment[]> {
    const state = loadState();
    return state.fragments
      .filter((f) => f.thread_id === threadId)
      .slice(-limit)
      .reverse();
  }

  async getConnections(): Promise<Connection[]> {
    return loadState().connections;
  }
}
