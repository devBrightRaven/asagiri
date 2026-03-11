# Sasagani（ささがに）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a minimal-friction idea fermentation system as a new module in asagiri — users throw in fragments (URLs, text, voice notes), the system finds connections between them, and mature clusters can be promoted to asagiri ideas.

**Architecture:** New `/sasagani` page in the existing Next.js webapp + API routes + file-based JSON storage (consistent with existing patterns). AI fermentation runs server-side on fragment submission. Browser extension is a thin input layer calling the same API.

**Tech Stack:** Next.js 16 + React 19 + D3.js (force graph) + Framer Motion + Tailwind v4 + shadcn/ui. AI via existing LLM config (Gemini/Claude). Chrome Extension Manifest V3.

---

## Task 1: Sasagani 型別定義

**Files:**
- Modify: `webapp/src/lib/types.ts`

**Step 1: 在 types.ts 末尾新增 Sasagani 型別**

```typescript
// === Sasagani（ささがに）Types ===

export interface Fragment {
  id: string;
  thread_id: string;
  type: "url" | "text" | "voice";
  content: string;           // 原始輸入（URL 或文字）
  extracted_content?: string; // URL 擷取後的內容摘要
  note?: string;              // 使用者附註
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
  thread_ids: string[];       // 涉及的線
  description: string;        // AI 描述的關聯
  strength: number;           // 0-1, 越高越強
  created_at: string;
  updated_at: string;
}

export interface SasaganiData {
  threads: Thread[];
  fragments: Fragment[];
  connections: Connection[];
}
```

**Step 2: Commit**

```bash
git add webapp/src/lib/types.ts
git commit -m "feat(sasagani): add type definitions for threads, fragments, connections"
```

---

## Task 2: 資料存取層

**Files:**
- Create: `webapp/src/lib/sasagani-data.ts`

**Step 1: 建立 sasagani-data.ts**

```typescript
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SasaganiData, Thread, Fragment, Connection } from "./types";

const DATA_DIR = process.env.RADAR_DATA_DIR
  || path.resolve("C:/Code/asagiri/data");
const SASAGANI_DIR = path.join(DATA_DIR, "sasagani");
const DATA_FILE = path.join(SASAGANI_DIR, "data.json");

async function ensureDir(): Promise<void> {
  await fs.mkdir(SASAGANI_DIR, { recursive: true });
}

export async function getSasaganiData(): Promise<SasaganiData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { threads: [], fragments: [], connections: [] };
  }
}

export async function saveSasaganiData(data: SasaganiData): Promise<void> {
  await ensureDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createThread(name: string): Promise<Thread> {
  const data = await getSasaganiData();
  const activeCount = data.threads.filter(t => t.status === "active").length;
  if (activeCount >= 3) {
    throw new Error("已達到 3 條活躍線的上限。請先歸檔一條線。");
  }
  const now = new Date().toISOString();
  const thread: Thread = {
    id: generateId(),
    name,
    status: "active",
    created_at: now,
    updated_at: now,
  };
  const updated: SasaganiData = {
    ...data,
    threads: [...data.threads, thread],
  };
  await saveSasaganiData(updated);
  return thread;
}

export async function archiveThread(threadId: string): Promise<void> {
  const data = await getSasaganiData();
  const updated: SasaganiData = {
    ...data,
    threads: data.threads.map(t =>
      t.id === threadId
        ? { ...t, status: "archived" as const, updated_at: new Date().toISOString() }
        : t
    ),
  };
  await saveSasaganiData(updated);
}

export async function addFragment(
  threadId: string,
  type: Fragment["type"],
  content: string,
  note?: string,
): Promise<Fragment> {
  const data = await getSasaganiData();
  const thread = data.threads.find(t => t.id === threadId);
  if (!thread || thread.status !== "active") {
    throw new Error("線不存在或已歸檔");
  }
  const fragment: Fragment = {
    id: generateId(),
    thread_id: threadId,
    type,
    content,
    note,
    created_at: new Date().toISOString(),
  };
  const updated: SasaganiData = {
    ...data,
    fragments: [...data.fragments, fragment],
    threads: data.threads.map(t =>
      t.id === threadId
        ? { ...t, updated_at: new Date().toISOString() }
        : t
    ),
  };
  await saveSasaganiData(updated);
  return fragment;
}

export async function addConnection(
  fragmentA: string,
  fragmentB: string,
  threadIds: string[],
  description: string,
  strength: number,
): Promise<Connection> {
  const data = await getSasaganiData();
  const connection: Connection = {
    id: generateId(),
    fragment_a: fragmentA,
    fragment_b: fragmentB,
    thread_ids: threadIds,
    description,
    strength: Math.max(0, Math.min(1, strength)),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const updated: SasaganiData = {
    ...data,
    connections: [...data.connections, connection],
  };
  await saveSasaganiData(updated);
  return connection;
}

export async function getActiveThreads(): Promise<Thread[]> {
  const data = await getSasaganiData();
  return data.threads.filter(t => t.status === "active");
}

export async function getThreadFragments(threadId: string): Promise<Fragment[]> {
  const data = await getSasaganiData();
  return data.fragments.filter(f => f.thread_id === threadId);
}

export async function getConnectionsForThread(threadId: string): Promise<Connection[]> {
  const data = await getSasaganiData();
  return data.connections.filter(c => c.thread_ids.includes(threadId));
}

export async function getAllConnections(): Promise<Connection[]> {
  const data = await getSasaganiData();
  return data.connections;
}
```

