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
