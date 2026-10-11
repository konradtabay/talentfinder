"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { EventWorkspace } from "@/components/EventWorkspace";
import { Header } from "@/components/ui";
import { useEvent } from "@/lib/events";
import { isOnboarded } from "@/lib/onboard";

export function EventPageClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const event = useEvent(params.id);

  useEffect(() => {
    if (!isOnboarded()) router.replace("/onboarding");
  }, [router]);

  return (
    <>
      <Header
        right={
          <Link href="/app" className="underline hover:text-fg">
            all events
          </Link>
        }
      />
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-10">
        {event ? (
          <EventWorkspace eventId={params.id} />
        ) : (
          <p className="text-muted">Event not found in this browser.</p>
        )}
      </main>
    </>
  );
}