**Step 2: Commit**

```bash
git add webapp/src/lib/sasagani-data.ts
git commit -m "feat(sasagani): add file-based data access layer"
```

---

## Task 3: API Routes — 線管理

**Files:**
- Create: `webapp/src/app/api/sasagani/threads/route.ts`

**Step 1: 建立 threads API route**

```typescript
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
      return NextResponse.json({ error: "name 為必填" }, { status: 400 });
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
    return NextResponse.json({ error: "未知的 action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

**Step 2: Commit**

```bash
git add webapp/src/app/api/sasagani/threads/route.ts
git commit -m "feat(sasagani): add threads API route (CRUD)"
```

---

## Task 4: API Routes — 碎片輸入

**Files:**
- Create: `webapp/src/app/api/sasagani/fragments/route.ts`

**Step 1: 建立 fragments API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { addFragment, getThreadFragments } from "@/lib/sasagani-data";

export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get("thread_id");
  if (!threadId) {
    return NextResponse.json({ error: "thread_id 為必填" }, { status: 400 });
  }
  const fragments = await getThreadFragments(threadId);
  return NextResponse.json(fragments);
}

export async function POST(request: NextRequest) {
  try {
    const { thread_id, type, content, note } = await request.json();
    if (!thread_id || !type || !content) {
      return NextResponse.json(
        { error: "thread_id, type, content 為必填" },
        { status: 400 },
      );
    }
    if (!["url", "text", "voice"].includes(type)) {
      return NextResponse.json(
        { error: "type 必須是 url, text, 或 voice" },
        { status: 400 },
      );
    }
    const fragment = await addFragment(thread_id, type, content.trim(), note?.trim());
    return NextResponse.json(fragment, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

**Step 2: Commit**

```bash
git add webapp/src/app/api/sasagani/fragments/route.ts
git commit -m "feat(sasagani): add fragments API route"
```

---

## Task 5: API Routes — 連結查詢

**Files:**
- Create: `webapp/src/app/api/sasagani/connections/route.ts`

**Step 1: 建立 connections API route**

```typescript
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
```

**Step 2: Commit**

```bash
git add webapp/src/app/api/sasagani/connections/route.ts
git commit -m "feat(sasagani): add connections API route"
```

---

## Task 6: URL 內容擷取工具

**Files:**
- Create: `webapp/src/lib/sasagani-extract.ts`

**Step 1: 建立內容擷取模組**

處理三種來源：一般網頁、GitHub repo、YouTube 影片。使用 server-side fetch + 簡易 HTML 解析。

```typescript
export interface ExtractedContent {
  title: string;
  summary: string;
  source_type: "webpage" | "github" | "youtube" | "unknown";
}

function isGitHubUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?github\.com\//.test(url);
}

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "Untitled";
}

export async function extractUrlContent(url: string): Promise<ExtractedContent> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Asagiri-Sasagani/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return { title: url, summary: `無法擷取（HTTP ${response.status}）`, source_type: "unknown" };
    }
    const html = await response.text();
    const title = extractTitle(html);
    const text = stripHtml(html);
    const summary = text.slice(0, 2000);

    let source_type: ExtractedContent["source_type"] = "webpage";
    if (isGitHubUrl(url)) source_type = "github";
    else if (isYouTubeUrl(url)) source_type = "youtube";

    return { title, summary, source_type };
  } catch {
    return { title: url, summary: "擷取失敗", source_type: "unknown" };
  }
}
```

**Step 2: Commit**

```bash
git add webapp/src/lib/sasagani-extract.ts
git commit -m "feat(sasagani): add URL content extraction utility"
```

---

## Task 7: AI 發酵引擎

**Files:**
- Create: `webapp/src/lib/sasagani-ferment.ts`

**Step 1: 建立發酵引擎**

每次新增碎片時呼叫，掃描所有碎片尋找新連結。使用 Gemini Flash（快、便宜）。

```typescript
import type { Fragment, Connection } from "./types";
import { getSasaganiData, addConnection } from "./sasagani-data";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

interface DiscoveredConnection {
  fragment_a_id: string;
  fragment_b_id: string;
  description: string;
  strength: number;
}

function buildPrompt(newFragment: Fragment, existingFragments: Fragment[]): string {
  const existing = existingFragments
    .map(f => `[${f.id}] (${f.type}) ${f.content}${f.note ? ` — 註: ${f.note}` : ""}${f.extracted_content ? `\n  摘要: ${f.extracted_content.slice(0, 300)}` : ""}`)
    .join("\n");

  return `你是一個靈感連結探測器。使用者丟了一個新的碎片進來，請找出它跟既有碎片之間的潛在關聯。

新碎片:
[${newFragment.id}] (${newFragment.type}) ${newFragment.content}${newFragment.note ? ` — 註: ${newFragment.note}` : ""}${newFragment.extracted_content ? `\n  摘要: ${newFragment.extracted_content.slice(0, 300)}` : ""}

既有碎片:
${existing}

規則:
- 只回報你真的覺得有關聯的配對，不要硬湊
- 關聯可以是主題相關、互補、矛盾、延伸、靈感觸發
- strength 0.1-0.3 = 微弱直覺, 0.4-0.6 = 明確相關, 0.7-1.0 = 強烈連結
- 如果沒有任何關聯，回傳空陣列

回傳 JSON 陣列（不要包含 markdown 標記）:
[{"fragment_a_id": "新碎片id", "fragment_b_id": "既有碎片id", "description": "一句話描述關聯", "strength": 0.5}]`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }
  const data: GeminiResponse = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
}

