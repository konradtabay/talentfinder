"use client";

import { useEffect, useState } from "react";
import { isHostReady, saveHost, type Host } from "@/lib/host";
import { Button, Panel } from "./ui";

export function HostStep({ host }: { host: Host }) {
  const [draft, setDraft] = useState(host);
  const saved = isHostReady(host);

  useEffect(() => {
    setDraft(host);
  }, [host]);

  function submit() {
    saveHost({
      name: draft.name.trim(),
      title: draft.title.trim(),
      company: draft.company.trim(),
    });
  }

  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-muted">00</span>
          <h2 className="text-lg font-semibold tracking-tight">You</h2>
        </div>
        {saved && <span className="text-accent">● saved</span>}
      </div>
      <p className="mt-3 text-muted max-w-xl">
        Used in follow-ups and sponsor pitches. Stays in this browser. Use your <strong>full name</strong> (first and
        last) — not first name only.
      </p>
      <form
        className="mt-5 grid sm:grid-cols-3 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          required
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Full name (e.g. Alex Chen)"
          className="h-10 bg-bg border border-line px-3 outline-none focus:border-fg"
        />
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Title"
          className="h-10 bg-bg border border-line px-3 outline-none focus:border-fg"
        />
        <input
          required
          value={draft.company}
          onChange={(e) => setDraft({ ...draft, company: e.target.value })}
          placeholder="Company"
          className="h-10 bg-bg border border-line px-3 outline-none focus:border-fg"
        />
        <div className="sm:col-span-3">
          <Button type="submit" variant="ghost" disabled={!draft.name.trim() || !draft.company.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Panel>
  );
}
