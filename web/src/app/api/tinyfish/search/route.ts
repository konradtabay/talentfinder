import type { NextRequest } from "next/server";
import { keyFrom, missingKey, relay } from "@/lib/upstream";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const key = keyFrom(req, "tinyfish");
  if (!key) return missingKey("tinyfish");

  const params = (await req.json()) as Record<string, string | number>;
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`https://api.search.tinyfish.ai?${query}`, {
    headers: { "X-API-Key": key },
  });
  return relay(res);
}
