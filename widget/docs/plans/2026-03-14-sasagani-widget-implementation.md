# Sasagani Widget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an embeddable JavaScript widget that lets users capture fragments into Sasagani's knowledge web from any webpage via a single `<script>` tag.

**Architecture:** Standalone Preact app built with Vite in library mode, outputting a single self-contained JS file. Mounts into a Shadow DOM for style isolation. Communicates with existing Sasagani API endpoints on the Asagiri webapp. Uses a dedicated "inbox" thread for zero-decision capture.

**Tech Stack:** Preact 10, Vite 6, TypeScript, Canvas 2D API, vitest for testing

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/index.tsx`

**Step 1: Create package.json**

```json
{
  "name": "sasagani-widget",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "preact": "^10.25.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.9.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0",
    "happy-dom": "^16.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": false,
    "sourceMap": false,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: "src/index.tsx",
      name: "SasaganiWidget",
      fileName: () => "sasagani.js",
      formats: ["iife"],
    },
    outDir: "dist",
    minify: "terser",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
```

**Step 4: Create minimal src/index.tsx entry point**

```tsx
// src/index.tsx
import { render, h } from "preact";

function App() {
  return h("div", null, "Sasagani Widget loaded");
}

function mount() {
  const script = document.querySelector(
    'script[src*="sasagani"]'
  ) as HTMLScriptElement | null;

  const apiBase = script?.dataset.api || "http://localhost:3000";
  const position = script?.dataset.position || "bottom-right";

  const host = document.createElement("div");
  host.id = "sasagani-widget-host";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  shadow.appendChild(container);

  render(h(App, null), container);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
```

**Step 5: Install dependencies and verify build**

Run: `cd C:/Code/asagiri/widget && pnpm install && pnpm build`
Expected: Creates `dist/sasagani.js`

**Step 6: Init git and commit**

```bash
cd C:/Code/asagiri/widget
git init
git add package.json tsconfig.json vite.config.ts src/index.tsx pnpm-lock.yaml
git commit -m "feat: scaffold sasagani widget with Preact + Vite library mode"
```

---

## Task 2: API Client

**Files:**
- Create: `src/api.ts`
- Create: `src/types.ts`
- Create: `tests/api.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SasaganiAPI } from "../src/api";

describe("SasaganiAPI", () => {
  let api: SasaganiAPI;

  beforeEach(() => {
    api = new SasaganiAPI("http://localhost:3000");
    global.fetch = vi.fn();
  });

  it("posts a text fragment", async () => {
    const mockFragment = {
      id: "123",
      thread_id: "inbox",
      type: "text",
      content: "hello",
      created_at: "2026-03-14T00:00:00",
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockFragment),
    });

    const result = await api.addFragment("inbox", "text", "hello");
    expect(result).toEqual(mockFragment);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/sasagani/fragments",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("detects URL type automatically", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: "1", type: "url" }),
    });

    await api.addFragment("inbox", "url", "https://example.com");
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.type).toBe("url");
  });

  it("fetches recent fragments", async () => {
    const mockFragments = [
      { id: "1", content: "hello", type: "text", thread_id: "inbox", created_at: "2026-03-14" },
    ];
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFragments),
    });

    const result = await api.getRecentFragments("inbox", 5);
    expect(result).toEqual(mockFragments);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/sasagani/fragments?thread_id=inbox",
      expect.any(Object)
    );
  });

  it("ensures inbox thread exists", async () => {
    const mockThreads = [{ id: "t1", name: "inbox", status: "active" }];
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockThreads),
    });

    const threadId = await api.ensureInboxThread();
    expect(threadId).toBe("t1");
  });

  it("creates inbox thread if not found", async () => {
    const emptyThreads: never[] = [];
    const newThread = { id: "new-1", name: "inbox", status: "active" };
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyThreads) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve(newThread) });

    const threadId = await api.ensureInboxThread();
    expect(threadId).toBe("new-1");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("fetches connections for web preview", async () => {
    const mockConns = [{ id: "c1", strength: 0.8 }];
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockConns),
    });

    const result = await api.getConnections();
    expect(result).toEqual(mockConns);
  });

  it("handles API errors gracefully", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "server error" }),
    });

    await expect(api.addFragment("inbox", "text", "hello")).rejects.toThrow("server error");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd C:/Code/asagiri/widget && pnpm test`
Expected: FAIL — module not found

**Step 3: Create types.ts**

```typescript
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
```

**Step 4: Implement api.ts**

```typescript
// src/api.ts
import type { Fragment, Thread, Connection } from "./types";

