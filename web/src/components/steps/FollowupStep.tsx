"use client";

import { useMemo, useRef, useState } from "react";
import { updateEvent, type EventRecord } from "@/lib/events";
import { followupForGuest } from "@/lib/followup";
import { scoreGuest } from "@/lib/jev-client";
import type { Guest } from "@/lib/guests";
import { mergeGuests, parseLumaCsv } from "@/lib/luma-csv";
import { GuestLinkedInName } from "../GuestLinkedInName";
import { Button } from "../ui";
import { guestLinkedInHref } from "@/lib/linkedin";

export function FollowupStep({ event }: { event: EventRecord }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const defaultRole = event.roles[0]?.title ?? "open role";
  const attended = useMemo(
    () => event.guests.filter((g) => g.checkedIn).sort((a, b) => scoreGuest(b) - scoreGuest(a)),
    [event.guests],
  );
  const queue = attended.filter((g) => !g.followedUp);

  function importText(text: string) {
    setErr("");
    try {
      const incoming = parseLumaCsv(text);
      const checked = incoming.filter((g) => g.checkedIn).length;
      const merged = mergeGuests(event.guests, incoming);
      updateEvent(event.id, { guests: merged });
      setMsg(`${checked} checked in · ${merged.filter((g) => g.checkedIn).length} attended`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    }
  }

  async function sendDm(g: Guest) {
    const text = followupForGuest(event.followupTemplate, g, event.name, defaultRole);
    await navigator.clipboard.writeText(text);
    window.open(guestLinkedInHref(g), "_blank", "noopener,noreferrer");
    updateEvent(event.id, {
      guests: event.guests.map((x) =>
        x.id === g.id ? { ...x, followedUp: true, inPipeline: x.inPipeline || Boolean(x.fit?.isCandidate) } : x,
      ),
    });
  }

  return (
    <>
      <p className="text-muted max-w-xl">
        People who checked in, highest fit first. Opens LinkedIn and copies your note.
      </p>
      <textarea
        className="mt-4 w-full min-h-[80px] bg-bg border border-line p-3 text-sm"
        value={event.followupTemplate}
        onChange={(e) => updateEvent(event.id, { followupTemplate: e.target.value })}
      />
      <p className="mt-1 text-xs text-muted">
        Variables: {"{first_name}"}, {"{event_name}"}, {"{role_title}"}, {"{note_line}"}
      </p>

      <Button className="mt-6" variant="ghost" onClick={() => inputRef.current?.click()}>
        Upload post-event Luma CSV
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
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      {attended.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {attended.map((g) => (
            <li key={g.id} className="border border-line px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <GuestLinkedInName guest={g} className="font-semibold underline hover:text-fg" />
                {g.noteLine && <div className="text-xs text-muted truncate max-w-md">{g.noteLine}</div>}
              </div>
              <div className="flex gap-2 items-center">
                {g.followedUp ? (
                  <span className="text-xs text-muted">sent</span>
                ) : (
                  <Button variant="ghost" onClick={() => void sendDm(g)}>
                    Copy + open
                  </Button>
                )}
              </div>
            </li>
          ))}
          {queue.length === 0 && <p className="text-sm text-muted">Follow-up sent for everyone who checked in.</p>}
        </ul>
      )}
    </>
  );
}
