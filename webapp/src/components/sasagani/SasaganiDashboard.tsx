"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, Check } from "lucide-react";
import type { SasaganiData, Thread, Fragment } from "@/lib/types";
import { ThreadPanel } from "./ThreadPanel";
import { ConnectionList } from "./ConnectionList";
import { WebGraph } from "./WebGraph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SasaganiDashboardProps {
  initialData: SasaganiData;
}

const MAX_ACTIVE_THREADS = 3;

export function SasaganiDashboard({ initialData }: SasaganiDashboardProps) {
  const [data, setData] = useState<SasaganiData>(initialData);
  const [isCreating, setIsCreating] = useState(false);
  const [newThreadName, setNewThreadName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeThreads = data.threads.filter((t) => t.status === "active");
  const activeCount = activeThreads.length;

  const crossThreadConnections = data.connections.filter(
    (c) => c.thread_ids.length > 1,
  );

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch("/api/sasagani/threads");
      if (!res.ok) return;
      const threads: Thread[] = await res.json();

      const fragmentsByThread = await Promise.all(
        threads.map(async (t) => {
          const r = await fetch(
            `/api/sasagani/fragments?thread_id=${t.id}`,
          );
          if (!r.ok) return [];
          return (await r.json()) as Fragment[];
        }),
      );
      const fragments = fragmentsByThread.flat();

      setData((prev) => ({
        ...prev,
        threads: [
          ...prev.threads.filter((t) => t.status !== "active"),
          ...threads,
        ],
        fragments: [
          ...prev.fragments.filter(
            (f) => !threads.some((t) => t.id === f.thread_id),
          ),
          ...fragments,
        ],
      }));
    } catch {
      // silently fail refresh — data stays stale until next action
    }
  }, []);

  const handleCreateThread = useCallback(async () => {
    const trimmed = newThreadName.trim();
    if (!trimmed) return;

    setError(null);
    try {
      const res = await fetch("/api/sasagani/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "建立失敗");
        return;
      }
      setNewThreadName("");
      setIsCreating(false);
      await refreshData();
    } catch {
      setError("網路錯誤，請稍後再試");
    }
  }, [newThreadName, refreshData]);

  const handleArchiveThread = useCallback(
    async (threadId: string) => {
      try {
        const res = await fetch("/api/sasagani/threads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread_id: threadId, action: "archive" }),
        });
        if (!res.ok) return;
        await refreshData();
      } catch {
        // ignore
      }
    },
    [refreshData],
  );

  const handleAddFragment = useCallback(
    async (
      threadId: string,
      type: Fragment["type"],
      content: string,
      note?: string,
    ) => {
      try {
        const res = await fetch("/api/sasagani/fragments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thread_id: threadId,
            type,
            content,
            note: note || undefined,
          }),
        });
        if (!res.ok) return;
        await refreshData();
      } catch {
        // ignore
      }
    },
    [refreshData],
  );

  const getFragmentsForThread = useCallback(
    (threadId: string) =>
      data.fragments
        .filter((f) => f.thread_id === threadId)
        .toSorted(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        ),
    [data.fragments],
  );

  const getConnectionsForThread = useCallback(
    (threadId: string) =>
      data.connections.filter((c) => c.thread_ids.includes(threadId)),
    [data.connections],
  );

  return (
    <section className="space-y-8" aria-label="ささがに靈感織網">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ささがに</h1>
          <p className="text-sm text-muted-foreground">靈感織網</p>
        </div>
        {!isCreating && (
          <Button
            variant="outline"
            onClick={() => setIsCreating(true)}
            disabled={activeCount >= MAX_ACTIVE_THREADS}
            aria-label={`新增線（目前 ${activeCount} / ${MAX_ACTIVE_THREADS}）`}
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>
              新增線（{activeCount}/{MAX_ACTIVE_THREADS}）
            </span>
          </Button>
        )}
      </header>

      {/* Inline create form */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateThread();
              }}
            >
              <Input
                value={newThreadName}
                onChange={(e) => setNewThreadName(e.target.value)}
                placeholder="新思考線名稱..."
                aria-label="新思考線名稱"
                autoFocus
                className="max-w-xs"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newThreadName.trim()}
                aria-label="確認新增"
              >
                <Check className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsCreating(false);
                  setNewThreadName("");
                  setError(null);
                }}
                aria-label="取消新增"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </form>
            {error && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thread panels — 3-column grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {activeThreads.map((thread) => (
            <motion.div
              key={thread.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <ThreadPanel
                thread={thread}
                fragments={getFragmentsForThread(thread.id)}
                connections={getConnectionsForThread(thread.id)}
                allFragments={data.fragments}
                onArchive={handleArchiveThread}
                onAddFragment={handleAddFragment}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {activeThreads.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          尚無思考線。點擊「新增線」開始織網。
        </p>
      )}

      {/* Spider web graph */}
      {data.fragments.length > 0 && (
        <section className="mt-12" aria-label="蛛網">
          <h2 className="text-xl font-semibold mb-4">蛛網</h2>
          <div className="bg-card border-border rounded-lg border p-4">
            <WebGraph
              fragments={data.fragments}
              connections={data.connections}
            />
          </div>
        </section>
      )}

      {/* Cross-thread connections */}
      {crossThreadConnections.length > 0 && (
        <section aria-label="跨線絲">
          <h2 className="mb-3 text-lg font-semibold">跨線絲</h2>
          <ConnectionList
            connections={crossThreadConnections}
            fragments={data.fragments}
          />
        </section>
      )}
    </section>
  );
}
