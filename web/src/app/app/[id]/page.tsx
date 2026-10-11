import { Suspense } from "react";
import { EventPageClient } from "./client";

export default function EventPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-6 py-10 text-muted">Loading…</main>}>
      <EventPageClient />
    </Suspense>
  );
}
