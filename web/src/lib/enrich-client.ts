import { keyHeaders } from "./api-client";
import type { Keys } from "./keys";
import type { Guest } from "./guests";
import { fetchPageMarkdown, normalizeHttpUrl } from "./tinyfish-fetch-client";
import { tinyfishRequest } from "./tinyfish-limit";

function extractFromSnippet(snippet: string): Pick<Guest["enrichment"], "headline" | "currentTitle" | "currentCompany"> {
  const headline =
    snippet.match(/(?:^|\n)([^\n|·]{8,80}(?:\|[^·\n]{3,40})?)/)?.[1]?.trim() ?? "";
  const titleCompany = snippet.match(/([A-Za-z0-9 /&.-]{3,60})\s+at\s+([A-Za-z0-9 .&-]{2,60})/i);
  return {
    headline,
    currentTitle: titleCompany?.[1]?.trim() ?? "",
    currentCompany: titleCompany?.[2]?.trim() ?? "",
  };
}

export async function enrichGuest(
  keys: Keys,
  guest: Guest,
  onWait?: (ms: number) => void,
): Promise<Guest["enrichment"]> {
  const query = guest.linkedinUrl
    ? `${guest.fullName} ${guest.company} linkedin profile`
    : `${guest.fullName} ${guest.company} engineer founder linkedin`;

  const searchData = (await tinyfishRequest(
    "/api/tinyfish/search",
    {
      method: "POST",
      headers: keyHeaders(keys, { "Content-Type": "application/json" }),
      body: JSON.stringify({ query, num_results: 5 }),
    },
    { pace: "search", onWait },
  )) as { results?: { snippet?: string; title?: string }[] };
  const snippets = (searchData.results ?? [])
    .map((r) => `${r.title ?? ""}\n${r.snippet ?? ""}`.trim())
    .filter(Boolean)
    .join("\n---\n");

  let extra = "";
  const github = guest.githubUrl.trim();
  if (github && !github.includes("linkedin.com") && normalizeHttpUrl(github)) {
    try {
      const fetched = await fetchPageMarkdown(keys, github, { attempts: 1 });
      extra = fetched.text.slice(0, 1500);
    } catch {
      /* optional */
    }
  }

  const combined = [snippets, extra].filter(Boolean).join("\n\n");
  const parsed = extractFromSnippet(combined);

  return {
    headline: parsed.headline,
    currentTitle: parsed.currentTitle || guest.roleInterest,
    currentCompany: parsed.currentCompany || guest.company,
    snippet: combined.slice(0, 6000),
    enrichedAt: new Date().toISOString(),
  };
}
