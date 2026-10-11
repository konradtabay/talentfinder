import type { Guest } from "./guests";

export type FunnelCounts = {
  registered: number;
  fit: number;
  accepted: number;
  attended: number;
  met: number;
  followedUp: number;
  replied: number;
  pipeline: number;
};

export function funnelCounts(guests: Guest[]): FunnelCounts {
  return {
    registered: guests.length,
    fit: guests.filter((g) => g.fit && !g.fit.needsReview).length,
    accepted: guests.filter((g) => g.decision === "accept").length,
    attended: guests.filter((g) => g.checkedIn).length,
    met: guests.filter((g) => g.checkedIn && g.noteLine.trim()).length,
    followedUp: guests.filter((g) => g.followedUp).length,
    replied: guests.filter((g) => g.replied).length,
    pipeline: guests.filter((g) => g.inPipeline).length,
  };
}
