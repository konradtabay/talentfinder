"use client";

import { getKeys, type Provider } from "./keys";

const HEADERS: Record<Provider, string> = {
  typesafe: "x-typesafe-key",
  tinyfish: "x-tinyfish-key",
};

export async function callApi<T>(path: string, body: unknown, providers: Provider[]): Promise<T> {
  const keys = getKeys();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  for (const p of providers) {
    const key = keys[p];
    if (key) headers[HEADERS[p]] = key;
  }
  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export async function checkKey(provider: Provider, key: string) {
  const res = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json", [HEADERS[provider]]: key },
    body: JSON.stringify({ provider }),
  });
  return (await res.json()) as { ok: boolean; error?: string };
}
