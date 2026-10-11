"use client";

import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { startBackgroundJob, useBackgroundJobs } from "@/lib/background-jobs";
import { applyCuration } from "@/lib/curation";
import { getEvent, updateEvent, type EventRecord } from "@/lib/events";
import { enrichGuest } from "@/lib/enrich-client";
import { guestSummary } from "@/lib/guest-summary";
import type { Guest } from "@/lib/guests";
import { runFitCheck, scoreGuest } from "@/lib/jev-client";
import { useKeys } from "@/lib/keys";
import { lumaBulkStatusCsv } from "@/lib/luma-csv";
import { GuestLinkedInName } from "../GuestLinkedInName";
import { Button, ErrorText } from "../ui";

const DECISIONS: { id: Guest["decision"]; label: string }[] = [
  { id: "accept", label: "Accept" },
  { id: "decline", label: "Decline" },
  { id: "waitlist", label: "Waitlist" },
  { id: "review", label: "Review" },
];

function fitPercent(g: Guest): number | null {
  if (!g.fit) return null;
  return scoreGuest(g);
}

function orderedGuests(guests: Guest[]): Guest[] {
  const best = new Map<string, Guest>();
  for (const g of guests) {
    const key = g.fullName.trim().toLowerCase().replace(/\s+/g, " ");
    const prev = best.get(key);
    if (!prev || (fitPercent(g) ?? 0) > (fitPercent(prev) ?? 0)) best.set(key, g);
  }
  return [...best.values()].sort((a, b) => {
    const diff = (fitPercent(b) ?? 0) - (fitPercent(a) ?? 0);
    if (diff !== 0) return diff;
    return Number(Boolean(a.fit?.needsReview)) - Number(Boolean(b.fit?.needsReview));
  });
}

type FillDrag = {
  decision: Guest["decision"];
  startIndex: number;
  currentIndex: number;
  snapshot: Map<string, Guest["decision"]>;
};

export function FitStep({ event }: { event: EventRecord }) {
  const keys = useKeys();
  const job = useBackgroundJobs().find((item) => item.key === `${event.id}:enrich`);
  const busy = Boolean(job?.running);
  const rows = useMemo(() => orderedGuests(event.guests), [event.guests]);
  const dragRef = useRef<FillDrag | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  function commitFill(drag: FillDrag) {
    const list = rowsRef.current;
    const lo = Math.min(drag.startIndex, drag.currentIndex);
    const hi = Math.max(drag.startIndex, drag.currentIndex);
    const range = new Set(list.slice(lo, hi + 1).map((g) => g.id));
    const current = getEvent(event.id);
    if (!current) return;
    updateEvent(event.id, {
      guests: current.guests.map((g) => {
        if (range.has(g.id)) return g.decision === drag.decision ? g : { ...g, decision: drag.decision };
        const prev = drag.snapshot.get(g.id);
        if (prev != null && g.decision !== prev) return { ...g, decision: prev };
        return g;
      }),
    });
  }

  function startFill(index: number, decision: Guest["decision"], e: ReactPointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const drag: FillDrag = {
      decision,
      startIndex: index,
      currentIndex: index,
      snapshot: new Map(rowsRef.current.map((g) => [g.id, g.decision])),
    };
    dragRef.current = drag;
    commitFill(drag);
  }

  useEffect(() => {
    function move(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-fit-row]");
      if (!cell) return;
      const index = Number(cell.dataset.fitRow);
      if (!Number.isInteger(index) || index === drag.currentIndex) return;
      drag.currentIndex = index;
      commitFill(drag);
    }
    function end() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [event.id]);

  function pipelineLabel() {
    if (job?.running) return job.detail || "Enriching…";
    return "Enrich all";
  }

  function enrichAll() {
    const ev = getEvent(event.id);
    if (!ev) return;
    if (!ev.roles.length) {
      startBackgroundJob({ key: `${event.id}:enrich`, eventId: event.id, step: "fit", title: "Enrich all" }, async () => {
        throw new Error("Add at least one role first.");
      });
      return;
    }

    startBackgroundJob(
      { key: `${event.id}:enrich`, eventId: event.id, step: "fit", title: "Enrich all" },
      async (update) => {
        const pending = (getEvent(event.id)?.guests ?? []).filter((g) => !g.enrichment.enrichedAt);
        let index = 0;
        for (const g of pending) {
          index += 1;
          update(`Enriching ${index}/${pending.length} · ${g.fullName}`);
          const enrichment = await enrichGuest(keys, g, () => {
            update(`Enriching ${index}/${pending.length} · waiting for TinyFish limit`);
          });
          const latest = getEvent(event.id);
          if (!latest) return;
          updateEvent(event.id, {
            guests: latest.guests.map((x) => (x.id === g.id ? { ...x, enrichment } : x)),
          });
        }

        const scoring = getEvent(event.id);
        if (!scoring) return;
        const roles = scoring.roles;
        index = 0;
        for (const g of scoring.guests) {
          index += 1;
          update(`Scoring ${index}/${scoring.guests.length} · ${g.fullName}`);
          const current = getEvent(event.id)?.guests.find((x) => x.id === g.id) ?? g;
          const fit = await runFitCheck(keys, current, roles, scoring.city);
          const latest = getEvent(event.id);
          if (!latest) return;
          updateEvent(event.id, {
            guests: latest.guests.map((x) => (x.id === g.id ? { ...x, fit } : x)),
          });
        }

        update("Ranking…");
        const finished = getEvent(event.id);
        if (!finished) return;
        updateEvent(event.id, {
          guests: applyCuration(finished.guests, finished.capacity, finished.showRate),
        });
      },
    );
  }

  function downloadBulk() {
    const csv = lumaBulkStatusCsv(event.guests);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.name.replace(/\s+/g, "-")}-luma-status.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" disabled={!event.guests.length || busy} onClick={() => void enrichAll()}>
          {pipelineLabel()}
        </Button>
        <Button variant="ghost" disabled={!event.guests.length || busy} onClick={downloadBulk}>
          Export Luma status CSV
        </Button>
      </div>
      <ErrorText message={job?.error ?? ""} />

      {rows.length > 0 && (
        <>
          <div className="mt-6 overflow-x-auto border border-line text-sm">
            <table className="w-full text-left">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="p-2">Guest</th>
                  <th className="p-2">Summary</th>
                  <th className="p-2">Fit</th>
                  <th className="p-2">Decision</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g, index) => {
                  const pct = fitPercent(g);
                  return (
                    <tr key={g.id} className="border-t border-line align-top">
                      <td className="p-2 font-medium whitespace-nowrap">
                        <GuestLinkedInName guest={g} />
                      </td>
                      <td className="p-2 text-muted max-w-md">{guestSummary(g)}</td>
                      <td className="p-2 whitespace-nowrap">
                        {pct == null ? "—" : `${pct}%`}
                        {g.fit?.needsReview && <span className="text-xs text-muted"> review</span>}
                      </td>
                      <td className="p-2" data-fit-row={index}>
                        <div className="flex flex-wrap gap-1">
                          {DECISIONS.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onPointerDown={(e) => startFill(index, d.id, e)}
                              className={`px-2 py-1 text-xs border cursor-ns-resize select-none touch-none ${
                                g.decision === d.id ? "bg-accent border-fg" : "border-line text-muted hover:text-fg"
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
