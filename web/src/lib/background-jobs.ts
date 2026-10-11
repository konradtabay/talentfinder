"use client";

import { useSyncExternalStore } from "react";

export type BackgroundJob = {
  key: string;
  eventId: string;
  step: string;
  title: string;
  detail: string;
  error: string;
  done: string;
  running: boolean;
};

const EMPTY: BackgroundJob[] = [];
const jobs = new Map<string, BackgroundJob>();
const listeners = new Set<() => void>();
let snapshot: BackgroundJob[] = EMPTY;

function publish() {
  snapshot = [...jobs.values()];
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBackgroundJobs(): BackgroundJob[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

export function startBackgroundJob(
  input: { key: string; eventId: string; step: string; title: string },
  run: (update: (detail: string) => void) => Promise<string | void>,
): void {
  if (jobs.get(input.key)?.running) return;
  jobs.set(input.key, { ...input, detail: input.title, error: "", done: "", running: true });
  publish();

  void run((detail) => {
    const current = jobs.get(input.key);
    if (!current?.running) return;
    jobs.set(input.key, { ...current, detail });
    publish();
  })
    .then((done) => {
      const current = jobs.get(input.key);
      if (!current) return;
      jobs.set(input.key, {
        ...current,
        running: false,
        detail: "",
        error: "",
        done: done?.trim() || "Done",
      });
      publish();
    })
    .catch((error: unknown) => {
      const current = jobs.get(input.key);
      if (!current) return;
      jobs.set(input.key, {
        ...current,
        running: false,
        detail: "",
        done: "",
        error: error instanceof Error ? error.message : "Something went wrong",
      });
      publish();
    });
}
