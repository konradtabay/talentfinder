"use client";

import { getHost, isHostReady, useHost } from "./host";
import { getKeys, isReady, useKeys } from "./keys";

export function isOnboarded() {
  return isHostReady(getHost()) && isReady(getKeys());
}

export function useOnboarded() {
  const host = useHost();
  const keys = useKeys();
  return isHostReady(host) && isReady(keys);
}
