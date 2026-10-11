"use client";

import { useState, type ReactNode } from "react";
import { checkKey } from "@/lib/api";
import { clearKey, maskKey, saveKey, type Provider } from "@/lib/keys";
import { Button, Panel } from "./ui";

type Props = {
  step: string;
  provider: Provider;
  title: string;
  description: ReactNode;
  value?: string;
  placeholder: string;
  getKeyUrl: string;
  optional?: boolean;
  primaryAction?: ReactNode;
};

export function KeyStep({
  step,
  provider,
  title,
  description,
  value,
  placeholder,
  getKeyUrl,
  optional,
  primaryAction,
}: Props) {
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(!primaryAction);

  async function submit() {
    setChecking(true);
    setError(null);
    const result = await checkKey(provider, draft.trim()).catch(() => ({
      ok: false,
      error: "Couldn't reach the check service",
    }));
    setChecking(false);
    if (result.ok) {
      saveKey(provider, draft);
      setDraft("");
    } else {
      setError(result.error ?? "Key didn't work");
    }
  }

  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-muted">{step}</span>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {optional && <span className="text-muted">optional</span>}
        </div>
        {value && <span className="text-accent">● connected</span>}
      </div>
      <p className="mt-3 text-muted max-w-xl">{description}</p>

      {value ? (
        <div className="mt-5 flex items-center gap-4">
          <code className="text-fg">{maskKey(value)}</code>
          <button className="text-muted underline hover:text-fg" onClick={() => clearKey(provider)}>
            disconnect
          </button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {primaryAction && (
            <div className="flex items-center gap-4">
              {primaryAction}
              {!showPaste && (
                <button className="text-muted underline hover:text-fg" onClick={() => setShowPaste(true)}>
                  or paste a key
                </button>
              )}
            </div>
          )}
          {showPaste && (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                className="h-10 flex-1 min-w-64 bg-bg border border-line px-3 outline-none focus:border-fg"
              />
              <Button type="submit" variant={primaryAction ? "ghost" : "primary"} disabled={!draft.trim() || checking}>
                {checking ? "checking…" : "Save"}
              </Button>
            </form>
          )}
          <a href={getKeyUrl} target="_blank" rel="noreferrer" className="text-muted underline hover:text-fg w-fit">
            get a key ↗
          </a>
          {error && <p className="text-danger">{error}</p>}
        </div>
      )}
    </Panel>
  );
}
