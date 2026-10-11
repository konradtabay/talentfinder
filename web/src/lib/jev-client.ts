import { keyHeaders } from "./api-client";
import type { Role } from "./events";
import { profileFacts } from "./guest-summary";
import type { Keys } from "./keys";
import type {
  AttendeeKind,
  CompanySignal,
  ConnectionFit,
  FitResult,
  Guest,
  PlaceFit,
  SchoolFit,
  SeniorityFit,
} from "./guests";

const TOP_SCHOOLS =
  "MIT, Stanford, CMU, UC Berkeley, Caltech, Princeton, Harvard, UIUC, Georgia Tech, University of Washington, Cornell, UCLA, UCSD, UT Austin, Michigan, Columbia, Yale, Waterloo, Toronto, UBC, ETH Zurich, Oxford, Cambridge, EPFL, NUS, Tsinghua, Peking, IIT Bombay, IIT Delhi, IIT Madras, Technion";

const FAANG =
  "Google, Meta, Apple, Amazon, Netflix, Microsoft, plus OpenAI, Anthropic, DeepMind, NVIDIA";
const TECH_COMPANIES =
  "Stripe, Databricks, Snowflake, Figma, Airbnb, Uber, Coinbase, Ramp, Scale, Hugging Face, Palantir, Shopify, Cloudflare, Plaid, Notion, Linear, Vercel, Tesla, SpaceX";
const OLD_CORPORATE =
  "IBM, Oracle, Cisco, SAP, Dell, HP, HPE, Intel, Accenture, Deloitte, Infosys, TCS, Wipro, Cognizant, Capgemini, DXC, banks, and other legacy enterprise";

const REVIEW_THRESHOLD = 0.6;

function noulBool(raw: unknown): { value: boolean; confidence: number } {
  const n = typeof raw === "number" ? raw : Number((raw as { noul?: number })?.noul ?? raw);
  if (Number.isNaN(n)) return { value: false, confidence: 0 };
  const value = n >= 0.5;
  const confidence = value ? n : 1 - n;
  return { value, confidence };
}

function readAnswer(payload: unknown, key: string): { value: unknown; confidence: number } {
  const root = payload as Record<string, unknown>;
  const answers = (root.answers ?? root) as Record<string, unknown>;
  const entry = answers[key];
  if (entry == null) return { value: null, confidence: 0 };
  if (typeof entry !== "object") return { value: entry, confidence: 0.5 };
  const obj = entry as Record<string, unknown>;
  if ("choice" in obj) {
    return {
      value: obj.choice,
      confidence: Number(obj.confidence ?? obj.probability ?? 0.7),
    };
  }
  if ("score" in obj) {
    return {
      value: Number(obj.score),
      confidence: Number(obj.confidence ?? 0.7),
    };
  }
  if ("noul" in obj) return noulBool(obj.noul);
  return { value: entry, confidence: 0.5 };
}

