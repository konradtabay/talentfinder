"use client";

import { useSyncExternalStore } from "react";
import type { Guest } from "./guests";
import { usableRoleTitle } from "./roles-parse";
import { FOLLOWUP_TEMPLATE, SPONSOR_TEMPLATE } from "./templates";

export type Role = {
  id: string;
  title: string;
  mustHaves: string;
};

export type SponsorEventProof = {
  name: string;
  url: string;
};

export type SponsorProspect = {
  id: string;
  company: string;
  contactFirstName: string;
  website: string;
  sponsoredEvents: SponsorEventProof[];
};

export type EventRecord = {
  id: string;
  name: string;
  city: string;
  date: string;
  capacity: number;
  showRate: number;
  roles: Role[];
  careersUrl: string;
  jdPaste: string;
  guests: Guest[];
  followupTemplate: string;
  sponsorTemplate: string;
  connectNoteTemplate: string;
  sponsorProspects: SponsorProspect[];
  createdAt: string;
};

function audienceRolePhrase(title: string): string {
  const t = title.trim().toLowerCase();
  if (/\bengineer\b/.test(t) && !/\bengineers\b/.test(t)) return t.replace(/\bengineer\b/, "engineers");
  if (t.endsWith("s")) return t;
  return `${t}s`;
}

export function audienceDescriptorFromRoles(roles: Role[]): string {
  const titles = roles.map((r) => r.title.trim()).filter((title) => usableRoleTitle(title));
  if (!titles.length) return "curated guests";
  const shown = titles.slice(0, 3).map(audienceRolePhrase);
  const list = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
  return `curated ${list}`;
}

const STORAGE_KEY = "tf.events.v1";
const CHANGE_EVENT = "tf-events-change";

const EMPTY_EVENTS: EventRecord[] = [];

let cachedRaw: string | null = null;
let cached: EventRecord[] = EMPTY_EVENTS;

function normalizeEvent(e: EventRecord): EventRecord {
  return {
    ...e,
    careersUrl: e.careersUrl ?? "",
    jdPaste: e.jdPaste ?? "",
    guests: e.guests ?? [],
    connectNoteTemplate: e.connectNoteTemplate ?? "Hi {first_name} — excited to see you at {event_name}!",
    sponsorTemplate: normalizeSponsorTemplate(e.sponsorTemplate ?? SPONSOR_TEMPLATE),
    sponsorProspects: (e.sponsorProspects ?? []).map((s) => {
      const legacy = s as SponsorProspect & {
        name?: string;
        url?: string;
        proofUrl?: string;
        signal?: string;
      };
      const events = legacy.sponsoredEvents?.length
        ? legacy.sponsoredEvents
        : legacy.proofUrl || legacy.url
          ? [{ name: "Past event", url: legacy.proofUrl || legacy.url || "" }]
          : legacy.signal
            ? [{ name: legacy.signal.slice(0, 72), url: legacy.proofUrl || "" }]
            : [];
      return {
        id: legacy.id,
        company: legacy.company || legacy.name || "",
        contactFirstName: legacy.contactFirstName ?? "",
        website: legacy.website || "",
        sponsoredEvents: events.filter((ev) => ev.url),
      };
    }),
  };
}

function normalizeSponsorTemplate(template: string): string {
  return template.replace(/\n\{why_you_line\}\n\n/, "\n\n").replace(/\n*\{why_you_line\}\n*/g, "\n");
}

function read(): EventRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = raw ? (JSON.parse(raw) as EventRecord[]).map(normalizeEvent) : EMPTY_EVENTS;
  }
  return cached;
}

function write(events: EventRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function listEvents(): EventRecord[] {
  return read();
}

export function getEvent(id: string): EventRecord | undefined {
  return read().find((e) => e.id === id);
}

export function createEvent(input: Pick<EventRecord, "name" | "city" | "date" | "capacity">): EventRecord {
  const event: EventRecord = {
    ...input,
    id: crypto.randomUUID(),
    showRate: 0.72,
    roles: [],
    careersUrl: "",
    jdPaste: "",
    guests: [],
    followupTemplate: FOLLOWUP_TEMPLATE,
    sponsorTemplate: SPONSOR_TEMPLATE,
    connectNoteTemplate: "Hi {first_name} — excited to see you at {event_name}!",
    sponsorProspects: [],
    createdAt: new Date().toISOString(),
  };
  write([event, ...read()]);
  return event;
}

export function updateEvent(id: string, patch: Partial<EventRecord>) {
  write(read().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

export function deleteEvent(id: string) {
  write(read().filter((e) => e.id !== id));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useEvents(): EventRecord[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY_EVENTS);
}

export function useEvent(id: string): EventRecord | undefined {
  const events = useEvents();
  return events.find((e) => e.id === id);
}