export class SasaganiAPI {
  private baseUrl: string;
  private inboxThreadId: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `API error: ${res.status}`);
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
```

**Step 5: Add vitest config to vite.config.ts**

Add to vite.config.ts:

```typescript
// Add to defineConfig:
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
```

**Step 6: Run tests to verify they pass**

Run: `cd C:/Code/asagiri/widget && pnpm test`
Expected: All 7 tests PASS

**Step 7: Commit**

```bash
git add src/api.ts src/types.ts tests/api.test.ts vite.config.ts
git commit -m "feat: add API client with inbox thread management"
```

---

## Task 3: Widget UI Components

**Files:**
- Create: `src/styles.ts`
- Create: `src/FragmentInput.tsx`
- Create: `src/RecentList.tsx`
- Create: `src/Widget.tsx`
- Modify: `src/index.tsx`

**Step 1: Create styles.ts (CSS-in-JS for Shadow DOM)**

```typescript
// src/styles.ts
export const WIDGET_STYLES = `
  :host {
    --sg-bg: #fafafa;
    --sg-surface: #ffffff;
    --sg-text: #1a1a1a;
    --sg-muted: #888;
    --sg-accent: #6366f1;
    --sg-accent-hover: #4f46e5;
    --sg-border: #e5e5e5;
    --sg-radius: 12px;
    --sg-shadow: 0 8px 32px rgba(0,0,0,0.12);
    font-family: system-ui, -apple-system, sans-serif;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  .sg-trigger {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--sg-accent);
    border: none;
    cursor: pointer;
    box-shadow: var(--sg-shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s, background 0.2s;
    z-index: 2147483647;
  }
  .sg-trigger:hover { transform: scale(1.08); background: var(--sg-accent-hover); }
  .sg-trigger svg { width: 24px; height: 24px; fill: white; }

  .sg-panel {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 360px;
    max-height: 480px;
    background: var(--sg-surface);
    border: 1px solid var(--sg-border);
    border-radius: var(--sg-radius);
    box-shadow: var(--sg-shadow);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 2147483647;
    animation: sg-slide-up 0.2s ease-out;
  }

  @keyframes sg-slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .sg-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--sg-border);
  }
  .sg-header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--sg-text);
  }
  .sg-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--sg-muted);
    font-size: 18px;
    padding: 4px;
    line-height: 1;
  }
  .sg-close:hover { color: var(--sg-text); }

  .sg-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .sg-input-area {
    margin-bottom: 12px;
  }
  .sg-textarea {
    width: 100%;
    min-height: 72px;
    padding: 10px 12px;
    border: 1px solid var(--sg-border);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    color: var(--sg-text);
    background: var(--sg-bg);
    resize: vertical;
    outline: none;
    transition: border-color 0.15s;
  }
  .sg-textarea:focus { border-color: var(--sg-accent); }
  .sg-textarea::placeholder { color: var(--sg-muted); }

  .sg-submit {
    margin-top: 8px;
    width: 100%;
    padding: 8px 16px;
    background: var(--sg-accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .sg-submit:hover { background: var(--sg-accent-hover); }
  .sg-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .sg-success {
    color: #16a34a;
    font-size: 13px;
    margin-top: 6px;
    text-align: center;
  }

  .sg-section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--sg-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 16px 0 8px;
  }

  .sg-recent-item {
    padding: 6px 0;
    font-size: 13px;
    color: var(--sg-text);
    border-bottom: 1px solid var(--sg-border);
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .sg-recent-item:last-child { border-bottom: none; }
  .sg-recent-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--sg-accent);
    flex-shrink: 0;
    margin-top: 5px;
  }
  .sg-recent-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sg-recent-type {
    font-size: 11px;
    color: var(--sg-muted);
    flex-shrink: 0;
  }

  .sg-web-preview {
    margin-top: 12px;
    border: 1px dashed var(--sg-border);
    border-radius: 8px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sg-web-preview canvas {
    width: 100%;
    height: 100%;
  }

  .sg-footer {
    padding: 8px 16px;
    border-top: 1px solid var(--sg-border);
    font-size: 12px;
    color: var(--sg-muted);
    text-align: center;
  }

  .sg-error {
    color: #dc2626;
    font-size: 13px;
    margin-top: 6px;
    text-align: center;
  }
`;
```

**Step 2: Create FragmentInput.tsx**

```tsx
// src/FragmentInput.tsx
import { h } from "preact";
import { useState } from "preact/hooks";

