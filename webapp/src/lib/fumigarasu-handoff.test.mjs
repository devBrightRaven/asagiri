import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { writeFumigarasuHandoff } from "./fumigarasu-handoff.mjs";

const idea = {
  id: "idea/unsafe-id",
  title: "A useful idea: with punctuation",
  domain: "Creator Economy",
  one_liner: "A bounded writing premise.",
  problem: "People collect research but do not turn it into a draft.",
  solution: "Create a human-selected handoff into the writing queue.",
  market_size: "Small but reachable.",
  competitors: ["Existing notes"],
  moat_analysis: "Owner context and judgment.",
  feasibility_score: 4,
  novelty_score: 3,
  market_score: 4,
  market_rationale: "The buyer and reach path are identifiable.",
  sources: ["https://example.com/source"],
  tags: ["writing", "agency"],
  created_at: "2026-07-10T00:00:00Z",
};

test("writes one idempotent, provenance-rich Markdown handoff", async (t) => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "asagiri-handoff-"));
  t.after(() => fs.rm(outputDir, { recursive: true, force: true }));

  const first = await writeFumigarasuHandoff({ idea, date: "2026-07-10", outputDir });
  const second = await writeFumigarasuHandoff({ idea, date: "2026-07-10", outputDir });
  const markdown = await fs.readFile(first.path, "utf8");

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.path, first.path);
  assert.match(path.basename(first.path), /^2026-07-10-a-useful-idea-with-punctuation-[a-f0-9]{8}\.md$/);
  assert.match(markdown, /source: "asagiri"/);
  assert.match(markdown, /asagiri_id: "idea\/unsafe-id"/);
  assert.match(markdown, /## Why it may be worth writing/);
  assert.match(markdown, /The buyer and reach path are identifiable\./);
  assert.match(markdown, /https:\/\/example\.com\/source/);
});