function parseConnections(raw: string): DiscoveredConnection[] {
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c: unknown): c is DiscoveredConnection =>
        typeof c === "object" && c !== null &&
        "fragment_a_id" in c && "fragment_b_id" in c &&
        "description" in c && "strength" in c
    );
  } catch {
    return [];
  }
}

export async function ferment(newFragment: Fragment): Promise<Connection[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set, skipping fermentation");
    return [];
  }

  const data = await getSasaganiData();
  const otherFragments = data.fragments.filter(f => f.id !== newFragment.id);
  if (otherFragments.length === 0) return [];

  const prompt = buildPrompt(newFragment, otherFragments);
  const raw = await callGemini(prompt, apiKey);
  const discovered = parseConnections(raw);

  const newConnections: Connection[] = [];
  for (const d of discovered) {
    // 確認碎片存在
    const a = data.fragments.find(f => f.id === d.fragment_a_id);
    const b = data.fragments.find(f => f.id === d.fragment_b_id);
    if (!a || !b) continue;

    // 收集涉及的線
    const threadIds = [...new Set([a.thread_id, b.thread_id])];

    const connection = await addConnection(
      d.fragment_a_id,
      d.fragment_b_id,
      threadIds,
      d.description,
      d.strength,
    );
    newConnections.push(connection);
  }

  return newConnections;
}
```

**Step 2: Commit**

```bash
git add webapp/src/lib/sasagani-ferment.ts
git commit -m "feat(sasagani): add AI fermentation engine using Gemini Flash"
```

---

## Task 8: 整合發酵到 Fragment API

**Files:**
- Modify: `webapp/src/app/api/sasagani/fragments/route.ts`

**Step 1: 在 POST handler 中加入發酵觸發和 URL 擷取**

在 `addFragment` 之後，非同步觸發 `extractUrlContent`（如果是 URL）和 `ferment`。回應不等待發酵完成。

```typescript
import { NextRequest, NextResponse } from "next/server";
import { addFragment, getThreadFragments, getSasaganiData, saveSasaganiData } from "@/lib/sasagani-data";
import { extractUrlContent } from "@/lib/sasagani-extract";
import { ferment } from "@/lib/sasagani-ferment";

export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get("thread_id");
  if (!threadId) {
    return NextResponse.json({ error: "thread_id 為必填" }, { status: 400 });
  }
  const fragments = await getThreadFragments(threadId);
  return NextResponse.json(fragments);
}

