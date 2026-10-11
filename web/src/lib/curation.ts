import { scoreGuest } from "./jev-client";
import type { Guest } from "./guests";

const DECLINE_KINDS = new Set(["recruiter", "vendor"]);

function showFraction(showRate: number): number {
  if (showRate > 0 && showRate <= 1) return showRate;
  return 0.72;
}

/** How many approvals fill the room after no-shows. 80 seats at 72% show → 111. */
export function approvalTarget(capacity: number, showRate: number): number {
  const seats = Math.max(1, capacity);
  return Math.max(seats, Math.round(seats / showFraction(showRate)));
}

export function applyCuration(guests: Guest[], capacity: number, showRate: number): Guest[] {
  const seatTarget = approvalTarget(capacity, showRate);
  const ranked = [...guests].sort((a, b) => scoreGuest(b) - scoreGuest(a));
  // Approve everyone registered when the list fits the over-approve budget (e.g. ~130 on an 80-seat event).
  const target = Math.max(seatTarget, ranked.length);

  if (ranked.length <= target) {
    const decisions = new Map<string, Guest["decision"]>();
    for (const g of ranked) {
      if (!g.fit) continue;
      const clearMiss = !g.fit.isCandidate && DECLINE_KINDS.has(g.fit.attendeeKind);
      decisions.set(g.id, clearMiss ? "decline" : "accept");
    }
    return guests.map((g) => {
      const decision = decisions.get(g.id);
      return decision ? { ...g, decision } : g;
    });
  }

  let accepts = 0;
  const decisions = new Map<string, Guest["decision"]>();
  for (const g of ranked) {
    if (!g.fit) continue;
    const clearMiss = !g.fit.isCandidate && DECLINE_KINDS.has(g.fit.attendeeKind);
    if (g.fit.needsReview && !clearMiss) {
      decisions.set(g.id, "review");
      continue;
    }
    if (accepts < target && !clearMiss) {
      accepts += 1;
      decisions.set(g.id, "accept");
      continue;
    }
    decisions.set(g.id, clearMiss ? "decline" : "waitlist");
  }

  return guests.map((g) => {
    const decision = decisions.get(g.id);
    return decision ? { ...g, decision } : g;
  });
}