export function buildProfileText(guest: Guest, roles: Role[], eventCity: string): string {
  const lines = [
    eventCity ? `Event city: ${eventCity}` : "",
    `Name: ${guest.fullName}`,
    guest.company ? `Company from registration: ${guest.company}` : "",
    guest.roleInterest ? `Role interest answer: ${guest.roleInterest}` : "",
    guest.linkedinUrl ? `LinkedIn URL (do not browse): ${guest.linkedinUrl}` : "",
    guest.enrichment.headline ? `Headline: ${guest.enrichment.headline}` : "",
    guest.enrichment.currentTitle ? `Current title: ${guest.enrichment.currentTitle}` : "",
    guest.enrichment.currentCompany ? `Current company: ${guest.enrichment.currentCompany}` : "",
    guest.enrichment.snippet ? `Search snippets:\n${guest.enrichment.snippet}` : "",
    roles.length
      ? `Open roles:\n${roles.map((r) => `- ${r.title}${r.mustHaves ? `: ${r.mustHaves.slice(0, 400)}` : ""}`).join("\n")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function runFitCheck(keys: Keys, guest: Guest, roles: Role[], eventCity = ""): Promise<FitResult> {
  if (!roles.length) {
    throw new Error("Add at least one role before running fit check.");
  }

  const criteria: Record<string, string> = { none: "No open role is a good match" };
  for (const r of roles) criteria[r.id] = r.title;

  const res = await fetch("/api/jev", {
    method: "POST",
    headers: keyHeaders(keys, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      state: buildProfileText(guest, roles, eventCity),
      questions: {
        best_role: {
          type: "choice",
          instructions:
            "Which open role matches work they have actually done? Choose none if their craft is a different function.",
          criteria,
        },
        attendee_kind: {
          type: "choice",
          instructions:
            "Why is this person likely at a hiring event? Students and new grads can still be hires. own_founder = currently running their own company.",
          criteria: {
            hire: "Could join one of the open roles, including students and new grads",
            own_founder: "Currently a founder or CEO of their own company",
            investor: "Investor, VC, or angel",
            recruiter: "Recruiter or talent partner hiring for someone else",
            vendor: "Sales, agency, sponsor, or service provider",
            student: "Currently a student or new grad",
            other: "Community, press, or unclear",
          },
        },
        school: {
          type: "choice",
          instructions: `Rate their school. strong ONLY if it is one of these tech programs or a peer: ${TOP_SCHOOLS}. relevant = a real degree in the craft from another university. Do not call a school strong just because they have a degree. unknown if no school is mentioned.`,
          criteria: {
            strong: "Named top tech program",
            relevant: "Real degree in the craft, not a top program",
            unrelated: "Education is in a different field",
            unknown: "No school mentioned",
          },
        },
        company_signal: {
          type: "choice",
          instructions: `Rank the employer, not the job title. faang = ${FAANG}. tech = a modern product tech company such as ${TECH_COMPANIES}. startup = Series A or later startup, or they owned the product as a founder or early engineer. corporate = old enterprise such as ${OLD_CORPORATE}. IBM is corporate, never faang or tech. generic = unknown company with no ownership. agency = consultancy or staff aug.`,
          criteria: {
            faang: "Google, Meta, Apple, Amazon, Netflix, Microsoft, or a top AI lab",
            tech: "Modern product tech company",
            startup: "Series A startup or they owned what they built",
            corporate: "Old corporate or legacy enterprise, including IBM",
            generic: "Unknown company, no ownership",
            agency: "Consultancy or staff aug",
          },
        },
        connections: {
          type: "choice",
          instructions:
            "Use an explicit LinkedIn connection count if the text has one. high = 500 or more. thin = any number under 500 (including a few hundred). unknown = no count in the text. A senior title with a few hundred connections is thin, not high.",
          criteria: {
            high: "500 or more connections",
            thin: "Under 500 connections",
            unknown: "No connection count",
          },
        },
        place: {
          type: "choice",
          instructions: `Where are they based relative to the event city (${eventCity || "unknown"})? event_city = that city or its metro. event_country = same country, different city. elsewhere = another country. unknown = no location mentioned.`,
          criteria: {
            event_city: "Event city or its metro",
            event_country: "Same country, different city",
            elsewhere: "Another country",
            unknown: "No location mentioned",
          },
        },
        craft_match: {
          type: "noul",
          instructions:
            "In the last few years, have they personally done the craft of the best role (built, sold, or operated it), not only managed or advised it?",
        },
        builder: {
          type: "noul",
          instructions:
            "Have they shipped as an individual contributor or early-team operator, including at a startup or team under about 100 people?",
        },
        open_to_move: {
          type: "noul",
          instructions:
            "Is there a sign they might take a job: registration says they are open, between roles, or the title is a close match rather than a settled executive?",
        },
        seniority: {
          type: "choice",
          instructions:
            "Compare their level to the best role. too_senior means VP or C-level for an IC seat. Students and new grads are match when the role can take an early hire, and too_junior only when the role clearly needs years of experience.",
          criteria: {
            too_junior: "Clearly below the role",
            match: "Within about one level of the role",
            too_senior: "Far above the role, unlikely to take it",
          },
        },
        location_ok: {
          type: "noul",
          instructions: "Is their location or a remote setup compatible with the role and this event's city?",
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Fit check failed (${res.status})`);
  }

  const data = await res.json();
  const best = readAnswer(data, "best_role");
  const kindRaw = String(readAnswer(data, "attendee_kind").value ?? "other") as AttendeeKind;
  const attendeeKind: AttendeeKind = [
    "hire",
    "investor",
    "recruiter",
    "vendor",
    "student",
    "own_founder",
    "other",
  ].includes(kindRaw)
    ? kindRaw
    : "other";
  const craft = readAnswer(data, "craft_match");
  const builder = readAnswer(data, "builder");
  const openToMove = readAnswer(data, "open_to_move");
  const facts = profileFacts(guest);
  const seniorityRaw = String(readAnswer(data, "seniority").value ?? "match") as SeniorityFit;
  const seniority: SeniorityFit = seniorityFromTitle(
    facts.title,
    ["too_junior", "match", "too_senior"].includes(seniorityRaw) ? seniorityRaw : "match",
  );
  const location = readAnswer(data, "location_ok");
  const schoolRaw = String(readAnswer(data, "school").value ?? "unknown") as SchoolFit;
  const school: SchoolFit = confirmedSchool(
    facts.blob,
    ["strong", "relevant", "unrelated", "unknown"].includes(schoolRaw) ? schoolRaw : "unknown",
  );
  const placeRaw = String(readAnswer(data, "place").value ?? "unknown") as PlaceFit;
  const place: PlaceFit = ["event_city", "event_country", "elsewhere", "unknown"].includes(placeRaw)
    ? placeRaw
    : "unknown";
  const companySignal = companySignalFit(
    facts.company,
    String(readAnswer(data, "company_signal").value ?? "generic"),
    facts.blob,
  );
  const connections = connectionFit(
    [guest.enrichment.snippet, guest.enrichment.headline].filter(Boolean).join("\n"),
    String(readAnswer(data, "connections").value ?? "unknown"),
  );

  const roleId = String(best.value ?? "none");
  const roleTitle = roleId === "none" ? "none" : roles.find((r) => r.id === roleId)?.title ?? roleId;
  const craftMatch = Boolean(craft.value) && roleId !== "none";
  const schoolHelps = school === "strong" || school === "relevant";
  const isStudent = attendeeKind === "student";
  const isCandidate = (attendeeKind === "hire" && craftMatch) || (isStudent && (craftMatch || schoolHelps));

  const confidences = [best.confidence, craft.confidence, builder.confidence, openToMove.confidence, location.confidence];
  const confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

  const past = pastElite(facts.blob, facts.company);
  const rank = finalizeRank(
    scoreFit({
      attendeeKind,
      craftMatch,
      builder: Boolean(builder.value),
      openToMove: Boolean(openToMove.value),
      seniority,
      locationOk: Boolean(location.value) || place === "event_city" || place === "event_country",
      hasRole: roleId !== "none",
      school,
      place,
      companySignal,
      connections,
      pastFaang: past.faang,
      pastTech: past.tech,
    }),
    {
      hasEvidence: Boolean(facts.title || facts.company),
      craftTitle: facts.craftTitle,
      company: facts.company,
      companySignal,
      school,
    },
  );

  const needsReview =
    confidence < REVIEW_THRESHOLD || (attendeeKind === "hire" && !craftMatch) || (isStudent && !craftMatch && !schoolHelps);

  return {
    bestRole: roleTitle,
    rank,
    fitScore: Math.max(1, Math.round(rank / 20)),
    attendeeKind,
    seniority,
    craftMatch,
    builder: Boolean(builder.value),
    openToMove: Boolean(openToMove.value),
    school,
    place,
    companySignal,
    connections,
    seniorityMatch: seniority === "match",
    locationOk: Boolean(location.value),
    isCandidate,
    confidence,
    needsReview,
  };
}

