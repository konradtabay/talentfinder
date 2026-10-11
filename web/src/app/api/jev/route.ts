import type { NextRequest } from "next/server";
import { keyFrom, missingKey, relay } from "@/lib/upstream";

export const maxDuration = 60;

const JEV_MODEL = "jev-latest";

export async function POST(req: NextRequest) {
  const key = keyFrom(req, "typesafe");
  if (!key) return missingKey("typesafe");

  const { state, questions } = (await req.json()) as { state: unknown; questions: unknown };
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: JEV_MODEL, state, questions }),
  });
  return relay(res);
}
