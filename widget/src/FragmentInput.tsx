// src/FragmentInput.tsx
import { h } from "preact";
import { useState } from "preact/hooks";

interface Props {
  onSubmit: (content: string) => Promise<void>;
  disabled: boolean;
}

export function FragmentInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    setStatus("sending");
    setErrorMsg("");
    try {
      await onSubmit(trimmed);
      setValue("");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
      setStatus("error");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  return (
    <div class="sg-input-area">
      <textarea
        class="sg-textarea"
        placeholder="Paste a URL or type anything..."
        value={value}
        onInput={(e) => setValue((e.target as HTMLTextAreaElement).value)}
        onKeyDown={handleKeyDown}
        disabled={status === "sending"}
      />
      <button
        class="sg-submit"
        onClick={handleSubmit}
        disabled={!value.trim() || status === "sending" || disabled}
      >
        {status === "sending" ? "Sending..." : "Drop it in"}
      </button>
      {status === "success" && <p class="sg-success">Captured!</p>}
      {status === "error" && <p class="sg-error">{errorMsg}</p>}
    </div>
  );
}
