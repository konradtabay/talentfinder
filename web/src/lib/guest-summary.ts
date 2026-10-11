import type { Guest } from "./guests";

const TITLE_RE =
  /\b((?:senior|staff|principal|lead|founding|head of)\s+)?((?:machine learning|ml|artificial intelligence|ai|software|data|product|growth|gtm|full[- ]stack|frontend|backend|infra(?:structure)?)\s+)?(engineer|swe|scientist|researcher|manager|mananger|founder|pm|designer|recruiter|developer|technician|teacher|chairman|analyst)\b/i;

const SHORT_TITLE = /^(?:senior|staff|principal|lead|founding)\s+(?:ML|AI|SWE|PM|EM|GTM)$|^(?:ML|AI|SWE|PM|EM|GTM)$/i;

const COMPANY_SECOND =
  /^(inc|llc|ltd|labs|lab|ai|io|security|systems|health|bank|chase|capital|research|analytics|cloud|group|co|technologies|tech|networks|software|robotics|advertising|restaurants)$/i;

export type ProfileFacts = {
  title: string;
  company: string;
  past: string[];
  blob: string;
  craftTitle: boolean;
};

function tidy(raw: string): string {
  return raw
    .replace(/[\u2026.]{2,}/g, " ")
    .replace(/\s*\|\s*LinkedIn\b/gi, "")
    .replace(/\bLinkedIn\b/gi, " ")
    .replace(/\b(view|profile|experience)\b/gi, " ")
    .replace(/[|·•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripName(text: string, guest: Guest): string {
  const names = [guest.fullName, `${guest.firstName} ${guest.lastName}`, guest.firstName, guest.lastName]
    .map((n) => n.trim())
    .filter((n) => n.length > 2);
  let out = text;
  for (const name of names) {
    out = out.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }
  return out.replace(/^[\s\-–—:]+/, "").replace(/\s+/g, " ").trim();
}

function shortenTitle(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  t = t.replace(/\bmachine learning\b/gi, "ML");
  t = t.replace(/\bartificial intelligence\b/gi, "AI");
  t = t.replace(/\bsoftware engineer\b/gi, "SWE");
  t = t.replace(/\bproduct manager\b/gi, "PM");
  t = t.replace(/\bengineering manager\b/gi, "EM");
  t = t.replace(/\bgo[- ]to[- ]market\b/gi, "GTM");
  t = t.replace(/\b(senior|staff|principal|lead|founding)\s+(ML|AI|SWE)\s+engineer\b/gi, "$1 $2");
  t = t.replace(/\b(ML|AI|SWE)\s+engineer\b/gi, "$1");
  t = t.replace(/\s+at$/i, "").replace(/\s+/g, " ").trim();
  return t;
}

function misleadingMl(title: string, blob: string): boolean {
  if (!/\bML\b/.test(title)) return false;
  const marketing = /\b(brand|marketing|social|advertising|growth)\b/i.test(blob);
  const mlWork = /\b(machine learning|deep learning|pytorch|tensorflow|ml engineer|model)\b/i.test(blob);
  return marketing && !mlWork;
}

export function companyFromPhrase(raw: string): string | null {
  let c = tidy(raw).replace(/^(ex[- ]|at|@)\s*/i, "").trim();
  c = c.split(/[,.|]|\s+(?:previously|formerly|ex[- ]|and)\s+/i)[0]?.trim() ?? "";
  c = c.replace(/^(a|an|the)\s+/i, "").replace(/[.,;:]+$/, "").trim();
  if (/^(senior|staff|principal|lead|machine|software|proto|general|looking|building)\b/i.test(c)) return null;
  const words = c.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const w of words) {
    if (kept.length >= 3) break;
    if (kept.length > 0 && !COMPANY_SECOND.test(w)) break;
    if (/^(engineer|manager|mananger|scientist|developer|technician|teacher|analyst|proto)$/i.test(w)) break;
    kept.push(w.replace(/[.,;:]+$/, ""));
  }
  c = kept.join(" ").trim();
  if (c.length < 2 || c.length > 32) return null;
  if (!/^[A-Z0-9&]/.test(c)) return null;
  if (/^(international|company|inc|llc|biography|update|across)$/i.test(c)) return null;
  if (/\b(looking|forward|quality|biography|update|across|ministration|building)\b/i.test(c)) return null;
  return c;
}

function usableTitle(raw: string, blob: string): string {
  let t = shortenTitle(raw);
  if (misleadingMl(t, blob)) t = t.replace(/\bML\b/g, "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 42) return "";
  if (/\b(looking|forward|quality|ministration|biography|update|across)\b/i.test(t)) return "";
  if (!SHORT_TITLE.test(t) && !TITLE_RE.test(t)) return "";
  return t;
}

function parseCurrent(text: string): { title: string; company: string } | null {
  const at = text.match(new RegExp(`${TITLE_RE.source}\\s+at\\s+(.+)`, "i"));
  if (!at) return null;
  const company = companyFromPhrase(at[4] ?? "");
  const title = usableTitle(`${at[1] ?? ""} ${at[2] ?? ""} ${at[3] ?? ""}`, text);
  if (!company || !title) return null;
  return { title, company };
}

function companyAfterAt(text: string): string | null {
  const match = text.match(/\bat\s+([A-Z][^.]{1,48})/);
  return match ? companyFromPhrase(match[1] ?? "") : null;
}

function parsePast(text: string, current?: string): string[] {
  const re =
    /(?:previously|formerly|ex[- ]@)\s+([A-Z][A-Za-z0-9&'.-]{1,24}(?:\s+[A-Z][A-Za-z0-9&'.-]{1,24}){0,2})/gi;
  const names: string[] = [];
  for (const match of text.matchAll(re)) {
    const company = companyFromPhrase(match[1] ?? "");
    if (company) names.push(company);
  }
  const currentKey = current?.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (/^mle\d*$/i.test(key)) continue;
    if (currentKey && (key === currentKey || currentKey.includes(key) || key.includes(currentKey))) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 2) break;
  }
  return out;
}

export function profileFacts(g: Guest): ProfileFacts {
  const blob = stripName(
    tidy(
      [g.enrichment.headline, g.enrichment.currentTitle, g.enrichment.currentCompany, g.enrichment.snippet, g.roleInterest, g.company]
        .filter(Boolean)
        .join(". "),
    ),
    g,
  );

  const parsed = parseCurrent(blob);
  const title =
    parsed?.title ||
    usableTitle(stripName(g.enrichment.currentTitle || g.roleInterest, g), blob);
  const company =
    parsed?.company ||
    companyFromPhrase(g.enrichment.currentCompany) ||
    companyFromPhrase(g.company) ||
    companyAfterAt(blob) ||
    "";
  const past = parsePast(blob, company);
  return {
    title,
    company,
    past,
    blob,
    craftTitle: Boolean(title) && (SHORT_TITLE.test(title) || TITLE_RE.test(title)),
  };
}

export function guestSummary(g: Guest): string {
  const facts = profileFacts(g);
  if (!facts.title && !facts.company) return "—";
  if (!facts.title) return facts.company;
  if (!facts.company) return facts.title;
  const head = `${facts.title} at ${facts.company}`;
  if (!facts.past.length) return head;
  return `${head}, ex @ ${facts.past.join(", ")}`;
}
