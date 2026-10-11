import Papa from "papaparse";
import { guestSummary } from "./guest-summary";
import { emptyGuest, type Guest } from "./guests";
import { scoreGuest } from "./jev-client";
import { guestLinkedInHref } from "./linkedin";

function normHeader(h: string) {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normHeader(k), (v ?? "").trim());
  }
  for (const key of keys) {
    const v = map.get(normHeader(key));
    if (v) return v;
  }
  for (const [k, v] of map) {
    if (keys.some((key) => k.includes(normHeader(key)))) return v;
  }
  return "";
}

function parseCheckedIn(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s || s === "-" || s === "—" || s === "n/a" || s === "na" || s === "null") return false;
  if (s === "no" || s === "false" || s === "0" || s.includes("not checked") || s.includes("no show") || s.includes("no-show")) {
    return false;
  }
  // Luma's guest export uses checked_in_at: a timestamp when they scanned in, blank when they didn't.
  return true;
}

export function parseLumaCsv(text: string): Guest[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "Could not read CSV");
  }

  const byEmail = new Map<string, Guest>();

  for (const row of parsed.data) {
    const email = pick(row, "email", "guest email").toLowerCase();
    if (!email) continue;

    const name = pick(row, "name", "full name", "guest name");
    const first = pick(row, "first name", "first");
    const last = pick(row, "last name", "last");
    const fullName = name || [first, last].filter(Boolean).join(" ");

    const linkedin = pick(row, "linkedin", "linkedin profile", "linkedin url", "social profile");
    const company = pick(row, "company", "organization");
    const github = pick(row, "github", "website", "portfolio");
    const roleInterest = pick(row, "which role", "role interest", "open to new roles");
    const approval = pick(row, "approval status", "status", "approval_status");
    const checkRaw = pick(
      row,
      "checked in at",
      "check in at",
      "checked in time",
      "check-in status",
      "check in status",
      "checked in",
      "join status",
    );

    const guest = emptyGuest({
      id: crypto.randomUUID(),
      email,
      fullName: fullName || email.split("@")[0],
      firstName: first,
      lastName: last,
      approvalStatus: approval,
      checkedIn: parseCheckedIn(checkRaw),
      linkedinUrl: linkedin,
      company,
      githubUrl: github,
      roleInterest,
    });

    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, guest);
      continue;
    }
    byEmail.set(email, {
      ...existing,
      checkedIn: existing.checkedIn || guest.checkedIn,
      linkedinUrl: existing.linkedinUrl || guest.linkedinUrl,
      company: existing.company || guest.company,
      approvalStatus: guest.approvalStatus || existing.approvalStatus,
    });
  }

  return [...byEmail.values()];
}

export function mergeGuests(existing: Guest[], incoming: Guest[]): Guest[] {
  const map = new Map(existing.map((g) => [g.email, g]));
  for (const g of incoming) {
    const prev = map.get(g.email);
    if (!prev) {
      map.set(g.email, g);
      continue;
    }
    map.set(g.email, {
      ...prev,
      fullName: g.fullName || prev.fullName,
      firstName: g.firstName || prev.firstName,
      lastName: g.lastName || prev.lastName,
      approvalStatus: g.approvalStatus || prev.approvalStatus,
      checkedIn: g.checkedIn || prev.checkedIn,
      linkedinUrl: g.linkedinUrl || prev.linkedinUrl,
      company: g.company || prev.company,
      githubUrl: g.githubUrl || prev.githubUrl,
      roleInterest: g.roleInterest || prev.roleInterest,
      enrichment: prev.enrichment.enrichedAt ? prev.enrichment : g.enrichment,
      fit: prev.fit ?? g.fit,
      decision: prev.decision !== "pending" ? prev.decision : g.decision,
      connectSent: prev.connectSent,
      noteLine: prev.noteLine || g.noteLine,
      followedUp: prev.followedUp,
      replied: prev.replied,
      inPipeline: prev.inPipeline,
    });
  }
  return [...map.values()];
}