export async function POST(request: NextRequest) {
  try {
    const { thread_id, type, content, note } = await request.json();
    if (!thread_id || !type || !content) {
      return NextResponse.json(
        { error: "thread_id, type, content 為必填" },
        { status: 400 },
      );
    }
    if (!["url", "text", "voice"].includes(type)) {
      return NextResponse.json(
        { error: "type 必須是 url, text, 或 voice" },
        { status: 400 },
      );
    }
    const fragment = await addFragment(thread_id, type, content.trim(), note?.trim());

    // 背景處理：URL 擷取 + 發酵（不阻塞回應）
    const backgroundWork = async () => {
      try {
        if (type === "url") {
          const extracted = await extractUrlContent(content.trim());
          const data = await getSasaganiData();
          const updated = {
            ...data,
            fragments: data.fragments.map(f =>
              f.id === fragment.id
                ? { ...f, extracted_content: `${extracted.title}\n${extracted.summary}` }
                : f
            ),
          };
          await saveSasaganiData(updated);
        }
        // 觸發發酵
        const freshData = await getSasaganiData();
        const freshFragment = freshData.fragments.find(f => f.id === fragment.id);
        if (freshFragment) {
          await ferment(freshFragment);
        }
      } catch (err) {
        console.error("Background fermentation error:", err);
      }
    };
    // 不 await，讓背景執行
    void backgroundWork();

    return NextResponse.json(fragment, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

**Step 2: Commit**

```bash
git add webapp/src/app/api/sasagani/fragments/route.ts
git commit -m "feat(sasagani): integrate URL extraction and AI fermentation on fragment creation"
```

---

## Task 9: 推進為 Asagiri Idea

**Files:**
- Create: `webapp/src/app/api/sasagani/promote/route.ts`

**Step 1: 建立 promote API route**

把一組碎片和連結打包，用 LLM 產生 asagiri idea 格式的草稿。

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSasaganiData } from "@/lib/sasagani-data";
import type { Idea } from "@/lib/types";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(request: NextRequest) {
  try {
    const { fragment_ids } = await request.json();
    if (!Array.isArray(fragment_ids) || fragment_ids.length === 0) {
      return NextResponse.json({ error: "fragment_ids 為必填" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY 未設定" }, { status: 500 });
    }

    const data = await getSasaganiData();
    const fragments = data.fragments.filter(f => fragment_ids.includes(f.id));
    const connections = data.connections.filter(
      c => fragment_ids.includes(c.fragment_a) || fragment_ids.includes(c.fragment_b)
    );

    const fragmentsText = fragments
      .map(f => `- (${f.type}) ${f.content}${f.note ? ` [註: ${f.note}]` : ""}${f.extracted_content ? `\n  ${f.extracted_content.slice(0, 500)}` : ""}`)
      .join("\n");

    const connectionsText = connections
      .map(c => `- ${c.description} (強度: ${c.strength})`)
      .join("\n");

    const prompt = `根據以下碎片和它們之間的連結，產生一個創業 idea。

碎片:
${fragmentsText}

連結:
${connectionsText || "（無）"}

請產生以下 JSON 格式（不要包含 markdown 標記）:
{
  "title": "創業點子標題",
  "domain": "領域（從以下選擇: AI/ML, Developer Tools, Gaming, FinTech, Health Tech, Education, Creator Economy, Hardware/IoT, Sustainability, B2B SaaS, Consumer Apps, Marketplace, Logistics, Legal Tech, Real Estate Tech）",
  "one_liner": "一句話描述",
  "problem": "2-3 段問題描述（含數據）",
  "solution": "2-3 段解法描述",
  "market_size": "TAM/SAM/SOM 估計",
  "competitors": ["競爭者1", "競爭者2", "競爭者3"],
  "moat_analysis": "護城河分析",
  "feasibility_score": 3,
  "novelty_score": 4,
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `LLM API error: ${response.status}` }, { status: 502 });
    }

    const result = await response.json();
    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const draft = JSON.parse(cleaned);

    // 補齊 asagiri idea 欄位
    const today = new Date().toISOString().split("T")[0];
    const idea: Partial<Idea> = {
      id: `${today}-sasagani-${Date.now().toString(36)}`,
      title: draft.title ?? "Untitled",
      domain: draft.domain ?? "AI/ML",
      one_liner: draft.one_liner ?? "",
      problem: draft.problem ?? "",
      solution: draft.solution ?? "",
      market_size: draft.market_size ?? "",
      competitors: draft.competitors ?? [],
      moat_analysis: draft.moat_analysis ?? "",
      feasibility_score: draft.feasibility_score ?? 3,
      novelty_score: draft.novelty_score ?? 3,
      sources: fragments.filter(f => f.type === "url").map(f => f.content),
      tags: [...(draft.tags ?? []), "sasagani"],
      created_at: new Date().toISOString(),
      status: "new",
    };

    // 回傳草稿，不直接寫入 — 讓使用者確認/修改
    return NextResponse.json({ draft: idea, source_fragments: fragment_ids });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add webapp/src/app/api/sasagani/promote/route.ts
git commit -m "feat(sasagani): add promote API to generate asagiri idea draft from fragments"
```

---

## Task 10: Sasagani 主頁面 — 三條線面板

**Files:**
- Create: `webapp/src/app/sasagani/page.tsx`

**Step 1: 建立 /sasagani 頁面**

顯示三條線的狀態，每條線的碎片列表，以及新增碎片的輸入框。

```typescript
import { getSasaganiData } from "@/lib/sasagani-data";
import { SasaganiDashboard } from "@/components/sasagani/SasaganiDashboard";

export const metadata = {
  title: "Sasagani — Asagiri",
  description: "靈感發酵槽",
};

export const dynamic = "force-dynamic";

export default async function SasaganiPage() {
  const data = await getSasaganiData();
  return <SasaganiDashboard initialData={data} />;
}
```

**Step 2: Commit**

```bash
git add webapp/src/app/sasagani/page.tsx
git commit -m "feat(sasagani): add sasagani page with server-side data loading"
```

---

## Task 11: SasaganiDashboard 元件

**Files:**
- Create: `webapp/src/components/sasagani/SasaganiDashboard.tsx`

**Step 1: 建立主 dashboard 元件**

管理三條線、碎片輸入、連結顯示的客戶端元件。

```typescript
"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SasaganiData, Thread, Fragment } from "@/lib/types";
import { ThreadPanel } from "./ThreadPanel";
import { FragmentInput } from "./FragmentInput";
import { ConnectionList } from "./ConnectionList";
import { Plus } from "lucide-react";

interface Props {
  initialData: SasaganiData;
}

export function SasaganiDashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const activeThreads = data.threads.filter(t => t.status === "active");

  const refreshData = useCallback(async () => {
    const res = await fetch("/api/sasagani/threads");
    if (!res.ok) return;
    // 重新載入完整資料
    const [threadsRes, ...fragResults] = await Promise.all([
      fetch("/api/sasagani/threads"),
      ...activeThreads.map(t =>
        fetch(`/api/sasagani/fragments?thread_id=${t.id}`)
      ),
    ]);
    // 簡化：直接重新整理頁面
    window.location.reload();
  }, [activeThreads]);

  const handleCreateThread = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/sasagani/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      setCreating(false);
      await refreshData();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const handleArchive = async (threadId: string) => {
    const res = await fetch("/api/sasagani/threads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, action: "archive" }),
    });
    if (res.ok) await refreshData();
  };

  const handleAddFragment = async (
    threadId: string,
    type: Fragment["type"],
    content: string,
    note?: string,
  ) => {
    const res = await fetch("/api/sasagani/fragments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, type, content, note }),
    });
    if (res.ok) {
      // 延遲重新整理，讓背景發酵有時間執行
      setTimeout(() => refreshData(), 2000);
    }
  };

  const crossThreadConnections = data.connections.filter(
    c => c.thread_ids.length > 1
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ささがに</h1>
          <p className="text-muted-foreground mt-1">靈感發酵槽</p>
        </div>
        {activeThreads.length < 3 && (
          <div>
            {creating ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreateThread()}
                  placeholder="新的線名稱..."
                  className="bg-background border-border rounded-md border px-3 py-2 text-sm"
                  autoFocus
                  aria-label="新的線名稱"
                />
                <button
                  onClick={handleCreateThread}
                  className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
                >
                  建立
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="text-muted-foreground text-sm"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="border-border hover:bg-accent flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                aria-label="新增一條線"
              >
                <Plus className="h-4 w-4" />
                新增線（{activeThreads.length}/3）
              </button>
            )}
          </div>
        )}
      </div>

      {/* 三條線面板 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {activeThreads.map(thread => (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
            >
              <ThreadPanel
                thread={thread}
                fragments={data.fragments.filter(f => f.thread_id === thread.id)}
                connections={data.connections.filter(c =>
                  c.thread_ids.includes(thread.id)
                )}
                onArchive={() => handleArchive(thread.id)}
                onAddFragment={(type, content, note) =>
                  handleAddFragment(thread.id, type, content, note)
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 跨線連結 */}
      {crossThreadConnections.length > 0 && (
        <section className="mt-12" aria-label="跨線連結">
          <h2 className="text-xl font-semibold mb-4">跨線菌絲</h2>
          <ConnectionList
            connections={crossThreadConnections}
            fragments={data.fragments}
          />
        </section>
      )}
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add webapp/src/components/sasagani/SasaganiDashboard.tsx
git commit -m "feat(sasagani): add main dashboard component with thread management"
```

---

## Task 12: ThreadPanel 元件

**Files:**
- Create: `webapp/src/components/sasagani/ThreadPanel.tsx`

**Step 1: 建立單條線面板元件**

```typescript
"use client";

import { useState } from "react";
import type { Thread, Fragment, Connection } from "@/lib/types";
import { FragmentInput } from "./FragmentInput";
import { FragmentCard } from "./FragmentCard";
import { ConnectionList } from "./ConnectionList";
import { Archive, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  thread: Thread;
  fragments: Fragment[];
  connections: Connection[];
  onArchive: () => void;
  onAddFragment: (type: Fragment["type"], content: string, note?: string) => void;
}

export function ThreadPanel({ thread, fragments, connections, onArchive, onAddFragment }: Props) {
  const [expanded, setExpanded] = useState(true);

  const intraConnections = connections.filter(
    c => c.thread_ids.length === 1
  );

  return (
    <div className="bg-card border-border rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-left"
          aria-expanded={expanded}
          aria-label={`${thread.name} — ${expanded ? "收合" : "展開"}`}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <h3 className="text-lg font-semibold">{thread.name}</h3>
          <span className="text-muted-foreground text-sm">
            {fragments.length} 碎片
          </span>
        </button>
        <button
          onClick={onArchive}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`歸檔「${thread.name}」`}
          title="歸檔此線"
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <>
          <FragmentInput onSubmit={onAddFragment} />

          <div className="mt-4 space-y-2">
            {fragments
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map(fragment => (
                <FragmentCard key={fragment.id} fragment={fragment} />
              ))}
          </div>

          {intraConnections.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                線內連結
              </h4>
              <ConnectionList
                connections={intraConnections}
                fragments={fragments}
                compact
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add webapp/src/components/sasagani/ThreadPanel.tsx
git commit -m "feat(sasagani): add ThreadPanel component"
```

---

## Task 13: FragmentInput + FragmentCard 元件

**Files:**
- Create: `webapp/src/components/sasagani/FragmentInput.tsx`
- Create: `webapp/src/components/sasagani/FragmentCard.tsx`

**Step 1: 建立 FragmentInput**

```typescript
"use client";

import { useState } from "react";
import type { Fragment } from "@/lib/types";
import { Link, Type, Send } from "lucide-react";

interface Props {
  onSubmit: (type: Fragment["type"], content: string, note?: string) => void;
}

export function FragmentInput({ onSubmit }: Props) {
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  function detectType(text: string): Fragment["type"] {
    try {
      new URL(text);
      return "url";
    } catch {
      return "text";
    }
  }

  function handleSubmit() {
    if (!content.trim()) return;
    const type = detectType(content.trim());
    onSubmit(type, content.trim(), note.trim() || undefined);
    setContent("");
    setNote("");
    setShowNote(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="貼上 URL 或輸入想法..."
          className="bg-background border-border flex-1 rounded-md border px-3 py-2 text-sm"
          aria-label="輸入碎片"
        />
        <button
          onClick={() => setShowNote(!showNote)}
          className={`text-muted-foreground hover:text-foreground rounded-md p-2 ${showNote ? "bg-accent" : ""}`}
          aria-label="附加註記"
          title="附加註記"
        >
          <Type className="h-4 w-4" />
        </button>
        <button
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="bg-primary text-primary-foreground disabled:opacity-50 rounded-md p-2"
          aria-label="送出碎片"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {showNote && (
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="這讓我想到..."
          className="bg-background border-border w-full rounded-md border px-3 py-2 text-sm"
          aria-label="碎片註記"
          autoFocus
        />
      )}
    </div>
  );
}
```

**Step 2: 建立 FragmentCard**

```typescript
"use client";

import type { Fragment } from "@/lib/types";
import { Link, MessageSquare, Mic } from "lucide-react";

interface Props {
  fragment: Fragment;
}

const typeIcons = {
  url: Link,
  text: MessageSquare,
  voice: Mic,
};

export function FragmentCard({ fragment }: Props) {
  const Icon = typeIcons[fragment.type];

  return (
    <div className="bg-background border-border rounded-md border p-3">
      <div className="flex items-start gap-2">
        <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm break-all">
            {fragment.type === "url" ? (
              <a
                href={fragment.content}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {fragment.content}
              </a>
            ) : (
              fragment.content
            )}
          </p>
          {fragment.note && (
            <p className="text-muted-foreground mt-1 text-xs italic">
              {fragment.note}
            </p>
          )}
          {fragment.extracted_content && (
            <p className="text-muted-foreground mt-1 text-xs line-clamp-2">
              {fragment.extracted_content}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add webapp/src/components/sasagani/FragmentInput.tsx webapp/src/components/sasagani/FragmentCard.tsx
git commit -m "feat(sasagani): add FragmentInput and FragmentCard components"
```

---

## Task 14: ConnectionList 元件

**Files:**
- Create: `webapp/src/components/sasagani/ConnectionList.tsx`

**Step 1: 建立 ConnectionList**

```typescript
"use client";

import type { Connection, Fragment } from "@/lib/types";

interface Props {
  connections: Connection[];
  fragments: Fragment[];
  compact?: boolean;
}

function strengthColor(s: number): string {
  if (s >= 0.7) return "border-green-500/60 bg-green-500/10";
  if (s >= 0.4) return "border-yellow-500/60 bg-yellow-500/10";
  return "border-muted-foreground/30 bg-muted/50";
}

function fragmentLabel(id: string, fragments: Fragment[]): string {
  const f = fragments.find(frag => frag.id === id);
  if (!f) return id;
  if (f.type === "url") {
    try {
      return new URL(f.content).hostname;
    } catch {
      return f.content.slice(0, 30);
    }
  }
  return f.content.slice(0, 30) + (f.content.length > 30 ? "..." : "");
}

export function ConnectionList({ connections, fragments, compact }: Props) {
  if (connections.length === 0) return null;

  return (
    <ul className="space-y-2" role="list" aria-label="連結列表">
      {connections
        .sort((a, b) => b.strength - a.strength)
        .map(conn => (
          <li
            key={conn.id}
            className={`rounded-md border p-2 ${strengthColor(conn.strength)}`}
          >
            {!compact && (
              <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                <span>{fragmentLabel(conn.fragment_a, fragments)}</span>
                <span>—</span>
                <span>{fragmentLabel(conn.fragment_b, fragments)}</span>
                <span className="ml-auto">
                  {Math.round(conn.strength * 100)}%
                </span>
              </div>
            )}
            <p className={compact ? "text-xs" : "text-sm"}>
              {conn.description}
            </p>
          </li>
        ))}
    </ul>
  );
}
```

**Step 2: Commit**

```bash
git add webapp/src/components/sasagani/ConnectionList.tsx
git commit -m "feat(sasagani): add ConnectionList component with strength indicators"
```

---

## Task 15: 導航列加入 Sasagani 連結

**Files:**
- Modify: `webapp/src/components/Navbar.tsx`

**Step 1: 在導航連結陣列中加入 Sasagani**

找到導航連結定義的位置（通常是一個陣列），新增：

```typescript
{ href: "/sasagani", label: "ささがに" },
```

加在 Territory 和 Settings 之間。

**Step 2: 確認頁面可以正常載入**

Run: `cd C:/Code/asagiri/webapp && pnpm dev`
訪問 `http://localhost:3000/sasagani`，確認頁面渲染正常。

**Step 3: Commit**

```bash
git add webapp/src/components/Navbar.tsx
git commit -m "feat(sasagani): add Sasagani link to navbar"
```

---

## Task 16: 菌絲圖（D3.js Force Graph）

**Files:**
- Create: `webapp/src/components/sasagani/MyceliumGraph.tsx`
- Modify: `webapp/src/components/sasagani/SasaganiDashboard.tsx` — 加入菌絲圖 tab

**Step 1: 建立 MyceliumGraph**

使用 D3.js force simulation 視覺化碎片之間的連結。節點 = 碎片，邊 = 連結，邊的粗細 = strength。

```typescript
"use client";

import { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import type { Fragment, Connection } from "@/lib/types";

interface Props {
  fragments: Fragment[];
  connections: Connection[];
  width?: number;
  height?: number;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: Fragment["type"];
  threadId: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  strength: number;
  description: string;
}

const THREAD_COLORS = ["#6366f1", "#f59e0b", "#10b981"];

export function MyceliumGraph({
  fragments,
  connections,
  width = 600,
  height = 400,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const threadColorMap = useMemo(() => {
    const threadIds = [...new Set(fragments.map(f => f.thread_id))];
    const map: Record<string, string> = {};
    threadIds.forEach((id, i) => {
      map[id] = THREAD_COLORS[i % THREAD_COLORS.length];
    });
    return map;
  }, [fragments]);

  const { nodes, links } = useMemo(() => {
    const nodes: Node[] = fragments.map(f => ({
      id: f.id,
      label:
        f.type === "url"
          ? (() => { try { return new URL(f.content).hostname; } catch { return f.content.slice(0, 20); } })()
          : f.content.slice(0, 20),
      type: f.type,
      threadId: f.thread_id,
    }));

    const nodeIds = new Set(nodes.map(n => n.id));
    const links: Link[] = connections
      .filter(c => nodeIds.has(c.fragment_a) && nodeIds.has(c.fragment_b))
      .map(c => ({
        source: c.fragment_a,
        target: c.fragment_b,
        strength: c.strength,
        description: c.description,
      }));

    return { nodes, links };
  }, [fragments, connections]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // 邊
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#888")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => 1 + d.strength * 4);

    // 節點
    const node = g.append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 8)
      .attr("fill", d => threadColorMap[d.threadId] ?? "#888")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .call(d3.drag<SVGCircleElement, Node>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // 標籤
    const label = g.append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text(d => d.label)
      .attr("font-size", "10px")
      .attr("fill", "currentColor")
      .attr("dx", 12)
      .attr("dy", 4);

    // Tooltip
    node.append("title").text(d => d.label);
    link.append("title").text(d => d.description);

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as Node).x!)
        .attr("y1", d => (d.source as Node).y!)
        .attr("x2", d => (d.target as Node).x!)
        .attr("y2", d => (d.target as Node).y!);

      node.attr("cx", d => d.x!).attr("cy", d => d.y!);
      label.attr("x", d => d.x!).attr("y", d => d.y!);
    });

    return () => { simulation.stop(); };
  }, [nodes, links, width, height, threadColorMap]);

  if (nodes.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        還沒有碎片。丟些東西進來吧。
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="w-full"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="靈感菌絲網絡圖"
    />
  );
}
```

**Step 2: 在 SasaganiDashboard 底部加入菌絲圖**

在 `SasaganiDashboard.tsx` 的 `{/* 跨線連結 */}` section 之前加入：

```typescript
{/* 菌絲圖 */}
{data.fragments.length > 0 && (
  <section className="mt-12" aria-label="菌絲網絡">
    <h2 className="text-xl font-semibold mb-4">菌絲網絡</h2>
    <div className="bg-card border-border rounded-lg border p-4">
      <MyceliumGraph
        fragments={data.fragments}
        connections={data.connections}
      />
    </div>
  </section>
)}
```

並在 imports 加入 `import { MyceliumGraph } from "./MyceliumGraph";`

**Step 3: Commit**

```bash
git add webapp/src/components/sasagani/MyceliumGraph.tsx webapp/src/components/sasagani/SasaganiDashboard.tsx
git commit -m "feat(sasagani): add D3.js force-directed mycelium graph visualization"
```

---

## Task 17: 反向餵養 — 從 Asagiri Idea 拉進發酵槽

**Files:**
- Modify: `webapp/src/components/IdeaCard.tsx` — 加入「丟進ささがに」按鈕
- Create: `webapp/src/app/api/sasagani/ingest-idea/route.ts`

**Step 1: 建立 ingest-idea API**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { addFragment, getActiveThreads } from "@/lib/sasagani-data";
import { ferment } from "@/lib/sasagani-ferment";
import { getSasaganiData } from "@/lib/sasagani-data";

export async function POST(request: NextRequest) {
  try {
    const { idea_id, idea_title, idea_one_liner, thread_id } = await request.json();
    if (!idea_id || !thread_id) {
      return NextResponse.json({ error: "idea_id 和 thread_id 為必填" }, { status: 400 });
    }

    const content = `[Asagiri Idea] ${idea_title}: ${idea_one_liner}`;
    const fragment = await addFragment(thread_id, "text", content, `來自 asagiri engine idea ${idea_id}`);

    // 背景發酵
    void (async () => {
      try {
        const data = await getSasaganiData();
        const fresh = data.fragments.find(f => f.id === fragment.id);
        if (fresh) await ferment(fresh);
      } catch (err) {
        console.error("Ingest fermentation error:", err);
      }
    })();

    return NextResponse.json(fragment, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

**Step 2: 在 IdeaCard 加入按鈕**

在 IdeaCard.tsx 中適當位置加入一個小按鈕，點擊後顯示線選擇器，選擇後呼叫 `/api/sasagani/ingest-idea`。具體位置需閱讀 IdeaCard.tsx 後決定。

**Step 3: Commit**

```bash
git add webapp/src/app/api/sasagani/ingest-idea/route.ts webapp/src/components/IdeaCard.tsx
git commit -m "feat(sasagani): add reverse feed — pull asagiri ideas into fermentation threads"
```

---

## Task 18: Chrome 擴充套件

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/popup.html`
- Create: `extension/popup.js`
- Create: `extension/popup.css`

**Step 1: 建立 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Sasagani — Asagiri",
  "version": "0.1.0",
  "description": "靈感發酵槽 — 快速捕捉碎片丟進 Asagiri",
  "permissions": ["activeTab"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+Shift+S",
        "mac": "Command+Shift+S"
      },
      "description": "開啟 Sasagani"
    }
  }
}
```

**Step 2: 建立 popup.html**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <h1>ささがに</h1>
    <div id="status"></div>

    <div id="thread-select">
      <label for="thread">丟進哪條線？</label>
      <div id="threads" role="radiogroup" aria-label="選擇線"></div>
    </div>

    <div id="input-area">
      <input type="text" id="content" placeholder="URL 或想法..." aria-label="輸入碎片">
      <input type="text" id="note" placeholder="附註（可選）" aria-label="附註">
      <button id="submit" type="button">丟進去</button>
      <button id="capture" type="button">擷取當前頁面</button>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

**Step 3: 建立 popup.js**

```javascript
const API_BASE = "http://localhost:3000/api/sasagani";

let selectedThread = null;

async function loadThreads() {
  try {
    const res = await fetch(`${API_BASE}/threads`);
    const threads = await res.json();
    const container = document.getElementById("threads");
    container.innerHTML = "";

    if (threads.length === 0) {
      container.innerHTML = '<p class="empty">還沒有活躍的線。請先在 webapp 建立。</p>';
      return;
    }

    threads.forEach((t, i) => {
      const btn = document.createElement("button");
      btn.className = "thread-btn";
      btn.textContent = t.name;
      btn.dataset.id = t.id;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.addEventListener("click", () => {
        document.querySelectorAll(".thread-btn").forEach(b => {
          b.classList.remove("selected");
          b.setAttribute("aria-checked", "false");
        });
        btn.classList.add("selected");
        btn.setAttribute("aria-checked", "true");
        selectedThread = t.id;
      });
      container.appendChild(btn);

      if (i === 0) btn.click();
    });
  } catch {
    document.getElementById("status").textContent = "無法連接 webapp。請確認 localhost:3000 正在運行。";
  }
}

function detectType(text) {
  try {
    new URL(text);
    return "url";
  } catch {
    return "text";
  }
}

async function submit(content, note) {
  if (!selectedThread || !content.trim()) return;

  const type = detectType(content.trim());
  const body = { thread_id: selectedThread, type, content: content.trim() };
  if (note?.trim()) body.note = note.trim();

  try {
    const res = await fetch(`${API_BASE}/fragments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      document.getElementById("status").textContent = "已丟入發酵槽";
      document.getElementById("content").value = "";
      document.getElementById("note").value = "";
      setTimeout(() => { document.getElementById("status").textContent = ""; }, 2000);
    } else {
      const err = await res.json();
      document.getElementById("status").textContent = err.error;
    }
  } catch {
    document.getElementById("status").textContent = "送出失敗";
  }
}

document.getElementById("submit").addEventListener("click", () => {
  const content = document.getElementById("content").value;
  const note = document.getElementById("note").value;
  submit(content, note);
});

document.getElementById("content").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const content = document.getElementById("content").value;
    const note = document.getElementById("note").value;
    submit(content, note);
  }
});

document.getElementById("capture").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    document.getElementById("content").value = tab.url;
    const note = document.getElementById("note").value;
    submit(tab.url, note);
  }
});

