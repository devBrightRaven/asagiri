import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function slugify(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "idea";
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function list(items) {
  return Array.isArray(items) && items.length
    ? items.map((item) => `- ${item}`).join("\n")
    : "- None recorded";
}

export async function writeFumigarasuHandoff({ idea, date, outputDir }) {
  if (!idea?.id || !idea?.title) throw new Error("idea id and title are required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must use YYYY-MM-DD");
  if (!path.isAbsolute(outputDir)) throw new Error("outputDir must be absolute");

  const hash = crypto.createHash("sha256").update(idea.id).digest("hex").slice(0, 8);
  const filename = `${date}-${slugify(idea.title)}-${hash}.md`;
  const filePath = path.join(outputDir, filename);
  const markdown = `---
title: ${yamlString(idea.title)}
status: "source"
source: "asagiri"
asagiri_id: ${yamlString(idea.id)}
researched_at: ${yamlString(date)}
domain: ${yamlString(idea.domain)}
tags: ${JSON.stringify(Array.isArray(idea.tags) ? idea.tags : [])}
---

# ${idea.title}

${idea.one_liner || ""}

## Why it may be worth writing

### Problem

${idea.problem || "None recorded"}

### Proposed response

${idea.solution || "None recorded"}

### Market signal

${idea.market_rationale || idea.market_size || "None recorded"}

## Research snapshot

- Domain: ${idea.domain || "None recorded"}
- Feasibility score: ${idea.feasibility_score ?? "Not scored"}
- Novelty score: ${idea.novelty_score ?? "Not scored"}
- Market score: ${idea.market_score ?? "Not scored"}
- Market size: ${idea.market_size || "None recorded"}
- Moat: ${idea.moat_analysis || "None recorded"}

### Competitors

${list(idea.competitors)}

### Sources

${list(idea.sources)}

## Human writing decision

- What part of this is actually alive for me?
- What experience or evidence can only I add?
- Which claim should be verified before drafting?
`;

  await fs.mkdir(outputDir, { recursive: true });
  try {
    await fs.writeFile(filePath, markdown, { encoding: "utf8", flag: "wx" });
    return { path: filePath, filename, created: true };
  } catch (error) {
    if (error?.code === "EEXIST") return { path: filePath, filename, created: false };
    throw error;
  }
}
