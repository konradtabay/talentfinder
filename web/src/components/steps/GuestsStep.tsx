"use client";

import { useRef, useState } from "react";
import { updateEvent, type EventRecord } from "@/lib/events";
import { mergeGuests, parseLumaCsv } from "@/lib/luma-csv";
import { GuestLinkedInName } from "../GuestLinkedInName";
import { Button } from "../ui";
import { guestLinkedInHref } from "@/lib/linkedin";

export function GuestsStep({ event }: { event: EventRecord }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function importText(text: string) {
    setErr("");
    try {
      const incoming = parseLumaCsv(text);
      const merged = mergeGuests(event.guests, incoming);
      updateEvent(event.id, { guests: merged });
      setMsg(`Imported ${incoming.length} rows · ${merged.length} unique guests`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <>
      <p className="text-muted max-w-xl">
        Export guests from Luma (CSV). We map name, email, approval, check-in, and LinkedIn answers. Re-import merges
        by email.
      </p>
      <p className="mt-3 text-sm">
        {event.guests.length} {event.guests.length === 1 ? "person" : "people"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => inputRef.current?.click()}>
          Upload CSV
        </Button>
        {event.guests.length > 0 && (
          <Button variant="ghost" onClick={() => updateEvent(event.id, { guests: [] })}>
            Remove all
          </Button>
        )}
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
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      {event.guests.length > 0 && (
        <div className="mt-6 overflow-x-auto border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-muted text-xs uppercase">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">LinkedIn</th>
                <th className="p-2">Check-in</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {event.guests.map((g) => (
                <tr key={g.id} className="border-t border-line">
                  <td className="p-2">
                    <GuestLinkedInName guest={g} />
                  </td>
                  <td className="p-2 text-muted">{g.email}</td>
                  <td className="p-2 truncate max-w-[180px]">
                    {g.linkedinUrl ? (
                      <a href={guestLinkedInHref(g)} className="underline hover:text-fg" target="_blank" rel="noreferrer">
                        Profile
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2">{g.checkedIn ? "yes" : "—"}</td>
                  <td className="p-2 text-right">
                    <button
                      className="text-muted underline hover:text-fg"
                      onClick={() =>
                        updateEvent(event.id, { guests: event.guests.filter((x) => x.id !== g.id) })
                      }
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