loadThreads();
```

**Step 4: 建立 popup.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 16px;
  background: #1a1a2e;
  color: #eee;
}

h1 {
  font-size: 18px;
  margin-bottom: 12px;
  font-weight: 600;
}

#status {
  font-size: 12px;
  color: #10b981;
  min-height: 18px;
  margin-bottom: 8px;
}

label {
  font-size: 12px;
  color: #888;
  display: block;
  margin-bottom: 6px;
}

#threads {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.thread-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #222;
  color: #ccc;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.thread-btn.selected {
  border-color: #6366f1;
  background: #6366f120;
  color: #fff;
}

.thread-btn:hover { border-color: #555; }
.thread-btn:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }

input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #222;
  color: #eee;
  font-size: 13px;
  margin-bottom: 8px;
}

input:focus { border-color: #6366f1; outline: none; }
input::placeholder { color: #555; }

button#submit, button#capture {
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  margin-bottom: 6px;
  transition: background 0.15s;
}

button#submit {
  background: #6366f1;
  color: #fff;
}
button#submit:hover { background: #5558e6; }
button#submit:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }

button#capture {
  background: #333;
  color: #ccc;
}
button#capture:hover { background: #444; }
button#capture:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }

.empty { font-size: 12px; color: #666; }
```

**Step 5: 建立 icons 目錄（placeholder）**

