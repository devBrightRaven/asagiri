"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface KeyInfo {
  id: string;
  label: string;
  prefix: string;
  hasKey: boolean;
  masked: string | null;
}

function KeyRow({ keyInfo, onSaved }: { keyInfo: KeyInfo; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    if (!value.trim() || value.trim().length < 8) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: keyInfo.id, value }),
      });
      if (res.ok) {
        setSaved(true);
        setEditing(false);
        setValue("");
        setShowValue(false);
        onSaved();
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [value, keyInfo.id, onSaved]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
            {keyInfo.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {keyInfo.id} {keyInfo.prefix && `(${keyInfo.prefix}...)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {keyInfo.hasKey && !editing && (
            <span className="font-mono text-sm text-muted-foreground">
              {keyInfo.masked}
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-500">
              <Check className="size-4" aria-hidden="true" />
              Saved
            </span>
          )}
          {!editing && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              {keyInfo.hasKey ? "Update" : "Add"}
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <input
              type={showValue ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Paste your ${keyInfo.label} API key`}
              autoComplete="off"
              spellCheck={false}
              aria-label={`${keyInfo.label} API key`}
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowValue((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={showValue ? "Hide key" : "Show key"}
            >
              {showValue ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || value.trim().length < 8}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                "Save"
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setValue("");
                setShowValue(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/settings/keys");
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="font-mono text-2xl font-bold uppercase tracking-wider">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your API keys. Keys are stored locally and never sent to external servers.
        </p>
      </header>

      <Card className="cyber-card">
        <CardHeader>
          <CardTitle className="font-mono text-lg uppercase tracking-wider">
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            keys.map((k) => (
              <KeyRow key={k.id} keyInfo={k} onSaved={fetchKeys} />
            ))
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">
        Keys are saved to the local .env file. They are never transmitted over the network
        and are only used by the research engine running on your machine.
      </p>
    </div>
  );
}
