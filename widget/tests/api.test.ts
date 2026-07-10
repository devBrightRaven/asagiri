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
