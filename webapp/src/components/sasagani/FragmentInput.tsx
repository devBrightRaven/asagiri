"use client";

import { useState, useCallback } from "react";
import { Send, Type } from "lucide-react";
import type { Fragment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FragmentInputProps {
  onSubmit: (
    type: Fragment["type"],
    content: string,
    note?: string,
  ) => Promise<void>;
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function FragmentInput({ onSubmit }: FragmentInputProps) {
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    const type: Fragment["type"] = isUrl(trimmed) ? "url" : "text";
    setSubmitting(true);
    try {
      await onSubmit(type, trimmed, note.trim() || undefined);
      setContent("");
      setNote("");
      setShowNote(false);
    } finally {
      setSubmitting(false);
    }
  }, [content, note, submitting, onSubmit]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="貼上 URL 或輸入想法..."
          aria-label="碎片內容"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          disabled={submitting}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowNote((prev) => !prev)}
          aria-label={showNote ? "隱藏備註" : "新增備註"}
          aria-pressed={showNote}
        >
          <Type className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          onClick={() => void handleSubmit()}
          disabled={!content.trim() || submitting}
          aria-label="送出碎片"
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {showNote && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="這讓我想到..."
          aria-label="碎片備註"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          disabled={submitting}
        />
      )}
    </div>
  );
}
