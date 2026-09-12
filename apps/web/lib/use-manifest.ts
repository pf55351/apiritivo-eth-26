"use client";

import type { ServiceManifest } from "@apiritivo/shared";
import { downloadServiceManifest } from "@apiritivo/swarm";
import { useEffect, useState } from "react";
import { type FriendlyError, toFriendlyError } from "./errors";

/** The technical manifest of a service, downloaded from Swarm once the Swarm session is initialised. */
export function useManifest(reference: string | null, sessionReady: boolean) {
  const [manifest, setManifest] = useState<ServiceManifest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // A new reference means a new API: never show the previous one's operations meanwhile.
    setManifest(null);
    setError(null);
    if (!reference || !sessionReady) return;
    let cancelled = false;
    setLoading(true);
    downloadServiceManifest(reference)
      .then((m) => {
        if (!cancelled) setManifest(m);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toFriendlyError(err, "Manifest could not be downloaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reference, sessionReady, tick]);

  return { manifest, loading, error, reload: () => setTick((n) => n + 1) };
}
