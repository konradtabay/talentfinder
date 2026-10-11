"use client";

import { funnelCounts } from "@/lib/funnel";
import type { Guest } from "@/lib/guests";

const LABELS: { key: keyof ReturnType<typeof funnelCounts>; label: string }[] = [
  { key: "registered", label: "Registered" },
  { key: "fit", label: "Fit" },
  { key: "accepted", label: "Accepted" },
  { key: "attended", label: "Attended" },
  { key: "met", label: "Met" },
  { key: "followedUp", label: "Follow-up" },
  { key: "replied", label: "Replied" },
  { key: "pipeline", label: "Pipeline" },
];

export function FunnelStrip({ guests }: { guests: Guest[] }) {
  const counts = funnelCounts(guests);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-line text-center text-xs">
      {LABELS.map(({ key, label }) => (
        <div key={key} className="px-2 py-2 border-r border-line last:border-r-0">
          <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
          <div className="text-lg font-semibold">{counts[key]}</div>
        </div>
      ))}
    </div>
  );
}
