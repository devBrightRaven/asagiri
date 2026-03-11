"use client";

import { useState, useCallback } from "react";
import { ChevronUp, ChevronDown, Archive } from "lucide-react";
import type { Thread, Fragment, Connection } from "@/lib/types";
import { FragmentInput } from "./FragmentInput";
import { FragmentCard } from "./FragmentCard";
import { ConnectionList } from "./ConnectionList";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

interface ThreadPanelProps {
  thread: Thread;
  fragments: Fragment[];
  connections: Connection[];
  allFragments: Fragment[];
  onArchive: (threadId: string) => Promise<void>;
  onAddFragment: (
    threadId: string,
    type: Fragment["type"],
    content: string,
    note?: string,
  ) => Promise<void>;
}

export function ThreadPanel({
  thread,
  fragments,
  connections,
  allFragments,
  onArchive,
  onAddFragment,
}: ThreadPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const handleAddFragment = useCallback(
    async (type: Fragment["type"], content: string, note?: string) => {
      await onAddFragment(thread.id, type, content, note);
    },
    [thread.id, onAddFragment],
  );

  const intraThreadConnections = connections.filter(
    (c) =>
      c.thread_ids.length === 1 && c.thread_ids[0] === thread.id,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>{thread.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              ({fragments.length})
            </span>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "展開思考線" : "收合思考線"}
            >
              {collapsed ? (
                <ChevronDown className="size-4" aria-hidden="true" />
              ) : (
                <ChevronUp className="size-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => void onArchive(thread.id)}
              aria-label="封存思考線"
            >
              <Archive className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4">
          <FragmentInput onSubmit={handleAddFragment} />

          {fragments.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              尚無碎片。貼上連結或輸入想法。
            </p>
          )}

          <div className="space-y-2">
            {fragments.map((fragment) => (
              <FragmentCard key={fragment.id} fragment={fragment} />
            ))}
          </div>

          {intraThreadConnections.length > 0 && (
            <section aria-label="線內絲">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                線內絲
              </h3>
              <ConnectionList
                connections={intraThreadConnections}
                fragments={allFragments}
                compact
              />
            </section>
          )}
        </CardContent>
      )}
    </Card>
  );
}
