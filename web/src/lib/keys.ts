"use client";

import { useSyncExternalStore } from "react";

export type Provider = "typesafe" | "tinyfish";
export type Keys = Partial<Record<Provider, string>>;

const STORAGE_KEY = "tf.keys.v1";
const CHANGE_EVENT = "tf-keys-change";
const EMPTY: Keys = {};

let cachedRaw: string | null = null;
let cachedKeys: Keys = EMPTY;

function read(): Keys {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedKeys = raw ? (JSON.parse(raw) as Keys) : EMPTY;
  }
  return cachedKeys;
}

function write(keys: Keys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function saveKey(provider: Provider, value: string) {
  write({ ...read(), [provider]: value.trim() });
}

export function clearKey(provider: Provider) {
  const next = { ...read() };
  delete next[provider];
  write(next);
}

export function getKeys(): Keys {
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

export function useKeys(): Keys {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function isReady(keys: Keys) {
  return Boolean(keys.typesafe && keys.tinyfish);
}

export function maskKey(key: string) {
  return key.length <= 10 ? "••••" : `${key.slice(0, 6)}…${key.slice(-4)}`;
}
