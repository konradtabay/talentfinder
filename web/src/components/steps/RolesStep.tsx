"use client";

import { useState } from "react";
import { startBackgroundJob, useBackgroundJobs } from "@/lib/background-jobs";
import { getEvent, updateEvent, type EventRecord } from "@/lib/events";
import { attachJobDescriptions, jobPostingLinks, parseCareersPage } from "@/lib/roles-parse";
import { fetchPageMarkdown, fetchPages, normalizeHttpUrl } from "@/lib/tinyfish-fetch-client";
import { useKeys } from "@/lib/keys";
import { Button, ErrorText } from "../ui";

export function RolesStep({ event }: { event: EventRecord }) {
  const keys = useKeys();
  const [roleDraft, setRoleDraft] = useState("");
  const job = useBackgroundJobs().find((item) => item.key === `${event.id}:careers`);
  const busy = Boolean(job?.running);

  return (
    <>
      <p className="text-muted max-w-xl">
        What you&apos;re hiring for. Fit check scores every guest against these roles.
      </p>

      {event.roles.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {event.roles.map((role) => (
            <li key={role.id} className="border border-line px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{role.title}</span>
                <button
                  className="text-muted underline hover:text-fg shrink-0"
                  onClick={() => updateEvent(event.id, { roles: event.roles.filter((r) => r.id !== role.id) })}
                >
                  remove
                </button>
              </div>
              <textarea
                className="mt-2 w-full min-h-[72px] bg-bg border border-line p-2 text-xs"
                placeholder="Role description"
                value={role.mustHaves}
                onChange={(e) =>
                  updateEvent(event.id, {
                    roles: event.roles.map((r) => (r.id === role.id ? { ...r, mustHaves: e.target.value } : r)),
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const title = roleDraft.trim();
          if (!title) return;
          updateEvent(event.id, {
            roles: [...event.roles, { id: crypto.randomUUID(), title, mustHaves: "" }],
          });
          setRoleDraft("");
        }}
      >
        <input
          value={roleDraft}
          onChange={(e) => setRoleDraft(e.target.value)}
          placeholder="e.g. Founding engineer"
          className="h-10 flex-1 bg-bg border border-line px-3 outline-none focus:border-fg"
        />
        <Button type="submit" variant="ghost" disabled={!roleDraft.trim()}>
          Add
        </Button>
      </form>

      <div className="mt-8 border-t border-line pt-6">
        <h3 className="text-sm font-semibold">Careers page</h3>
        <input
          className="mt-2 h-10 w-full bg-bg border border-line px-3"
          placeholder="https://company.com/careers"
          value={event.careersUrl}
          onChange={(e) => updateEvent(event.id, { careersUrl: e.target.value })}
          onBlur={(e) => {
            const normalized = normalizeHttpUrl(e.target.value);
            if (normalized && normalized !== event.careersUrl) {
              updateEvent(event.id, { careersUrl: normalized });
            }
          }}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={!event.careersUrl.trim() || !keys.tinyfish || busy}
            onClick={() => {
              const board = normalizeHttpUrl(event.careersUrl);
              startBackgroundJob(
                { key: `${event.id}:careers`, eventId: event.id, step: "roles", title: "Fetch careers page" },
                async (update) => {
                  if (!board) throw new Error("Enter a valid public careers URL (https://…).");
                  update("Fetching careers page…");
                  const page = await fetchPageMarkdown(keys, board);
                  const roles = parseCareersPage(page.text);
                  if (!roles.length) throw new Error("No job titles found on that page.");
                  update("Fetching role descriptions…");
                  const urls = jobPostingLinks(page.links, board, page.text);
                  const posts = [];
                  for (let i = 0; i < urls.length; i += 10) {
                    posts.push(...(await fetchPages(keys, urls.slice(i, i + 10))));
                  }
                  const withDescriptions = attachJobDescriptions(roles, posts);
                  const latest = getEvent(event.id);
                  if (!latest) return;
                  updateEvent(event.id, {
                    roles: [
                      ...latest.roles,
                      ...withDescriptions.map((p) => ({ id: crypto.randomUUID(), title: p.title, mustHaves: p.mustHaves })),
                    ],
                  });
                },
              );
            }}
          >
            {busy ? job?.detail || "Fetching…" : "Fetch careers page"}
          </Button>
        </div>
        <ErrorText message={job?.error ?? ""} />
      </div>
    </>
  );
}
