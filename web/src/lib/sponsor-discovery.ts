import { keyHeaders } from "./api-client";
import type { EventRecord, SponsorEventProof, SponsorProspect } from "./events";
import type { Keys } from "./keys";
import { usableRoleTitle } from "./roles-parse";
import { tinyfishRequest } from "./tinyfish-limit";

type SearchHit = { title: string; url: string; snippet: string };

const LUMA = /lu\.ma|luma\.com/i;
const BAD_COMPANY =
  /\b(20\d{2}|summit|fundraise|register|registration|hosted by|special thanks|steuart|battery innovation|first fundraise|techstars|500 global|y combinator|sfcw|jpm chase|by registering|meetup|conference|mixer|demo day|endorsed by|affiliated with)\b/i;
const NOISE =
  /\b(partnered with several hotels|group rates for attendees|registration page to receive|not affiliated|not sponsored|or endorsed by)\b/i;
const RELEVANT =
  /\b(startup|founder|AI|ML|engineer|tech|developer|hiring|VC|networking|saas|data|cloud|software|YC|mixer)\b/i;
const LOW_RELEVANCE =
  /\b(consulate|hotel|group rates|green business|climate innovation|desertech|jewish|walkathon|token tech walk)\b/i;
const LIFE_SCIENCE =
  /\b(biotech|bio-tech|biopharma|pharma(?:ceuticals?)?|therapeutics|biosciences|genomics|life sciences?|oncology|diagnostics|genentech|gilead|amgen|illumina|moderna|pfizer|novartis|roche|merck|biogen|regeneron|natera|freenome|insitro)\b/i;
const AI_EVENT = /\b(hackathon|llm|openai|anthropic|devtools|developer|founders?|startup|inference|machine learning)\b/i;

const KNOWN_SPONSOR_BRANDS = new Set([
  "OpenAI",
  "Anthropic",
  "Cursor",
  "Replit",
  "Modal",
  "Together AI",
  "Weights & Biases",
  "Hugging Face",
  "Databricks",
  "Stripe",
  "Vercel",
  "Neon",
  "Supabase",
  "Linear",
  "Notion",
  "Google",
  "Vonage",
  "Lovable",
]);

function cityCore(city: string) {
  return city.split(",")[0]?.trim() || city.trim();
}

function roleSearchTerms(event: EventRecord): string {
  const titles = event.roles.map((r) => r.title.trim()).filter((title) => usableRoleTitle(title));
  if (titles.length) return titles.slice(0, 3).join(" ");
  return "tech hiring";
}

function wantsLifeScience(event: EventRecord): boolean {
  return LIFE_SCIENCE.test(`${event.name} ${roleSearchTerms(event)}`);
}

function knownBrand(name: string): string | null {
  const lower = name.toLowerCase();
  return [...KNOWN_SPONSOR_BRANDS].find((brand) => lower === brand.toLowerCase() || lower.startsWith(`${brand.toLowerCase()} `)) ?? null;
}

function roleKeywords(event: EventRecord): string[] {
  const blob = `${roleSearchTerms(event)} ${event.name}`.toLowerCase();
  const stop = new Set(["and", "the", "for", "with", "engineer", "senior", "staff", "lead"]);
  return [...new Set(blob.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !stop.has(w)))];
}

const SEARCH_PAGES = 2;
const EVENT_PAGES_TO_READ = 10;
const MAX_PROSPECTS = 24;

export function buildSponsorSearchQueries(event: EventRecord): string[] {
  const city = cityCore(event.city);
  const niche = roleSearchTerms(event).split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
  const queries = wantsLifeScience(event)
    ? [
        `site:lu.ma ${city} biotech "sponsored by"`,
        `site:lu.ma ${city} "sponsored by"`,
        niche ? `site:lu.ma ${city} ${niche} "sponsored by"` : "",
      ]
    : [
        `site:lu.ma ${city} AI hackathon "sponsored by"`,
        `site:lu.ma ${city} AI meetup "sponsored by"`,
        `site:lu.ma ${city} startup founder "sponsored by"`,
        `site:lu.ma ${city} "sponsored by" hackathon`,
        niche ? `site:lu.ma ${city} ${niche} "sponsored by"` : "",
        `site:luma.com ${city} AI sponsors`,
      ];
  return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

async function tinyfishSearch(
  keys: Keys,
  query: string,
  page: number,
  onWait?: (ms: number) => void,
): Promise<SearchHit[]> {
  const data = (await tinyfishRequest(
    "/api/tinyfish/search",
    {
      method: "POST",
      headers: keyHeaders(keys, { "Content-Type": "application/json" }),
      body: JSON.stringify({ query, page, num_results: 10 }),
    },
    { pace: "search", onWait },
  )) as { results?: { title?: string; url?: string; snippet?: string }[] };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.snippet ?? "",
  }));
}

