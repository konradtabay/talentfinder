"use client";

import { HostStep } from "@/components/HostStep";
import { KeyStep } from "@/components/KeyStep";
import { Button, ButtonLink, Header } from "@/components/ui";
import { isHostReady, useHost } from "@/lib/host";
import { isReady, useKeys } from "@/lib/keys";

export default function Onboarding() {
  const keys = useKeys();
  const host = useHost();
  const ready = isHostReady(host) && isReady(keys);

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div>
          <h1 className="font-dot text-4xl font-black">setup</h1>
          <p className="mt-2 text-muted">
            You, then two keys. Everything stays in this browser and is only sent with your own
            requests.
          </p>
        </div>

        <HostStep host={host} />

        <KeyStep
          step="01"
          provider="typesafe"
          title="TypeSafe"
          description="Runs the fit check with Jev. Paste a key from the TypeSafe console."
          value={keys.typesafe}
          placeholder="Paste your TypeSafe API key"
          getKeyUrl="https://console.typesafe.ai/"
        />

        <KeyStep
          step="02"
          provider="tinyfish"
          title="TinyFish"
          description="Looks up each guest's public profile. Search and fetch are free within a daily allowance."
          value={keys.tinyfish}
          placeholder="Paste your TinyFish API key"
          getKeyUrl="https://agent.tinyfish.ai/api-keys"
        />

        <div className="flex items-center justify-between pt-2">
          <span className="text-muted">
            {ready ? "All set." : "Add your name, then TypeSafe and TinyFish."}
          </span>
          {ready ? <ButtonLink href="/app">Continue →</ButtonLink> : <Button disabled>Continue →</Button>}
        </div>
      </main>
    </>
  );
}