```bash
mkdir -p C:/Code/asagiri/extension/icons
```

用任意方式產生 16x16、48x48、128x128 的 icon（可以先用空白 PNG）。

**Step 6: Commit**

```bash
git add extension/
git commit -m "feat(sasagani): add Chrome extension for quick fragment capture"
```

---

## 實作順序總結

| Task | 內容 | 依賴 |
|------|------|------|
| 1 | 型別定義 | 無 |
| 2 | 資料存取層 | Task 1 |
| 3 | Threads API | Task 2 |
| 4 | Fragments API | Task 2 |
| 5 | Connections API | Task 2 |
| 6 | URL 擷取 | 無 |
| 7 | AI 發酵引擎 | Task 2 |
| 8 | 整合發酵到 Fragment API | Task 4, 6, 7 |
| 9 | 推進為 Idea | Task 2 |
| 10 | Sasagani 頁面 | Task 2 |
| 11 | Dashboard 元件 | Task 10 |
| 12 | ThreadPanel 元件 | Task 11 |
| 13 | FragmentInput + Card | Task 12 |
| 14 | ConnectionList | Task 11 |
| 15 | 導航列 | Task 10 |
| 16 | 菌絲圖 | Task 11, 14 |
| 17 | 反向餵養 | Task 2, 7 |
| 18 | Chrome 擴充套件 | Task 3, 4 |

可平行化：Task 1+6 同時、Task 3+4+5 同時、Task 12+13+14 同時、Task 17+18 同時。
