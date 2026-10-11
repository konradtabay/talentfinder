"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NewEventForm } from "@/components/NewEventForm";
import { Header, Panel } from "@/components/ui";
import { useBackgroundJobs } from "@/lib/background-jobs";
import { useEvents } from "@/lib/events";
import { isOnboarded } from "@/lib/onboard";
import { readWorkspaceStep, workspacePath } from "@/lib/workspace-step";

export default function AppHome() {
  const router = useRouter();
  const events = useEvents();
  const running = useBackgroundJobs().filter((job) => job.running);
  const [hrefs, setHrefs] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const event of events) {
      next[event.id] = workspacePath(event.id, readWorkspaceStep(event.id) ?? "roles");
    }
    setHrefs(next);
  }, [events]);

  useEffect(() => {
    if (!isOnboarded()) router.replace("/onboarding");
  }, [router]);

  return (
    <>
      <Header
        right={
          <Link href="/onboarding" className="underline hover:text-fg">
            setup
          </Link>
        }
      />
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 flex flex-col gap-6">
        <h1 className="font-dot text-4xl font-black">events</h1>
        {running.length > 0 && (
          <ul className="text-sm">
            {running.map((job) => {
              const event = events.find((item) => item.id === job.eventId);
              return (
                <li key={job.key}>
                  <Link href={hrefs[job.eventId] ?? `/app/${job.eventId}`} className="underline">
                    {event?.name ?? "Event"}
                  </Link>
                  <span className="text-muted"> · {job.detail || job.title}</span>
                </li>
              );
            })}
          </ul>
        )}
        {events.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-px bg-line border border-line">
            {events.map((event) => (
              <li key={event.id} className="bg-bg">
                <Link href={hrefs[event.id] ?? `/app/${event.id}`} className="block p-6 hover:bg-panel">
                  <div className="font-dot text-2xl font-black">{event.name}</div>
                  <p className="mt-1 text-muted">
                    {[event.city, event.date, `${event.roles.length} roles`].filter(Boolean).join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Panel className="dot-grid flex flex-col items-start gap-4">
          <p className="text-muted">New event. Add roles next, then the Luma CSV.</p>
          <NewEventForm />
        </Panel>
      </main>
    </>
  );
}
