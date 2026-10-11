import { keyHeaders } from "./api-client";
import type { Keys } from "./keys";
import { tinyfishRequest } from "./tinyfish-limit";

const PER_URL_ERRORS: Record<string, string> = {
  page_not_found: "That page was not found (404). Check the URL.",
  bot_blocked: "The site blocked automated fetch. Paste the JD instead.",
  login_required: "That careers page requires login. Paste the JD instead.",
  empty_content: "No readable text on that page. Paste the JD instead.",
  invalid_url: "That URL is not allowed (must be a public http(s) link).",
  timeout: "The page took too long to load. Try again or paste the JD.",
  target_unreachable: "Could not reach that site. Check the URL and try again.",
};

export function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname || u.hostname === "localhost") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function parseFetchRequestBody(body: unknown): { urls: string[]; format: "markdown" } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be JSON with a urls array." };
  }
  const record = body as Record<string, unknown>;
  const rawUrls = record.urls ?? (record.url != null ? [record.url] : null);
  if (!rawUrls) {
    return { error: 'Missing "urls". Pass one or more careers page URLs, e.g. ["https://company.com/careers"].' };
  }
  if (!Array.isArray(rawUrls)) {
    return { error: '"urls" must be an array of strings.' };
  }
  const urls = rawUrls
    .map((u) => (typeof u === "string" ? normalizeHttpUrl(u) : null))
    .filter((u): u is string => Boolean(u));
  if (!urls.length) {
    return { error: "Add a valid http(s) careers URL (e.g. https://company.com/careers)." };
  }
  if (urls.length > 10) {
    return { error: "At most 10 URLs per request." };
  }
  return { urls, format: "markdown" };
}

function friendlyUpstreamError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const err = root.error;
  if (err && typeof err === "object") {
    const msg = (err as { message?: string }).message;
    if (msg) return msg;
  }
  if (typeof root.message === "string") return root.message;
  return null;
}

export type FetchedPage = {
  text: string;
  title: string | null;
  links: string[];
};

export function parseFetchResponse(payload: unknown): FetchedPage | { error: string } {
  const upstream = friendlyUpstreamError(payload);
  if (upstream) return { error: upstream };

  const data = payload as {
    results?: {
      url?: string;
      text?: string | null;
      title?: string | null;
      links?: string[];
      iframe_links?: string[];
    }[];
    errors?: { url?: string; error?: string }[];
  };

  const pageErrors = data.errors ?? [];
  const results = data.results ?? [];
  const text = results.map((r) => (typeof r.text === "string" ? r.text : "")).join("\n\n").trim();
  const links = results.flatMap((r) => [...(r.links ?? []), ...(r.iframe_links ?? [])]);

  if (!text) {
    const code = pageErrors[0]?.error ?? "empty_content";
    const url = pageErrors[0]?.url ?? "";
    const hint = PER_URL_ERRORS[code] ?? `Could not fetch ${url || "that page"}.`;
    return { error: hint };
  }

  return { text, title: results[0]?.title ?? null, links };
}

export async function fetchPages(keys: Keys, urls: string[]): Promise<FetchedPage[]> {
  const normalized = urls.map((u) => normalizeHttpUrl(u)).filter((u): u is string => Boolean(u)).slice(0, 10);
  if (!normalized.length) return [];

  const payload = await tinyfishRequest("/api/tinyfish/fetch", {
    method: "POST",
    headers: keyHeaders(keys, { "Content-Type": "application/json" }),
    body: JSON.stringify({ urls: normalized, format: "markdown" }),
  });
  if (!payload || typeof payload !== "object") return [];

  const results =
    (
      payload as {
        results?: { text?: string | null; title?: string | null; links?: string[]; iframe_links?: string[] }[];
      }
    ).results ?? [];
  return results.map((r) => ({
    text: r.text ?? "",
    title: r.title ?? null,
    links: [...(r.links ?? []), ...(r.iframe_links ?? [])],
  }));
}

export async function fetchPageMarkdown(
  keys: Keys,
  url: string,
  opts?: { attempts?: number },
): Promise<FetchedPage> {
  const normalized = normalizeHttpUrl(url);
  if (!normalized) {
    throw new Error("Enter a valid public careers URL (https://…).");
  }

  const payload = await tinyfishRequest(
    "/api/tinyfish/fetch",
    {
      method: "POST",
      headers: keyHeaders(keys, { "Content-Type": "application/json" }),
      body: JSON.stringify({ urls: [normalized], format: "markdown" }),
    },
    { attempts: opts?.attempts },
  );

  const parsed = parseFetchResponse(payload);
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed;
}
