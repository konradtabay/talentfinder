import type { Keys } from "./keys";

export function keyHeaders(keys: Keys, extra?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = { ...extra };
  if (keys.typesafe) h["x-typesafe-key"] = keys.typesafe;
  if (keys.tinyfish) h["x-tinyfish-key"] = keys.tinyfish;
  return h;
}
