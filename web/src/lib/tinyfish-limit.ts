/**
 * TinyFish Search allows 30 requests per minute. Enrichment fires one search
 * per guest, so calls are queued under that cap and retried after a 429.
 */

const SEARCH_BUDGET = 26;
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 4;

let tail: Promise<unknown> = Promise.resolve();
const searchSentAt: number[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notify(onWait: ((ms: number) => void) | undefined, ms: number) {
  if (ms >= 5_000) onWait?.(ms);
}

async function waitForSearchSlot(onWait?: (ms: number) => void) {
  for (;;) {
    const now = Date.now();
    while (searchSentAt.length && now - searchSentAt[0] >= WINDOW_MS) searchSentAt.shift();
    if (searchSentAt.length < SEARCH_BUDGET) {
      searchSentAt.push(now);
      return;
    }
    const wait = WINDOW_MS - (now - searchSentAt[0]) + 400;
    notify(onWait, wait);
    await sleep(wait);
  }
}

type LimitInfo = {
  rateLimited: boolean;
  retryAfterMs: number;
  message: string;
  upgradeUrl?: string;
};

function findUpgrade(value: unknown, depth = 0): string | undefined {
  if (!value || typeof value !== "object" || depth > 4) return undefined;
  const rec = value as Record<string, unknown>;
  if (typeof rec.upgrade_url === "string") return rec.upgrade_url;
  if (rec.details) {
    const nested = findUpgrade(rec.details, depth + 1);
    if (nested) return nested;
  }
  if (rec.error && typeof rec.error === "object") return findUpgrade(rec.error, depth + 1);
  return undefined;
}

function findDetails(value: unknown): { limit?: number; windowSeconds?: number; code?: string; message?: string } {
  if (!value || typeof value !== "object") return {};
  const root = value as Record<string, unknown>;
  const err = root.error && typeof root.error === "object" ? (root.error as Record<string, unknown>) : null;
  const details = err?.details && typeof err.details === "object" ? (err.details as Record<string, unknown>) : null;
  return {
    code: typeof err?.code === "string" ? err.code : undefined,
    message: typeof err?.message === "string" ? err.message : typeof root.error === "string" ? root.error : undefined,
    limit: typeof details?.limit === "number" ? details.limit : undefined,
    windowSeconds: typeof details?.window_seconds === "number" ? details.window_seconds : undefined,
  };
}

export function parseTinyfishFailure(status: number, body: string, retryAfterHeader: string | null): LimitInfo {
  let payload: unknown = null;
  try {
    payload = JSON.parse(body);
  } catch {
    payload = null;
  }
  const details = findDetails(payload);
  const upgradeUrl = findUpgrade(payload);
  const rateLimited = status === 429 || details.code === "RATE_LIMIT_EXCEEDED";
  const headerSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  const windowSeconds = Number.isFinite(headerSeconds) ? headerSeconds : (details.windowSeconds ?? 60);
  if (rateLimited) {
    const limit = details.limit ?? 30;
    return {
      rateLimited: true,
      retryAfterMs: Math.max(1, windowSeconds) * 1000 + 500,
      upgradeUrl,
      message: `TinyFish allows ${limit} requests per minute.`,
    };
  }
  const message =
    details.message ||
    (body && !body.startsWith("{") ? body.slice(0, 280) : "") ||
    `Request failed (${status}).`;
  return { rateLimited: false, retryAfterMs: 0, message, upgradeUrl };
}

export function tinyfishLimitMessage(info: LimitInfo, exhausted: boolean): string {
  if (!info.rateLimited) return info.message;
  const next = exhausted
    ? "Stopped here so the next run can continue the rest. Click again in a minute, or"
    : "Waiting for the limit to reset.";
  return `${info.message} ${next}${info.upgradeUrl ? ` ${info.upgradeUrl}` : ""}`;
}

type RequestOpts = {
  pace?: "search";
  onWait?: (ms: number) => void;
  attempts?: number;
};

export function tinyfishRequest(input: string, init: RequestInit, opts: RequestOpts = {}): Promise<unknown> {
  const attempts = Math.max(1, opts.attempts ?? MAX_ATTEMPTS);
  const task = tail.then(async () => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (opts.pace === "search") await waitForSearchSlot(opts.onWait);
      const res = await fetch(input, init);
      if (res.ok) return res.json();
      const body = await res.text();
      const info = parseTinyfishFailure(res.status, body, res.headers.get("retry-after"));
      const exhausted = attempt === attempts - 1;
      if (info.rateLimited && !exhausted) {
        searchSentAt.length = 0;
        notify(opts.onWait, info.retryAfterMs);
        await sleep(info.retryAfterMs);
        continue;
      }
      throw new Error(tinyfishLimitMessage(info, exhausted));
    }
    throw new Error("TinyFish request failed.");
  });
  tail = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
