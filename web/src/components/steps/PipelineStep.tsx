"use client";

import { updateEvent, type EventRecord } from "@/lib/events";
import { guestSummary } from "@/lib/guest-summary";
import { scoreGuest } from "@/lib/jev-client";
import { pipelineExportCsv } from "@/lib/luma-csv";
import { FunnelStrip } from "../FunnelStrip";
import { Button } from "../ui";

export function PipelineStep({ event }: { event: EventRecord }) {
  function downloadPipeline() {
    const csv = pipelineExportCsv(event, event.guests);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.name.replace(/\s+/g, "-")}-pipeline.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const pipelineGuests = [...event.guests].sort((a, b) => {
    const stage = Number(b.inPipeline) - Number(a.inPipeline);
    if (stage !== 0) return stage;
    return scoreGuest(b) - scoreGuest(a);
  });

  return (
    <>
      <FunnelStrip guests={event.guests} />
      <p className="mt-4 text-muted max-w-xl">
        One row per guest. Columns cover name, email, LinkedIn, company, title, fit, school, and notes so an ATS can map them.
      </p>
      <Button className="mt-3" variant="ghost" disabled={!event.guests.length} onClick={downloadPipeline}>
        Download pipeline CSV
      </Button>

      {pipelineGuests.length > 0 && (
        <ul className="mt-4 border border-line divide-y divide-line text-sm">
          {pipelineGuests.map((g) => (
            <li key={g.id} className="p-2 flex justify-between gap-2">
              <span>
                {g.fullName}
                {g.fit ? ` · ${scoreGuest(g)}%` : ""}
                <span className="text-muted"> · {guestSummary(g)}</span>
              </span>
              <label className="text-xs flex items-center gap-1 shrink-0">
                <input
                  type="checkbox"
                  checked={g.inPipeline}
                  onChange={(e) =>
                    updateEvent(event.id, {
                      guests: event.guests.map((x) =>
                        x.id === g.id ? { ...x, inPipeline: e.target.checked } : x,
                      ),
                    })
                  }
                />
                in pipeline
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
