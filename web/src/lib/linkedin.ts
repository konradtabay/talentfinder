import type { Guest } from "./guests";

export function guestLinkedInHref(guest: Pick<Guest, "linkedinUrl" | "fullName">): string {
  const raw = guest.linkedinUrl.trim();
  if (raw.includes("linkedin.com")) {
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw.replace(/^\/\//, "")}`;
  }
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(guest.fullName)}`;
}
