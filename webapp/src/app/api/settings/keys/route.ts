import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve("C:/Code/asagiri/engine/.env");

const PROVIDERS = [
  { id: "GEMINI_API_KEY", label: "Google Gemini", prefix: "AIza" },
  { id: "ANTHROPIC_API_KEY", label: "Anthropic Claude", prefix: "sk-ant-" },
  { id: "PERPLEXITY_API_KEY", label: "Perplexity", prefix: "pplx-" },
] as const;

function maskKey(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}..${value.slice(-4)}`;
}

async function readEnv(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(ENV_PATH, "utf-8");
    const result: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const eqIndex = trimmed.indexOf("=");
      const key = trimmed.slice(0, eqIndex).trim();
      const val = trimmed.slice(eqIndex + 1).trim();
      if (val) result[key] = val;
    }
    return result;
  } catch {
    return {};
  }
}

// GET: return masked keys only
export async function GET() {
  const env = await readEnv();
  const keys = PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    prefix: p.prefix,
    hasKey: Boolean(env[p.id]),
    masked: env[p.id] ? maskKey(env[p.id]) : null,
  }));
  return NextResponse.json({ keys });
}

// PUT: update a single key
export async function PUT(request: Request) {
  const body = await request.json();
  const { id, value } = body as { id: string; value: string };

  // Validate provider id
  const provider = PROVIDERS.find((p) => p.id === id);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  // Validate key is not empty
  if (!value || typeof value !== "string" || value.trim().length < 8) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  // Read current .env, update the key, write back
  let raw: string;
  try {
    raw = await fs.readFile(ENV_PATH, "utf-8");
  } catch {
    raw = "";
  }

  const lines = raw.split("\n");
  let found = false;
  const updated = lines.map((line) => {
    const trimmed = line.trim();
    // Match both active and commented-out lines
    if (trimmed === `# ${id}=` || trimmed.startsWith(`# ${id}=`) || trimmed.startsWith(`${id}=`)) {
      found = true;
      return `${id}=${value.trim()}`;
    }
    return line;
  });

  if (!found) {
    updated.push(`${id}=${value.trim()}`);
  }

  await fs.writeFile(ENV_PATH, updated.join("\n"), "utf-8");

  return NextResponse.json({
    success: true,
    masked: maskKey(value.trim()),
  });
}
