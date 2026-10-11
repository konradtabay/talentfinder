"use client";

import { useMemo, useState } from "react";
import { connectUsage, recordConnectSent } from "@/lib/connect-cap";
import { updateEvent, type EventRecord } from "@/lib/events";
import { renderTemplate } from "@/lib/followup";
import { guestSummary } from "@/lib/guest-summary";
import { scoreGuest } from "@/lib/jev-client";
import type { Guest } from "@/lib/guests";
import { guestLinkedInHref } from "@/lib/linkedin";
import { GuestLinkedInName } from "../GuestLinkedInName";
import { Button } from "../ui";

function linkedinOpen(guest: Guest) {
  window.open(guestLinkedInHref(guest), "_blank", "noopener,noreferrer");
}

export function ConnectStep({ event }: { event: EventRecord }) {
  const [usage, setUsage] = useState(connectUsage);
  const queue = useMemo(
    () =>
      [...event.guests]
        .filter((g) => g.decision === "accept" && !g.connectSent)
        .sort((a, b) => scoreGuest(b) - scoreGuest(a)),
    [event.guests],
  );

  function noteFor(g: Guest) {
    return renderTemplate(event.connectNoteTemplate, {
      first_name: g.firstName || g.fullName.split(" ")[0],
      event_name: event.name,
    });
  }

  async function sendOne(g: Guest) {
    const u = connectUsage();
    if (u.remaining <= 0) return;
    const text = noteFor(g);
    await navigator.clipboard.writeText(text);
    linkedinOpen(g);
    recordConnectSent();
    setUsage(connectUsage());
    updateEvent(event.id, {
      guests: event.guests.map((x) => (x.id === g.id ? { ...x, connectSent: true } : x)),
    });
  }

  return (
    <>
      <p className="text-muted max-w-xl">
        Accepted guests, highest fit first. Opens LinkedIn and copies your note.
      </p>
      <textarea
        className="mt-4 w-full min-h-[80px] bg-bg border border-line p-3 text-sm"
        value={event.connectNoteTemplate}
        onChange={(e) => updateEvent(event.id, { connectNoteTemplate: e.target.value })}
      />
      <p className="mt-1 text-xs text-muted">Variables: {"{first_name}"}, {"{event_name}"}</p>

      {queue.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No accepted guests waiting, or all marked sent.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {queue.slice(0, 30).map((g) => {
            const pct = g.fit ? scoreGuest(g) : null;
            const summary = guestSummary(g);
            return (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 border border-line px-3 py-2">
              <div>
                <GuestLinkedInName guest={g} className="font-semibold underline hover:text-fg" />
                <div className="text-xs text-muted">
                  {pct != null ? `${pct}%` : "—"}
                  {summary !== "—" ? ` · ${summary}` : ""}
                </div>
              </div>
              <Button variant="ghost" disabled={usage.remaining <= 0} onClick={() => void sendOne(g)}>
                Open + copy
              </Button>
            </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