const FAANG_RE =
  /\b(google|meta|facebook|apple|amazon|netflix|microsoft|deepmind|openai|anthropic|nvidia)\b/i;
const TECH_RE =
  /\b(stripe|databricks|snowflake|figma|airbnb|uber|coinbase|ramp|hugging face|palantir|shopify|cloudflare|plaid|notion|vercel|spacex|tesla|pinterest|asml)\b/i;
const CORPORATE_RE =
  /\b(ibm|oracle|cisco|sap|dell|hewlett|\bhpe\b|\bhp\b|intel)\b/i;
const AGENCY_RE =
  /\b(accenture|deloitte|infosys|tcs|wipro|cognizant|capgemini|dxc|unisys|birlasoft|hcl|tech mahindra|mphasis|ltimindtree|globant|epam|thoughtworks)\b/i;
const BANK_RE =
  /\b(jpmorgan|j\.?\s*p\.?\s*morgan|jp morgan|goldman|morgan stanley|bank of america|wells fargo|citibank|\bciti\b|hsbc|barclays|deutsche bank|\bubs\b)\b/i;
const TOP_SCHOOL_RE =
  /\b(mit|stanford|carnegie mellon|cmu|berkeley|caltech|princeton|harvard|uiuc|georgia tech|university of washington|cornell|ucla|ucsd|ut austin|university of michigan|columbia|yale|waterloo|university of toronto|ubc|eth zurich|oxford|cambridge|epfl|nus|tsinghua|peking|iit bombay|iit delhi|iit madras|technion)\b/i;

