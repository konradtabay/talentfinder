"use client";

import { useRef, useState } from "react";
import { startBackgroundJob, useBackgroundJobs } from "@/lib/background-jobs";
import { getEvent, updateEvent, type EventRecord } from "@/lib/events";
import { matchNoteToGuest } from "@/lib/jev-client";
import { useKeys } from "@/lib/keys";
import { mergeGuests, parseLumaCsv } from "@/lib/luma-csv";
import { Button } from "../ui";

function splitConversations(text: string): string[] {
  return text
    .split(/\n{2,}(?=Speaker [AB]:|#{1,3}\s|\*\*)/)
    .map((b) => b.trim())
    .filter((b) => b.length > 40);
}

export function NotesStep({ event }: { event: EventRecord }) {
  const keys = useKeys();
  const inputRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");
  const job = useBackgroundJobs().find((item) => item.key === `${event.id}:notes`);
  const busy = Boolean(job?.running);
  const attended = event.guests.filter((g) => g.checkedIn);

  function importText(text: string) {
    setImportErr("");
    try {
      const incoming = parseLumaCsv(text);
      const checked = incoming.filter((g) => g.checkedIn).length;
      const merged = mergeGuests(event.guests, incoming);
      updateEvent(event.id, { guests: merged });
      setImportMsg(`${checked} checked in · ${merged.filter((g) => g.checkedIn).length} attended`);
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : "Import failed");
    }
  }

  function matchBlocks(blocks: string[]) {
    startBackgroundJob(
      { key: `${event.id}:notes`, eventId: event.id, step: "notes", title: "Match notes" },
      async (update) => {
        let matched = 0;
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          update(`Matching ${i + 1}/${blocks.length}`);
          const latest = getEvent(event.id);
          if (!latest) return;
          const { guestId, confidence } = await matchNoteToGuest(
            keys,
            block,
            latest.guests.filter((g) => g.checkedIn),
          );
          if (!guestId || confidence < 0.55) continue;
          const line = block.split("\n").find((l) => l.length > 20) ?? block.slice(0, 160);
          const current = getEvent(event.id);
          if (!current) return;
          const guests = current.guests.map((g) => (g.id === guestId ? { ...g, noteLine: line.slice(0, 280) } : g));
          if (!guests.some((g) => g.id === guestId)) continue;
          updateEvent(event.id, { guests });
          matched += 1;
        }
        return `Matched ${matched} conversation${matched === 1 ? "" : "s"} to attendees`;
      },
    );
  }

  return (
    <>
      <p className="text-muted max-w-xl">
        Paste note transcripts (Granola, Pocket..). We split conversations and map them to people who checked in. Say
        names + companies out loud for better matches.
      </p>
      {attended.length > 0 ? (
        <p className="mt-3 text-sm">
          {attended.length} checked in
          {attended.length <= 8
            ? `: ${attended.map((g) => g.fullName).join(", ")}`
            : `: ${attended
                .slice(0, 6)
                .map((g) => g.fullName)
                .join(", ")} and ${attended.length - 6} more`}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">Upload the post-event Luma CSV so notes know who attended.</p>
      )}

      <textarea
        className="mt-4 w-full min-h-[160px] bg-bg border border-line p-3 text-sm"
        placeholder="Paste a transcript…"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => inputRef.current?.click()}>
          {attended.length > 0 ? "Replace post-event CSV" : "Upload post-event Luma CSV"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            importText(await file.text());
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          disabled={!paste.trim() || busy || attended.length === 0}
          onClick={() => void matchBlocks(splitConversations(paste))}
        >
          {busy ? job?.detail || "Matching…" : "Match to attendees"}
        </Button>
      </div>
      {importMsg && <p className="mt-2 text-sm">{importMsg}</p>}
      {importErr && <p className="mt-2 text-sm text-red-600">{importErr}</p>}

      {job?.done && <p className="mt-2 text-sm">{job.done}</p>}
      {job?.error && <p className="mt-2 text-sm text-red-600">{job.error}</p>}

      {event.guests.some((g) => g.noteLine) && (
        <ul className="mt-6 text-sm border border-line divide-y divide-line">
          {event.guests
            .filter((g) => g.checkedIn && g.noteLine)
            .map((g) => (
              <li key={g.id} className="p-2">
                <span className="font-semibold">{g.fullName}</span>
                <span className="text-muted"> — </span>
                {g.noteLine}
              </li>
            ))}
        </ul>
      )}
    </>
  );
}
