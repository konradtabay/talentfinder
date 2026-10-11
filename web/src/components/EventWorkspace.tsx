"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBackgroundJobs } from "@/lib/background-jobs";
import { useEvent } from "@/lib/events";
import {
  isWorkspaceStep,
  readWorkspaceStep,
  WORKSPACE_STEPS,
  workspacePath,
  writeWorkspaceStep,
  type WorkspaceStep,
} from "@/lib/workspace-step";
import { Panel } from "./ui";
import { FunnelStrip } from "./FunnelStrip";
import { RolesStep } from "./steps/RolesStep";
import { GuestsStep } from "./steps/GuestsStep";
import { FitStep } from "./steps/FitStep";
import { ConnectStep } from "./steps/ConnectStep";
import { NotesStep } from "./steps/NotesStep";
import { FollowupStep } from "./steps/FollowupStep";
import { PipelineStep } from "./steps/PipelineStep";
import { SponsorsStep } from "./steps/SponsorsStep";

function rememberStep(eventId: string, next: WorkspaceStep) {
  writeWorkspaceStep(eventId, next);
  const path = workspacePath(eventId, next);
  if (`${window.location.pathname}${window.location.search}` !== path) {
    window.history.replaceState(null, "", path);
  }
}

export function EventWorkspace({ eventId }: { eventId: string }) {
  const event = useEvent(eventId);
  const urlStep = useSearchParams().get("step");
  const initial = isWorkspaceStep(urlStep) ? urlStep : null;
  const [step, setStep] = useState<WorkspaceStep | null>(initial);
  const running = useBackgroundJobs().filter((job) => job.eventId === eventId && job.running);

  useEffect(() => {
    if (isWorkspaceStep(urlStep)) {
      setStep(urlStep);
      writeWorkspaceStep(eventId, urlStep);
      return;
    }
    const saved = readWorkspaceStep(eventId) ?? "roles";
    setStep(saved);
    rememberStep(eventId, saved);
  }, [eventId, urlStep]);

  function selectStep(next: WorkspaceStep) {
    setStep(next);
    rememberStep(eventId, next);
  }

  if (!event) {
    return <p className="text-muted">Event not found.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-dot text-4xl font-black">{event.name}</h1>
        <p className="mt-2 text-muted">
          {[event.city, event.date, `${event.capacity} seats`].filter(Boolean).join(" · ")}
        </p>
      </div>

      {event.guests.length > 0 && step !== "pipeline" && <FunnelStrip guests={event.guests} />}

      <nav className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-line">
        {WORKSPACE_STEPS.map((item) => (
          <button
            key={item.id}
            onClick={() => selectStep(item.id)}
            className={`px-3 py-3 text-left border-line border-r border-b last:border-r-0 ${
              step === item.id ? "bg-accent text-fg" : "text-muted hover:text-fg"
            }`}
          >
            <div className="text-[10px] tracking-widest">{item.n}</div>
            <div className="text-sm font-semibold">
              {item.label}
              {running.some((job) => job.step === item.id) ? " ·" : ""}
            </div>
          </button>
        ))}
      </nav>

      <Panel>
        <div className={step === "roles" ? "" : "hidden"}>
          <RolesStep event={event} />
        </div>
        <div className={step === "sponsors" ? "" : "hidden"}>
          <SponsorsStep event={event} />
        </div>
        <div className={step === "guests" ? "" : "hidden"}>
          <GuestsStep event={event} />
        </div>
        <div className={step === "fit" ? "" : "hidden"}>
          <FitStep event={event} />
        </div>
        <div className={step === "connect" ? "" : "hidden"}>
          <ConnectStep event={event} />
        </div>
        <div className={step === "notes" ? "" : "hidden"}>
          <NotesStep event={event} />
        </div>
        <div className={step === "followup" ? "" : "hidden"}>
          <FollowupStep event={event} />
        </div>
        <div className={step === "pipeline" ? "" : "hidden"}>
          <PipelineStep event={event} />
        </div>
      </Panel>
    </div>
  );
}
