"use client";

import { Link, MessageSquare, Mic } from "lucide-react";
import type { Fragment } from "@/lib/types";

interface FragmentCardProps {
  fragment: Fragment;
}

const TYPE_ICONS = {
  url: Link,
  text: MessageSquare,
  voice: Mic,
} as const;

export function FragmentCard({ fragment }: FragmentCardProps) {
  const Icon = TYPE_ICONS[fragment.type];

  return (
    <article
      className="flex gap-3 rounded-lg border border-border bg-background p-3 text-sm"
      aria-label={`${fragment.type === "url" ? "連結" : fragment.type === "text" ? "文字" : "語音"}碎片`}
    >
      <div className="mt-0.5 shrink-0 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {fragment.type === "url" ? (
          <a
            href={fragment.content}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {fragment.content}
          </a>
        ) : (
          <p className="break-words">{fragment.content}</p>
        )}

        {fragment.note && (
          <p className="italic text-muted-foreground">{fragment.note}</p>
        )}

        {fragment.extracted_content && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {fragment.extracted_content}
          </p>
        )}
      </div>
    </article>
  );
}
