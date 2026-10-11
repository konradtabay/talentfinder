"use client";

import { useOnboarded } from "@/lib/onboard";
import { ButtonLink } from "./ui";

export function StartButton() {
  const ready = useOnboarded();
  return (
    <ButtonLink href={ready ? "/app" : "/onboarding"}>
      {ready ? "Open app →" : "Start →"}
    </ButtonLink>
  );
}
