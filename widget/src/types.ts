// src/types.ts
export interface Fragment {
  id: string;
  thread_id: string;
  type: "url" | "text" | "voice";
  content: string;
  extracted_content?: string;
  note?: string;
  created_at: string;
}

export interface Thread {
  id: string;
  name: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  fragment_a: string;
  fragment_b: string;
  thread_ids: string[];
  description: string;
  strength: number;
  created_at: string;
}

/**
 * Shared shape between SasaganiAPI (remote, hits webapp) and
 * LocalStorageAPI (demo, browser-only). Widget consumes via this.
 */
export interface ISasaganiAPI {
  ensureInboxThread(): Promise<string>;
  addFragment(
    threadId: string,
    type: "url" | "text" | "voice",
    content: string,
    note?: string
  ): Promise<Fragment>;
  getRecentFragments(threadId: string, limit?: number): Promise<Fragment[]>;
  getConnections(): Promise<Connection[]>;
}