export function lumaBulkStatusCsv(guests: Guest[]): string {
  const rows = guests
    .filter((g) => g.decision === "accept" || g.decision === "decline" || g.decision === "waitlist")
    .map((g) => ({
      email: g.email,
      status: g.decision === "accept" ? "Going" : g.decision === "waitlist" ? "Waitlist" : "Not Going",
    }));
  return Papa.unparse(rows);
}

const PIPELINE_COLUMNS = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "linkedin_url",
  "github_url",
  "company",
  "current_title",
  "headline",
  "summary",
  "role_interest",
  "best_role",
  "fit_percent",
  "decision",
  "attendee_kind",
  "school",
  "company_signal",
  "seniority",
  "place",
  "connections",
  "craft_match",
  "builder",
  "open_to_move",
  "is_candidate",
  "needs_review",
  "confidence",
  "approval_status",
  "checked_in",
  "connect_sent",
  "followed_up",
  "replied",
  "in_pipeline",
  "note",
  "profile_text",
  "event_name",
  "event_date",
  "event_city",
  "enriched_at",
] as const;

function yn(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}

function cell(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function profileUrl(guest: Guest): string {
  const raw = guest.linkedinUrl.trim();
  if (!raw.includes("linkedin.com")) return "";
  return guestLinkedInHref(guest);
}

export function pipelineExportCsv(
  event: { name: string; date: string; city: string },
  guests: Guest[],
): string {
  const rows = [...guests]
    .sort((a, b) => {
      const stage = Number(b.inPipeline) - Number(a.inPipeline);
      if (stage !== 0) return stage;
      return scoreGuest(b) - scoreGuest(a);
    })
    .map((g) => {
      const fit = g.fit;
      const summary = guestSummary(g);
      return {
        first_name: g.firstName,
        last_name: g.lastName,
        full_name: g.fullName,
        email: g.email,
        linkedin_url: profileUrl(g),
        github_url: g.githubUrl.trim(),
        company: cell(g.enrichment.currentCompany || g.company),
        current_title: cell(g.enrichment.currentTitle),
        headline: cell(g.enrichment.headline),
        summary: summary === "—" ? "" : summary,
        role_interest: cell(g.roleInterest),
        best_role: fit?.bestRole && fit.bestRole !== "none" ? fit.bestRole : "",
        fit_percent: fit ? String(scoreGuest(g)) : "",
        decision: g.decision,
        attendee_kind: fit?.attendeeKind ?? "",
        school: fit?.school ?? "",
        company_signal: fit?.companySignal ?? "",
        seniority: fit?.seniority ?? "",
        place: fit?.place ?? "",
        connections: fit?.connections ?? "",
        craft_match: fit ? yn(fit.craftMatch) : "",
        builder: fit ? yn(fit.builder) : "",
        open_to_move: fit ? yn(fit.openToMove) : "",
        is_candidate: fit ? yn(fit.isCandidate) : "",
        needs_review: fit ? yn(fit.needsReview) : "",
        confidence: fit ? String(Math.round(fit.confidence * 100)) : "",
        approval_status: g.approvalStatus,
        checked_in: yn(g.checkedIn),
        connect_sent: yn(g.connectSent),
        followed_up: yn(g.followedUp),
        replied: yn(g.replied),
        in_pipeline: yn(g.inPipeline),
        note: cell(g.noteLine),
        profile_text: cell(g.enrichment.snippet).slice(0, 2000),
        event_name: event.name,
        event_date: event.date,
        event_city: event.city,
        enriched_at: g.enrichment.enrichedAt ?? "",
      };
    });

  const body = Papa.unparse(
    {
      fields: [...PIPELINE_COLUMNS],
      data: rows.map((row) => PIPELINE_COLUMNS.map((column) => row[column])),
    },
    { newline: "\r\n" },
  );
  return `\uFEFF${body}`;
}
