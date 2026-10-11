"use client";

import { useMemo } from "react";
import { startBackgroundJob, useBackgroundJobs } from "@/lib/background-jobs";
import { audienceDescriptorFromRoles, updateEvent, type EventRecord } from "@/lib/events";
import { useHost } from "@/lib/host";
import { useKeys } from "@/lib/keys";
import { buildSponsorSearchQueries, discoverSponsorCompanies } from "@/lib/sponsor-discovery";
import { renderTemplate } from "@/lib/followup";
import { Button, ErrorText } from "../ui";

export function SponsorsStep({ event }: { event: EventRecord }) {
  const keys = useKeys();
  const host = useHost();
  const job = useBackgroundJobs().find((item) => item.key === `${event.id}:sponsors`);
  const busy = Boolean(job?.running);

  const plannedQueries = useMemo(() => buildSponsorSearchQueries(event), [event]);
  const audienceDescriptor = audienceDescriptorFromRoles(event.roles);

  const audienceCount =
    event.guests.filter((g) => g.decision === "accept").length || event.capacity || event.guests.length;

  function findSponsors() {
    if (!event.roles.length) {
      startBackgroundJob({ key: `${event.id}:sponsors`, eventId: event.id, step: "sponsors", title: "Find sponsors" }, async () => {
        throw new Error("Add at least one role first — sponsor search uses your open roles.");
      });
      return;
    }
    startBackgroundJob(
      { key: `${event.id}:sponsors`, eventId: event.id, step: "sponsors", title: "Find sponsors" },
      async (update) => {
        const prospects = await discoverSponsorCompanies(
          keys,
          event,
          (i, n, label) => {
            update(label === "Reading event pages" ? "Reading event pages…" : `${label} ${i}/${n}…`);
          },
          () => update("Waiting for TinyFish limit"),
        );
        if (!prospects.length) {
          throw new Error("No sponsor companies found. Try adding roles or a more specific city.");
        }
        updateEvent(event.id, { sponsorProspects: prospects });
      },
    );
  }

  return (
    <>
      <p className="text-muted max-w-xl">
        Find companies that sponsor similar events. Search checks two result pages for your city and roles, then reads those event pages for the full sponsor list.
      </p>

      {event.roles.length > 0 ? (
        <p className="mt-2 text-sm">
          Roles in search:{" "}
          <span className="text-muted">{event.roles.map((r) => r.title).join(" · ")}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-red-600">Add roles on the previous tab before searching sponsors.</p>
      )}

      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer">Preview search queries</summary>
        <ul className="mt-2 list-disc pl-4 space-y-1">
          {plannedQueries.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </details>

      <Button className="mt-4" variant="ghost" disabled={busy || !event.roles.length} onClick={() => void findSponsors()}>
        {busy ? job?.detail || "Searching…" : "Find sponsor companies"}
      </Button>
      <ErrorText message={job?.error ?? ""} />

      {event.sponsorProspects.length > 0 && (
        <ul className="mt-6 flex flex-col gap-4 text-sm">
          {event.sponsorProspects.map((s) => {
            const pitch = renderTemplate(event.sponsorTemplate, {
              first_name: s.contactFirstName.trim() || "there",
              host_name: host.name,
              host_title: host.title,
              host_company: host.company,
              event_name: event.name,
              event_date: event.date,
              city: event.city,
              audience_count: String(audienceCount),
              audience_descriptor: audienceDescriptor,
              why_you_line: "",
              package_name: "title",
              package_benefits: "Logo on comms, intro on stage, attendee list",
            });
            return (
              <li key={s.id} className="border border-line p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-lg font-semibold">{s.company}</span>
                  {s.website && (
                    <a href={s.website} className="text-xs underline text-muted" target="_blank" rel="noreferrer">
                      Website
                    </a>
                  )}
                </div>
                {s.sponsoredEvents.length > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    {s.sponsoredEvents.map((ev, i) => (
                      <span key={ev.url}>
                        {i > 0 && ", "}
                        <a href={ev.url} className="underline hover:text-fg" target="_blank" rel="noreferrer">
                          {ev.name}
                        </a>
                      </span>
                    ))}
                  </p>
                )}
                <label className="mt-2 block text-xs text-muted">
                  Contact first name (optional)
                  <input
                    className="mt-1 h-8 w-full max-w-xs bg-bg border border-line px-2"
                    value={s.contactFirstName}
                    onChange={(e) =>
                      updateEvent(event.id, {
                        sponsorProspects: event.sponsorProspects.map((x) =>
                          x.id === s.id ? { ...x, contactFirstName: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <pre className="mt-2 whitespace-pre-wrap text-xs bg-bg p-2 border border-line">{pitch}</pre>
                <Button className="mt-2" variant="ghost" onClick={() => void navigator.clipboard.writeText(pitch)}>
                  Copy pitch
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
