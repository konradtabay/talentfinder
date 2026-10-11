import { guestLinkedInHref } from "@/lib/linkedin";
import type { Guest } from "@/lib/guests";

export function GuestLinkedInName({
  guest,
  className = "underline hover:text-fg",
}: {
  guest: Pick<Guest, "linkedinUrl" | "fullName">;
  className?: string;
}) {
  return (
    <a href={guestLinkedInHref(guest)} target="_blank" rel="noopener noreferrer" className={className}>
      {guest.fullName}
    </a>
  );
}