function allowedSignal(value: string): CompanySignal {
  const mapped: CompanySignal = value === "elite" ? "faang" : value === "strong" ? "tech" : (value as CompanySignal);
  const allowed: CompanySignal[] = ["faang", "tech", "startup", "corporate", "generic", "agency"];
  return allowed.includes(mapped) ? mapped : "generic";
}

const OWNER_RE = /\b(co-?founder|founder|founding engineer)\b/i;

/** Current employer only. The model cannot promote an unknown company to tech or startup. */
export function companySignalFit(currentCompany: string, modelValue: string, blob = ""): CompanySignal {
  const text = currentCompany.trim();
  const mapped = allowedSignal(modelValue);
  if (AGENCY_RE.test(text)) return "agency";
  if (CORPORATE_RE.test(text) || BANK_RE.test(text)) return "corporate";
  if (FAANG_RE.test(text)) return "faang";
  if (TECH_RE.test(text)) return "tech";
  if (text && ownsThisCompany(text, blob)) return "startup";
  if (mapped === "agency" || mapped === "corporate") return mapped;
  return "generic";
}

function ownsThisCompany(company: string, blob: string): boolean {
  if (!OWNER_RE.test(blob)) return false;
  const name = company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b(?:co-?founder|founder|founding engineer)\\b(?:\\s+at)?\\s+${name}\\b|\\b${name}\\b\\s+(?:co-?founder|founder)`, "i").test(
    blob,
  );
}

export function confirmedSchool(blob: string, model: SchoolFit): SchoolFit {
  if (TOP_SCHOOL_RE.test(blob)) return "strong";
  if (model === "strong") return "relevant";
  return model;
}

export function seniorityFromTitle(title: string, model: SeniorityFit): SeniorityFit {
  if (/\b(vp|vice president|chief|ceo|cto|cfo|coo|director|head of|general man)/i.test(title)) {
    return model === "too_junior" ? model : "too_senior";
  }
  if (/\b(senior|staff|principal|lead)\b/i.test(title) && model === "too_senior") return "match";
  return model;
}

function pastElite(blob: string, current: string): { faang: boolean; tech: boolean } {
  const past = [...blob.matchAll(/(?:ex[- ]@|previously(?:\s+at)?|formerly(?:\s+at)?)\s+([^.]{2,48})/gi)]
    .map((m) => m[1] ?? "")
    .join(" ");
  const currentKey = current.trim();
  const text = currentKey ? past.replace(new RegExp(currentKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ") : past;
  return { faang: FAANG_RE.test(text), tech: TECH_RE.test(text) };
}

function listedEmployer(company: string): boolean {
  return (
    AGENCY_RE.test(company) ||
    CORPORATE_RE.test(company) ||
    BANK_RE.test(company) ||
    FAANG_RE.test(company) ||
    TECH_RE.test(company)
  );
}

function finalizeRank(
  score: number,
  input: {
    hasEvidence: boolean;
    craftTitle: boolean;
    company: string;
    companySignal: CompanySignal;
    school: SchoolFit;
  },
): number {
  let next = score;
  if (!input.hasEvidence) next = Math.min(next, 14);
  else if (!input.craftTitle && !listedEmployer(input.company)) next = Math.min(next, 40);
  const strongEmployer =
    input.companySignal === "faang" || input.companySignal === "tech" || input.companySignal === "startup";
  if (!strongEmployer && input.school !== "strong") {
    const cap =
      input.companySignal === "agency" ? 22 : input.companySignal === "corporate" ? 30 : input.school === "relevant" ? 44 : 34;
    next = Math.min(next, cap);
  }
  return Math.max(0, Math.min(100, next));
}

export function connectionFit(text: string, modelValue: string): ConnectionFit {
  const labeled = text.match(/(\d[\d,]*)\+?\s+connections/i);
  if (labeled) {
    const n = Number(labeled[1].replace(/,/g, ""));
    if (!Number.isNaN(n)) return n >= 500 ? "high" : "thin";
  }
  if (modelValue === "high" || modelValue === "thin") return modelValue;
  return "unknown";
}

/** Company and school decide the rank. Craft, city, and connections only break ties. */
export function scoreFit(input: {
  attendeeKind: AttendeeKind;
  craftMatch: boolean;
  builder: boolean;
  openToMove: boolean;
  seniority: SeniorityFit;
  locationOk: boolean;
  hasRole: boolean;
  school: SchoolFit;
  place: PlaceFit;
  companySignal: CompanySignal;
  connections: ConnectionFit;
  pastFaang?: boolean;
  pastTech?: boolean;
}): number {
  if (input.attendeeKind === "investor" || input.attendeeKind === "recruiter" || input.attendeeKind === "vendor") {
    return 8;
  }
  if (input.attendeeKind === "own_founder") return 28;
  if (input.attendeeKind === "other" || (!input.hasRole && input.attendeeKind !== "student")) return 10;

  const proven =
    input.companySignal === "faang" ||
    input.companySignal === "tech" ||
    input.companySignal === "startup" ||
    input.school === "strong";
  let score = 6;
  if (input.craftMatch) score += 6;
  if (input.companySignal === "faang") score += 42;
  if (input.companySignal === "tech") score += 34;
  if (input.companySignal === "startup") score += 30;
  if (input.companySignal === "corporate") score -= 16;
  if (input.companySignal === "agency") score -= 20;
  if (input.pastFaang && input.companySignal !== "faang") score += 12;
  if (input.pastTech && input.companySignal !== "faang" && input.companySignal !== "tech") score += 6;
  if (input.school === "strong") score += 38;
  if (input.school === "relevant") score += 6;
  if (input.school === "unrelated") score -= 6;
  if (input.builder && proven) score += 4;
  if (input.openToMove) score += 2;
  if (input.seniority === "too_senior") score -= 12;
  if (input.connections === "high") score += 3;
  if (input.connections === "thin") score -= proven ? 2 : 8;
  if (input.place === "event_city") score += 3;
  else if (input.place === "event_country") score += 1;
  else if (input.place === "elsewhere") score -= 8;
  else if (!input.locationOk) score -= 4;
  return Math.max(0, Math.min(100, score));
}

/** Re-rank a stored fit from the current employer, not a name-drop in the bio. */
export function scoreGuest(g: Guest): number {
  if (!g.fit) return 0;
  const facts = profileFacts(g);
  const companySignal = companySignalFit(facts.company, g.fit.companySignal, facts.blob);
  const school = confirmedSchool(facts.blob, g.fit.school);
  const seniority = seniorityFromTitle(facts.title, g.fit.seniority);
  const past = pastElite(facts.blob, facts.company);
  return finalizeRank(
    scoreFit({
      attendeeKind: g.fit.attendeeKind,
      craftMatch: g.fit.craftMatch,
      builder: g.fit.builder,
      openToMove: g.fit.openToMove,
      seniority,
      locationOk: g.fit.locationOk || g.fit.place === "event_city" || g.fit.place === "event_country",
      hasRole: g.fit.bestRole !== "none" && Boolean(g.fit.bestRole),
      school,
      place: g.fit.place,
      companySignal,
      connections: g.fit.connections,
      pastFaang: past.faang,
      pastTech: past.tech,
    }),
    {
      hasEvidence: Boolean(facts.title || facts.company),
      craftTitle: facts.craftTitle,
      company: facts.company,
      companySignal,
      school,
    },
  );
}

export async function matchNoteToGuest(
  keys: Keys,
  noteText: string,
  guests: Guest[],
): Promise<{ guestId: string | null; confidence: number }> {
  if (!guests.length) return { guestId: null, confidence: 0 };

  const criteria: Record<string, string> = { none: "No attendee matches this conversation" };
  for (const g of guests) {
    criteria[g.id] = `${g.fullName}${g.company ? ` (${g.company})` : ""}`;
  }

  const res = await fetch("/api/jev", {
    method: "POST",
    headers: keyHeaders(keys, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      state: `Event conversation notes:\n${noteText.slice(0, 4000)}`,
      questions: {
        attendee: {
          type: "choice",
          instructions:
            "Which registered event attendee is the external guest in this conversation? Pick none if unclear.",
          criteria,
        },
      },
    }),
  });

  if (!res.ok) return { guestId: null, confidence: 0 };
  const data = await res.json();
  const pick = readAnswer(data, "attendee");
  const id = String(pick.value ?? "none");
  if (id === "none") return { guestId: null, confidence: pick.confidence };
  return { guestId: id, confidence: pick.confidence };
}
