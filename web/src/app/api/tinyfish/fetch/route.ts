import type { NextRequest } from "next/server";
import { keyFrom, missingKey } from "@/lib/upstream";
import { parseFetchRequestBody, parseFetchResponse } from "@/lib/tinyfish-fetch-client";

export const maxDuration = 150;

export async function POST(req: NextRequest) {
  const key = keyFrom(req, "tinyfish");
  if (!key) return missingKey("tinyfish");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseFetchRequestBody(body);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const res = await fetch("https://api.fetch.tinyfish.ai", {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: parsed.urls,
      format: parsed.format,
      links: true,
      iframe_links: true,
      purpose: "Extract open job titles and role descriptions from a company careers page.",
      per_url_timeout_ms: 45000,
    }),
  });

  const text = await res.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return new Response(text, { status: res.status });
  }

  if (!res.ok) {
    const friendly = parseFetchResponse(payload);
    const message = "error" in friendly ? friendly.error : "Fetch request failed.";
    const headers = new Headers();
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) headers.set("retry-after", retryAfter);
    return Response.json({ error: message, details: payload }, { status: res.status, headers });
  }

  return Response.json(payload, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