const SENTENCE_WORD =
  /^(most|accurate|best|please|note|this|your|our|will|with|from|that|than|into|only|just|very|more|some|all|new|top|about|sponsored|hosting|prizes|prize|raffle|featuring|including|include|announced|soon|details|shared)$/i;
const NOT_A_COMPANY =
  /^(sponsors?|hosted|host|hosts|location|registration|about|tracks|agenda|prizes?|event|events|meetup|hackathon|the|and|our|with|for|from|this|note|special|thank|thanks|you|your|please|raffle|ai|past|engineers?|developers?|designers?|researchers?|founders?|operators?|ops|ux|ui|students?|alumni|community|applied|scientists?|managers?|professionals?|speakers?|attendees?|guests?|builders?|developers|pizza|sodas)$/i;

function cleanCompanyName(raw: string, opts?: { allowPerson?: boolean; city?: string }): string | null {
  let name = raw
    .replace(/^[\s​"'(*#]+/, "")
    .replace(/[\s​"'.,:;)*#]+$/, "")
    .replace(/\s+/g, " ")
    .replace(/\.com$/i, "")
    .trim();
  if (/^(or|and|by|on)\s/i.test(name)) return null;
  if (/\s+on\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d)/i.test(name)) {
    name = name.replace(/\s+on\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d).*/i, "").trim();
  }
  if (name.length < 2 || name.length > 48) return null;
  const words = name.split(" ");
  if (words.length > 4 && !KNOWN_SPONSOR_BRANDS.has(name)) return null;
  if (BAD_COMPANY.test(name) || NOT_A_COMPANY.test(name)) return null;
  if (words.some((w) => SENTENCE_WORD.test(w))) return null;
  if (/^y$/i.test(name)) return null;
  if (/\d{4,}/.test(name)) return null;
  if (opts?.city && name.toLowerCase() === opts.city.toLowerCase()) return null;
  const branded =
    KNOWN_SPONSOR_BRANDS.has(name) ||
    /^[A-Z0-9]/.test(name) ||
    /^[a-z0-9][a-z0-9.-]{1,32}(\.(ai|io|dev|co))?(\s+(labs|lab|ai|tech))?$/i.test(name);
  if (!branded) return null;
  if (opts?.allowPerson !== false && looksLikePerson(name)) return null;
  return knownBrand(name) ?? name;
}

function looksLikePerson(name: string): boolean {
  if (KNOWN_SPONSOR_BRANDS.has(name)) return false;
  if (
    /\b(ai|labs|lab|inc|io|hq|vc|capital|ventures|studio|cloud|bio|biosciences|genomics|technologies|tech|therapeutics|sciences|works|robotics|systems|software|network|foundation|group|motif)\b/i.test(
      name,
    )
  )
    return false;
  const parts = name.split(" ");
  return parts.length === 2 && parts.every((p) => /^[A-Z][a-z]{2,14}$/.test(p));
}

function isOwnEvent(company: string, eventTitle: string, blob: string): boolean {
  const c = company.toLowerCase();
  const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sponsored = new RegExp(`(?:co-)?sponsored by[^\\n.]{0,120}\\b${escaped}\\b`, "i").test(blob);
  if (sponsored) return false;
  const title = eventTitle.toLowerCase();
  if (title === c || title.startsWith(`${c} `)) return true;
  return new RegExp(`hosted by[^\\n.]{0,40}\\b${escaped}\\b`, "i").test(blob);
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function takeCompanyPrefix(raw: string): string {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (let i = 0; i < words.length && kept.length < 4; i++) {
    const bare = words[i].replace(/^[("']+|[)"',.;:]+$/g, "");
    if (!bare) break;
    if (/\.(ai|com|io|dev|bio|co)$/i.test(bare)) {
      kept.push(bare);
      break;
    }
    if (/^[a-z]/.test(bare) && !/^(of|the|and)$/i.test(bare)) {
      const next = words[i + 1]?.replace(/^[("']+|[)"',.;:]+$/g, "") ?? "";
      const brand = /^[a-z0-9][a-z0-9.-]{1,30}$/i.test(bare);
      const nextBrand = /^[a-z0-9][a-z0-9.-]{1,24}$/i.test(next) && !NOT_A_COMPANY.test(next) && !SENTENCE_WORD.test(next);
      if (i === 0 && brand && words.length === 1) return bare;
      if (i === 0 && brand && nextBrand && words.length === 2) return `${bare} ${next}`;
      break;
    }
    if (/^(of|the|and)$/i.test(bare)) {
      const next = words[i + 1]?.replace(/[)"',.;:]+$/g, "") ?? "";
      if (i === 0 && !/^the$/i.test(bare)) break;
      if (!/^[A-Z0-9]/.test(next)) break;
      kept.push(bare);
      continue;
    }
    if (!/^[A-Z0-9]/.test(bare) || SENTENCE_WORD.test(bare)) break;
    kept.push(bare);
  }
  return kept.join(" ");
}

function websiteFrom(fragment: string): string {
  const http = fragment.match(/https?:\/\/[^\s)]+/i);
  if (http) {
    try {
      const u = new URL(http[0].replace(/[.,]+$/, ""));
      if (!/linkedin|twitter|x\.com|instagram|facebook|lu\.ma|luma\.com|substack/i.test(u.hostname)) return u.origin;
    } catch {
      /* ignore malformed urls in sponsor lines */
    }
  }
  const dom = fragment.match(/\((?:www\.)?([a-z0-9.-]+\.[a-z]{2,})(?:\/[^)]*)?\)/i);
  if (dom && !/linkedin|substack/i.test(dom[1])) return `https://${dom[1].replace(/^www\./, "")}`;
  return "";
}

type SponsorMention = { company: string; website: string };

function mentionsFromChunk(chunk: string, city: string): SponsorMention[] {
  const lines = chunk
    .split(/\n/)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);
  const fragments: string[] = [];
  for (const line of lines) {
    if (KNOWN_SPONSOR_BRANDS.has(line)) {
      fragments.push(line);
      continue;
    }
    for (const part of line.split(/\s*(?:,|&|\||\band\b)\s*/i)) {
      const trimmed = part.trim();
      if (trimmed) fragments.push(trimmed);
    }
  }
  const multi = fragments.length > 1;
  const found: SponsorMention[] = [];
  for (const fragment of fragments) {
    const label = fragment
      .replace(/\(https?:\/\/[^)]*\)/gi, " ")
      .replace(/\((?:www\.)?[a-z0-9.-]+\.[a-z]{2,}[^)]*\)/gi, " ")
      .replace(/https?:\/\/\S+/gi, " ");
    const company = cleanCompanyName(takeCompanyPrefix(label), { allowPerson: !multi, city });
    if (!company) continue;
    found.push({ company, website: websiteFrom(fragment) });
  }
  return found;
}

function sponsorClause(raw: string): string {
  let clause = raw.replace(/\s+/g, " ").trim();
  clause = clause.split(/\.\s+(?=[A-Z“"])/)[0] ?? clause;
  clause = clause.replace(/[.…]+$/, "").trim();
  if (/[…]\s*$/.test(raw) || /\.\.\.\s*$/.test(raw)) {
    clause = clause.replace(/[,&]?\s*[^,]*$/, "").trim();
  }
  return clause.replace(/[.,;:]+$/, "").trim();
}

export function extractSponsorMentions(text: string, city: string): SponsorMention[] {
  const plain = stripMarkdown(text);
  const chunks: string[] = [];
  for (const match of plain.matchAll(/(?<!not\s)(?<!or\s)(?:co-)?sponsored by[:\s]+([^\n]+)/gi)) {
    const clause = sponsorClause(match[1] ?? "");
    if (clause) chunks.push(clause);
  }

  const lines = plain.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].trim();
    if (!/^#{1,3}\s+.*\bSponsors?\b/i.test(heading) || /\b(not|without)\b/i.test(heading)) continue;
    const buf: string[] = [];
    for (let j = i + 1; j < lines.length && buf.length < 8; j++) {
      const line = lines[j].trim();
      if (!line) {
        if (buf.length) break;
        continue;
      }
      if (/^#{1,3}\s+(Tracks|Agenda|Schedule|Prizes|Judges|Location|About)\b/i.test(line)) break;
      const bare = line.replace(/^#{1,3}\s+/, "");
      if (/^#{1,3}\s+/.test(line) && !/[&,]/.test(bare) && buf.length) break;
      buf.push(bare);
      if (buf.join(" ").length > 500) break;
    }
    if (buf.length) chunks.push(buf.join("\n"));
  }

  for (const match of plain.matchAll(/sponsors?[^\n]{0,120}include:\s*\n((?:\s*[-*]\s+[^\n]+\n?){2,40})/gi)) {
    chunks.push(match[1]);
  }

  const seen = new Set<string>();
  const mentions: SponsorMention[] = [];
  for (const chunk of chunks) {
    for (const mention of mentionsFromChunk(chunk, city)) {
      const key = mention.company.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      mentions.push(mention);
    }
  }
  return mentions;
}

export function shortEventName(hit: Pick<SearchHit, "title" | "snippet">): string | null {
  const titled = (hit.title || hit.snippet || "").split(/\s*[|·]\s*/)[0] ?? "";
  const raw = titled.split(/\s+-\s+/)[0] ?? titled;
  const t = raw
    .replace(/\s*[·|]\s*Luma$/i, "")
    .replace(/#\d+\b/g, " ")
    .replace(/\b(luma|lu\.ma)\b/gi, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/[^\w\s'&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || /^past event$/i.test(t)) return null;
  const words = t.split(" ").filter((w) => w.length > 1).slice(0, 6);
  while (words.length > 2 && /^(san|francisco|nyc|york|new)$/i.test(words[words.length - 1] ?? "")) words.pop();
  if (words.length < 2) return null;
  const name = words
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
  if (/^past event$/i.test(name) || name.length > 48) return null;
  return name;
}

function hitRelevance(blob: string, event: EventRecord): number {
  let score = 0;
  if (RELEVANT.test(blob)) score += 2;
  if (AI_EVENT.test(blob)) score += 3;
  if (roleKeywords(event).some((k) => blob.toLowerCase().includes(k))) score += 2;
  if (cityCore(event.city) && blob.toLowerCase().includes(cityCore(event.city).toLowerCase())) score += 1;
  if (LOW_RELEVANCE.test(blob)) score -= 4;
  if (NOISE.test(blob)) score -= 6;
  if (!wantsLifeScience(event) && LIFE_SCIENCE.test(blob)) score -= 8;
  return score;
}

function cityInBlob(city: string, blob: string): boolean {
  return blob.toLowerCase().includes(city.toLowerCase());
}

type Candidate = {
  company: string;
  website: string;
  events: SponsorEventProof[];
  score: number;
  mentions: number;
};

function mergeCandidate(map: Map<string, Candidate>, next: Candidate) {
  const key = next.company.toLowerCase();
  const prev = map.get(key);
  if (!prev) {
    map.set(key, { ...next, mentions: 1, events: next.events.slice(0, 4) });
    return;
  }
  const urls = new Set(prev.events.map((e) => e.url));
  const events = [...prev.events];
  for (const ev of next.events) {
    if (events.length >= 4) break;
    if (ev.url && !urls.has(ev.url)) {
      urls.add(ev.url);
      events.push(ev);
    }
  }
  map.set(key, {
    ...prev,
    company: prev.company.length <= next.company.length ? prev.company : next.company,
    score: prev.score + next.score,
    mentions: prev.mentions + 1,
    events,
    website: prev.website || next.website,
  });
}

function absorbSponsors(
  map: Map<string, Candidate>,
  items: { title: string; url: string; text: string }[],
  event: EventRecord,
  mode: "snippet" | "page",
) {
  const city = cityCore(event.city);
  for (const item of items) {
    if (!item.url || !LUMA.test(item.url)) continue;
    const blob = `${item.title}\n${item.text}`;
    const sample = mode === "page" ? `${item.title}\n${item.text.slice(0, 1400)}` : blob;
    if (mode === "snippet" && (NOISE.test(blob) || LOW_RELEVANCE.test(blob))) continue;
    if (mode === "snippet" && !/sponsor/i.test(blob)) continue;
    if (mode === "page" && LOW_RELEVANCE.test(sample) && !/sponsor/i.test(sample)) continue;

    const relevance = hitRelevance(mode === "page" ? sample : blob, event);
    if (mode === "snippet" && relevance < 0) continue;

    const name = shortEventName({ title: item.title, snippet: item.text });
    if (!name) continue;
    let baseScore = (mode === "page" ? 65 : 50) + Math.max(0, relevance) * 8;
    if (cityInBlob(city, sample)) baseScore += 15;
    const proof: SponsorEventProof = { name, url: item.url };

    for (const mention of extractSponsorMentions(blob, city)) {
      if (isOwnEvent(mention.company, name, blob)) continue;
      mergeCandidate(map, {
        company: mention.company,
        website: mention.website,
        events: [proof],
        score: baseScore,
        mentions: 0,
      });
    }
  }
}

function lifeScienceProspect(company: string, eventNames: string[]): boolean {
  if (LIFE_SCIENCE.test(company)) return true;
  if (!eventNames.length) return false;
  const lifeEvents = eventNames.filter((name) => LIFE_SCIENCE.test(name)).length;
  return lifeEvents >= Math.ceil(eventNames.length / 2);
}

/** Known AI and dev-tool sponsors first. Life-science names sink unless this event is biotech. */
export function sponsorPriority(company: string, eventNames: string[], event: EventRecord): number {
  if (knownBrand(company)) return 0;
  if (!wantsLifeScience(event) && lifeScienceProspect(company, eventNames)) return 2;
  return 1;
}

function rankCandidates(map: Map<string, Candidate>, event: EventRecord): Candidate[] {
  return [...map.values()]
    .map((c) => ({
      ...c,
      score: c.score + c.mentions * 10 + c.events.length * 8 + (knownBrand(c.company) ? 40 : 0),
    }))
    .filter((c) => c.events.length > 0)
    .filter((c) => !BAD_COMPANY.test(c.company))
    .sort(
      (a, b) =>
        sponsorPriority(a.company, a.events.map((ev) => ev.name), event) -
          sponsorPriority(b.company, b.events.map((ev) => ev.name), event) || b.score - a.score,
    );
}

function eventPageUrls(hits: SearchHit[], event: EventRecord): string[] {
  const city = cityCore(event.city);
  const scored = new Map<string, number>();
  for (const hit of hits) {
    if (!hit.url || !LUMA.test(hit.url) || /\/calendar\b/i.test(hit.url)) continue;
    const blob = `${hit.title}\n${hit.snippet}`;
    if (NOISE.test(blob) || LOW_RELEVANCE.test(blob)) continue;
    let score = hitRelevance(blob, event);
    if (cityInBlob(city, blob)) score += 2;
    if (/sponsor/i.test(blob)) score += 2;
    const prev = scored.get(hit.url);
    if (prev == null || score > prev) scored.set(hit.url, score);
  }
  return [...scored.entries()]
    .filter(([, score]) => score >= 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, EVENT_PAGES_TO_READ)
    .map(([url]) => url);
}

async function fetchEventPages(
  keys: Keys,
  urls: string[],
  onWait?: (ms: number) => void,
): Promise<{ title: string; url: string; text: string }[]> {
  if (!urls.length) return [];
  try {
    const data = (await tinyfishRequest(
      "/api/tinyfish/fetch",
      {
        method: "POST",
        headers: keyHeaders(keys, { "Content-Type": "application/json" }),
        body: JSON.stringify({ urls, format: "markdown" }),
      },
      { onWait },
    )) as { results?: { url?: string; title?: string | null; text?: string | null }[] };
    return (data.results ?? [])
      .map((result) => ({
        url: result.url ?? "",
        title: result.title ?? "",
        text: result.text ?? "",
      }))
      .filter((page) => page.url && page.text);
  } catch {
    return [];
  }
}

export async function discoverSponsorCompanies(
  keys: Keys,
  event: EventRecord,
  onProgress?: (queryIndex: number, queryTotal: number, label: string) => void,
  onWait?: (ms: number) => void,
): Promise<SponsorProspect[]> {
  const queries = buildSponsorSearchQueries(event);
  const jobs = queries.flatMap((query) =>
    Array.from({ length: SEARCH_PAGES }, (_, page) => ({ query, page })),
  );
  const allHits: SearchHit[] = [];

  for (let i = 0; i < jobs.length; i++) {
    onProgress?.(i + 1, jobs.length, "Searching");
    allHits.push(...(await tinyfishSearch(keys, jobs[i].query, jobs[i].page, onWait)));
  }

  const seenUrl = new Set<string>();
  const dedupedHits = allHits.filter((h) => {
    if (!h.url || seenUrl.has(h.url)) return false;
    seenUrl.add(h.url);
    return true;
  });

  const pagesToRead = eventPageUrls(dedupedHits, event);
  onProgress?.(jobs.length, jobs.length, "Reading event pages");
  const pages = await fetchEventPages(keys, pagesToRead, onWait);

  const map = new Map<string, Candidate>();
  absorbSponsors(
    map,
    dedupedHits.map((hit) => ({ title: hit.title, url: hit.url, text: hit.snippet })),
    event,
    "snippet",
  );
  absorbSponsors(map, pages, event, "page");

  return rankCandidates(map, event)
    .filter((c) => c.score >= 70)
    .slice(0, MAX_PROSPECTS)
    .map((c) => ({
      id: crypto.randomUUID(),
      company: c.company,
      contactFirstName: "",
      website: c.website,
      sponsoredEvents: c.events,
    }));
}

export const SEED_SPONSOR_BRANDS = [...KNOWN_SPONSOR_BRANDS];
