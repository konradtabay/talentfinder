import type { NextRequest } from "next/server";
import { keyFrom, missingKey, type UpstreamProvider } from "@/lib/upstream";

const CHECKS: Record<UpstreamProvider, (key: string) => Promise<Response>> = {
  typesafe: (key) =>
    fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        state: "ok",
        model: "jev-latest",
        questions: { ok: { type: "noul", instructions: "Is this the word ok?" } },
      }),
    }),
  tinyfish: (key) =>
    fetch("https://api.search.tinyfish.ai?query=tinyfish", {
      headers: { "X-API-Key": key },
    }),
};

export async function POST(req: NextRequest) {
  const { provider } = (await req.json()) as { provider: UpstreamProvider };
  if (!(provider in CHECKS)) {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }
  const key = keyFrom(req, provider);
  if (!key) return missingKey(provider);

  const res = await CHECKS[provider](key);
  if (res.ok) return Response.json({ ok: true });
  const reason =
    res.status === 401 || res.status === 403 ? "Key was rejected" : `Service returned ${res.status}`;
  return Response.json({ ok: false, error: reason }, { status: 200 });
}
