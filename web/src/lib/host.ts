"use client";

import { useSyncExternalStore } from "react";

export type Host = {
  name: string;
  title: string;
  company: string;
};

const STORAGE_KEY = "tf.host.v1";
const CHANGE_EVENT = "tf-host-change";
const EMPTY: Host = { name: "", title: "", company: "" };

let cachedRaw: string | null = null;
let cached: Host = EMPTY;

function read(): Host {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = raw ? { ...EMPTY, ...(JSON.parse(raw) as Host) } : EMPTY;
  }
  return cached;
}

export function saveHost(host: Host) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(host));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getHost(): Host {
  return read();
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useHost(): Host {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function isHostReady(host: Host) {
  return Boolean(host.name.trim() && host.company.trim());
}
