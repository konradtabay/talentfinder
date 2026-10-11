import type { NextRequest } from "next/server";

export const KEY_HEADERS = {
  typesafe: "x-typesafe-key",
  tinyfish: "x-tinyfish-key",
} as const;

export type UpstreamProvider = keyof typeof KEY_HEADERS;

export function keyFrom(req: NextRequest, provider: UpstreamProvider) {
  return req.headers.get(KEY_HEADERS[provider])?.trim() || null;
}

export function missingKey(provider: UpstreamProvider) {
  return Response.json({ error: `Missing ${provider} key` }, { status: 401 });
}

export async function relay(res: Response) {
  const body = await res.text();
  const headers = new Headers();
  headers.set("Content-Type", res.headers.get("Content-Type") ?? "application/json");
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) headers.set("retry-after", retryAfter);
  return new Response(body, { status: res.status, headers });
}