interface Props {
  onSubmit: (content: string) => Promise<void>;
  disabled: boolean;
}

export function FragmentInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    setStatus("sending");
    setErrorMsg("");
    try {
      await onSubmit(trimmed);
      setValue("");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
      setStatus("error");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  return (
    <div class="sg-input-area">
      <textarea
        class="sg-textarea"
        placeholder="Paste a URL or type anything..."
        value={value}
        onInput={(e) => setValue((e.target as HTMLTextAreaElement).value)}
        onKeyDown={handleKeyDown}
        disabled={status === "sending"}
      />
      <button
        class="sg-submit"
        onClick={handleSubmit}
        disabled={!value.trim() || status === "sending" || disabled}
      >
        {status === "sending" ? "Sending..." : "Drop it in"}
      </button>
      {status === "success" && <p class="sg-success">Captured!</p>}
      {status === "error" && <p class="sg-error">{errorMsg}</p>}
    </div>
  );
}
```

**Step 3: Create RecentList.tsx**

```tsx
// src/RecentList.tsx
import { h } from "preact";
import type { Fragment } from "./types";

interface Props {
  fragments: Fragment[];
}

export function RecentList({ fragments }: Props) {
  if (fragments.length === 0) return null;

  return (
    <div>
      <div class="sg-section-title">Recent</div>
      {fragments.map((f) => (
        <div class="sg-recent-item" key={f.id}>
          <span class="sg-recent-dot" />
          <span class="sg-recent-content">
            {f.content.length > 60 ? f.content.slice(0, 60) + "..." : f.content}
          </span>
          <span class="sg-recent-type">{f.type}</span>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Create Widget.tsx (main component)**

```tsx
// src/Widget.tsx
import { h } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import { SasaganiAPI } from "./api";
import { FragmentInput } from "./FragmentInput";
import { RecentList } from "./RecentList";
import type { Fragment } from "./types";

interface Props {
  api: SasaganiAPI;
}

const WEB_ICON = (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="2" fill="white" />
    <path d="M12 2L12 10M12 14L12 22M2 12L10 12M14 12L22 12M4.93 4.93L9.17 9.17M14.83 14.83L19.07 19.07M4.93 19.07L9.17 14.83M14.83 9.17L19.07 4.93" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.6" />
  </svg>
);

export function Widget({ api }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [inboxId, setInboxId] = useState<string | null>(null);
  const [recent, setRecent] = useState<Fragment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const threadId = await api.ensureInboxThread();
      setInboxId(threadId);
      const fragments = await api.getRecentFragments(threadId, 5);
      setRecent(fragments);
      setTotalCount(fragments.length);
      setApiError(false);
    } catch {
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isOpen && !inboxId) {
      init();
    }
  }, [isOpen, inboxId, init]);

  const handleSubmit = async (content: string) => {
    if (!inboxId) throw new Error("Not connected");

    const isUrl = /^https?:\/\//i.test(content);
    const type = isUrl ? "url" : "text";

    const fragment = await api.addFragment(inboxId, type, content);
    setRecent((prev) => [fragment, ...prev].slice(0, 5));
    setTotalCount((c) => c + 1);
  };

  return (
    <div>
      {!isOpen && (
        <button
          class="sg-trigger"
          onClick={() => setIsOpen(true)}
          aria-label="Open Sasagani capture"
        >
          {WEB_ICON}
        </button>
      )}

      {isOpen && (
        <div class="sg-panel" role="dialog" aria-label="Sasagani capture">
          <div class="sg-header">
            <span class="sg-header-title">sasagani</span>
            <button class="sg-close" onClick={() => setIsOpen(false)} aria-label="Close">
              &times;
            </button>
          </div>

          <div class="sg-body">
            {apiError ? (
              <p class="sg-error">Cannot connect to API. Is the Asagiri webapp running?</p>
            ) : (
              <>
                <FragmentInput onSubmit={handleSubmit} disabled={loading || !inboxId} />
                <RecentList fragments={recent} />
              </>
            )}
          </div>

          <div class="sg-footer">
            {totalCount > 0
              ? `${totalCount} fragment${totalCount === 1 ? "" : "s"} collected`
              : "Start capturing"}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 5: Update src/index.tsx to use Widget**

```tsx
// src/index.tsx
import { render, h } from "preact";
import { Widget } from "./Widget";
import { SasaganiAPI } from "./api";
import { WIDGET_STYLES } from "./styles";

function mount() {
  const script = document.querySelector(
    'script[src*="sasagani"]'
  ) as HTMLScriptElement | null;

  const apiBase = script?.dataset.api || "http://localhost:3000";

  const host = document.createElement("div");
  host.id = "sasagani-widget-host";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = WIDGET_STYLES;
  shadow.appendChild(styleEl);

  const container = document.createElement("div");
  shadow.appendChild(container);

  const api = new SasaganiAPI(apiBase);
  render(h(Widget, { api }), container);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
```

**Step 6: Build and verify**

Run: `cd C:/Code/asagiri/widget && pnpm build`
Expected: `dist/sasagani.js` created, under 30KB

**Step 7: Commit**

```bash
git add src/ tests/
git commit -m "feat: add widget UI with fragment input, recent list, and Shadow DOM isolation"
```

---

## Task 4: CORS Middleware for Webapp

**Files:**
- Create: `C:/Code/asagiri/webapp/src/middleware.ts`

**Step 1: Create CORS middleware**

```typescript
// C:/Code/asagiri/webapp/src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Only apply CORS to sasagani API routes
  if (!request.nextUrl.pathname.startsWith("/api/sasagani")) {
    return NextResponse.next();
  }

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Add CORS headers to response
  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export const config = {
  matcher: "/api/sasagani/:path*",
};
```

**Step 2: Verify webapp still starts**

Run: `cd C:/Code/asagiri/webapp && pnpm dev`
Expected: No errors, CORS headers present on sasagani API responses

**Step 3: Commit**

```bash
cd C:/Code/asagiri/webapp
git add src/middleware.ts
git commit -m "feat: add CORS middleware for sasagani API (widget support)"
```

---

## Task 5: Widget Serving + Test Page

**Files:**
- Create: `C:/Code/asagiri/widget/test.html`
- Modify: `C:/Code/asagiri/webapp/next.config.ts` (optional — or just copy dist/sasagani.js to public/)

**Step 1: Create test.html for standalone testing**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sasagani Widget Test</title>
    <style>
        body { font-family: system-ui; padding: 2rem; max-width: 800px; margin: 0 auto; }
        h1 { margin-bottom: 1rem; }
        p { color: #666; line-height: 1.6; }
    </style>
</head>
<body>
    <h1>Sasagani Widget Test Page</h1>
    <p>This page demonstrates the embeddable Sasagani widget. Look for the floating button in the bottom-right corner.</p>
    <p>The widget connects to the Asagiri webapp API at localhost:3000. Make sure the webapp is running.</p>
    <p>Try pasting a URL or typing some text, then click "Drop it in".</p>

    <script src="./dist/sasagani.js" data-api="http://localhost:3000"></script>
</body>
</html>
```

**Step 2: Build widget and open test page**

Run: `cd C:/Code/asagiri/widget && pnpm build && start "" test.html`

**Step 3: Manual verification checklist**

- [ ] Floating button visible in bottom-right
- [ ] Click opens panel with input field
- [ ] Type text + click "Drop it in" → "Captured!" message
- [ ] Recent list shows the fragment
- [ ] Paste URL → auto-detected as URL type
- [ ] Close button works
- [ ] Panel has slide-up animation
- [ ] Styles don't leak to host page

**Step 4: Copy widget to webapp public dir for serving**

```bash
mkdir -p C:/Code/asagiri/webapp/public/widget
cp C:/Code/asagiri/widget/dist/sasagani.js C:/Code/asagiri/webapp/public/widget/
```

**Step 5: Commit**

```bash
cd C:/Code/asagiri/widget
git add test.html
git commit -m "feat: add test page and build widget for serving"

cd C:/Code/asagiri/webapp
git add public/widget/sasagani.js
git commit -m "feat: serve sasagani widget from webapp public dir"
```

---

## Task 6: Mini Web Preview (Canvas)

**Files:**
- Create: `src/MiniWeb.tsx`
- Modify: `src/Widget.tsx` (add MiniWeb)
- Create: `tests/MiniWeb.test.ts`

**Step 1: Write failing test**

```typescript
// tests/MiniWeb.test.ts
import { describe, it, expect } from "vitest";
import { computeWebLayout } from "../src/MiniWeb";

describe("computeWebLayout", () => {
  it("positions nodes in a circle", () => {
    const nodes = computeWebLayout(
      [
        { id: "1", label: "A" },
        { id: "2", label: "B" },
        { id: "3", label: "C" },
      ],
      300,
      120
    );
    expect(nodes).toHaveLength(3);
    expect(nodes[0].x).toBeGreaterThan(0);
    expect(nodes[0].y).toBeGreaterThan(0);
  });

  it("returns empty array for no nodes", () => {
    const nodes = computeWebLayout([], 300, 120);
    expect(nodes).toEqual([]);
  });
});
```

**Step 2: Implement MiniWeb.tsx**

```tsx
// src/MiniWeb.tsx
import { h } from "preact";
import { useRef, useEffect } from "preact/hooks";
import type { Fragment, Connection } from "./types";

interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export function computeWebLayout(
  items: { id: string; label: string }[],
  width: number,
  height: number
): LayoutNode[] {
  if (items.length === 0) return [];
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) * 0.7;

  return items.map((item, i) => {
    const angle = (2 * Math.PI * i) / items.length - Math.PI / 2;
    return {
      ...item,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

interface Props {
  fragments: Fragment[];
  connections: Connection[];
  width?: number;
  height?: number;
}

export function MiniWeb({ fragments, connections, width = 300, height = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width * 2; // retina
    canvas.height = height * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, width, height);

    const items = fragments.slice(-12).map((f) => ({
      id: f.id,
      label: f.content.slice(0, 20),
    }));
    const nodes = computeWebLayout(items, width, height);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Draw connections
    ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
    ctx.lineWidth = 1;
    for (const conn of connections) {
      const a = nodeMap.get(conn.fragment_a);
      const b = nodeMap.get(conn.fragment_b);
      if (a && b) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#6366f1";
      ctx.fill();
    }

    // Center dot
    if (nodes.length > 0) {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(99, 102, 241, 0.4)";
      ctx.fill();

      // Draw radial lines to center
      ctx.strokeStyle = "rgba(99, 102, 241, 0.1)";
      for (const node of nodes) {
        ctx.beginPath();
        ctx.moveTo(width / 2, height / 2);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
      }
    }
  }, [fragments, connections, width, height]);

  return (
    <div class="sg-web-preview">
      <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px` }} />
    </div>
  );
}
```

**Step 3: Add MiniWeb to Widget.tsx**

In Widget.tsx, add import and state:

```tsx
import { MiniWeb } from "./MiniWeb";
import type { Fragment, Connection } from "./types";

// Add to Widget state:
const [connections, setConnections] = useState<Connection[]>([]);

// In init(), after fetching recent:
const conns = await api.getConnections();
setConnections(conns);

// In JSX, after RecentList:
{recent.length > 0 && (
  <MiniWeb fragments={recent} connections={connections} />
)}
```

**Step 4: Run tests**

Run: `cd C:/Code/asagiri/widget && pnpm test`
Expected: All tests PASS

**Step 5: Build and verify visually**

Run: `cd C:/Code/asagiri/widget && pnpm build && start "" test.html`

**Step 6: Commit**

```bash
git add src/MiniWeb.tsx tests/MiniWeb.test.ts src/Widget.tsx
git commit -m "feat: add mini spider web canvas preview"
```

---

## Execution Order

```
Task 1  (scaffold)                   ~10 min
Task 2  (API client)                 ~15 min
Task 3  (UI components)              ~25 min
Task 4  (CORS middleware)            ~5 min
Task 5  (test page + serving)        ~10 min
Task 6  (mini web preview)           ~15 min
                                     ─────────
                                     ~1.5 hours
```

Tasks are sequential — each builds on the previous.
