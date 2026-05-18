// src/api.ts
import type { Fragment, Thread, Connection, ISasaganiAPI } from "./types";

/**
 * Raised when the API is gated by Cloudflare Access (or any 401/403)
 * and the current visitor is not allowed. Widget surfaces a
 * dedicated "owner-only" UI rather than a generic connection error.
 */
export class OwnerOnlyError extends Error {
  constructor() {
    super("Owner-only access — sign-in required");
    this.name = "OwnerOnlyError";
  }
}

export class SasaganiAPI implements ISasaganiAPI {
  private readonly baseUrl: string;
  private inboxThreadId: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        credentials: "include", // carry Cloudflare Access cookie cross-origin
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
    } catch (err) {
      // Network failure / CORS pre-flight rejection / DNS error
      throw new Error(
        err instanceof Error ? err.message : "Network request failed"
      );
    }

    // Cloudflare Access bounces unauthenticated requests with 302 -> auth page.
    // From the browser fetch perspective this is opaque-redirected or HTML-content;
    // either way the JSON parse below would fail, so detect first.
    if (res.status === 401 || res.status === 403) {
      throw new OwnerOnlyError();
    }
    if (res.redirected || res.type === "opaqueredirect") {
      throw new OwnerOnlyError();
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      // Non-JSON response — likely an auth login HTML page slipped through
      throw new OwnerOnlyError();
    }

    if (!res.ok) {
      const errMsg =
        typeof data === "object" && data !== null && "error" in data
          ? String((data as { error: unknown }).error)
          : `API error: ${res.status}`;
      throw new Error(errMsg);
    }
    return data as T;
  }

  async ensureInboxThread(): Promise<string> {
    if (this.inboxThreadId) return this.inboxThreadId;

    const threads = await this.request<Thread[]>("/api/sasagani/threads");
    const inbox = threads.find((t) => t.name === "inbox" && t.status === "active");
    if (inbox) {
      this.inboxThreadId = inbox.id;
      return inbox.id;
    }

    const newThread = await this.request<Thread>("/api/sasagani/threads", {
      method: "POST",
      body: JSON.stringify({ name: "inbox" }),
    });
    this.inboxThreadId = newThread.id;
    return newThread.id;
  }

  async addFragment(
    threadId: string,
    type: "url" | "text" | "voice",
    content: string,
    note?: string
  ): Promise<Fragment> {
    return this.request<Fragment>("/api/sasagani/fragments", {
      method: "POST",
      body: JSON.stringify({
        thread_id: threadId,
        type,
        content,
        note,
        source: "widget",
      }),
    });
  }

  async getRecentFragments(threadId: string, limit: number = 5): Promise<Fragment[]> {
    const all = await this.request<Fragment[]>(
      `/api/sasagani/fragments?thread_id=${threadId}`
    );
    return all.slice(-limit).reverse();
  }

  async getConnections(): Promise<Connection[]> {
    return this.request<Connection[]>("/api/sasagani/connections");
  }
}
