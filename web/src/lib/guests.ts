export type AttendeeKind = "hire" | "investor" | "recruiter" | "vendor" | "student" | "own_founder" | "other";
export type SeniorityFit = "too_junior" | "match" | "too_senior";
export type SchoolFit = "strong" | "relevant" | "unrelated" | "unknown";
export type PlaceFit = "event_city" | "event_country" | "elsewhere" | "unknown";
export type CompanySignal = "faang" | "tech" | "startup" | "corporate" | "generic" | "agency";
export type ConnectionFit = "high" | "thin" | "unknown";

export type FitResult = {
  bestRole: string;
  /** 0–100. Craft match and likelihood of joining, after bump-downs. */
  rank: number;
  fitScore: number;
  attendeeKind: AttendeeKind;
  seniority: SeniorityFit;
  craftMatch: boolean;
  builder: boolean;
  openToMove: boolean;
  school: SchoolFit;
  place: PlaceFit;
  companySignal: CompanySignal;
  connections: ConnectionFit;
  seniorityMatch: boolean;
  locationOk: boolean;
  isCandidate: boolean;
  confidence: number;
  needsReview: boolean;
};

export type Guest = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  approvalStatus: string;
  checkedIn: boolean;
  linkedinUrl: string;
  company: string;
  githubUrl: string;
  roleInterest: string;
  enrichment: {
    headline: string;
    currentTitle: string;
    currentCompany: string;
    snippet: string;
    enrichedAt: string | null;
  };
  fit: FitResult | null;
  decision: "pending" | "accept" | "decline" | "review" | "waitlist";
  connectSent: boolean;
  noteLine: string;
  followedUp: boolean;
  replied: boolean;
  inPipeline: boolean;
};

export function emptyGuest(partial: Pick<Guest, "id" | "email" | "fullName"> & Partial<Guest>): Guest {
  const parts = partial.fullName.trim().split(/\s+/);
  const firstName = partial.firstName || parts[0] || "";
  const lastName = partial.lastName || parts.slice(1).join(" ") || "";
  return {
    id: partial.id,
    email: partial.email.toLowerCase(),
    firstName,
    lastName,
    fullName: partial.fullName,
    approvalStatus: partial.approvalStatus ?? "",
    checkedIn: partial.checkedIn ?? false,
    linkedinUrl: partial.linkedinUrl ?? "",
    company: partial.company ?? "",
    githubUrl: partial.githubUrl ?? "",
    roleInterest: partial.roleInterest ?? "",
    enrichment: partial.enrichment ?? {
      headline: "",
      currentTitle: "",
      currentCompany: "",
      snippet: "",
      enrichedAt: null,
    },
    fit: partial.fit ?? null,
    decision: partial.decision ?? "pending",
    connectSent: partial.connectSent ?? false,
    noteLine: partial.noteLine ?? "",
    followedUp: partial.followedUp ?? false,
    replied: partial.replied ?? false,
    inPipeline: partial.inPipeline ?? false,
  };
}

export function attended(g: Guest): boolean {
  return g.checkedIn;
}
