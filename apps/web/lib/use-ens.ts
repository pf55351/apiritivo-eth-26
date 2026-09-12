"use client";

import { type EnsServiceRecords, type EnsVerification, resolveEnsName, resolveServiceRecords, verifyServiceRecords } from "@apiritivo/ens";
import type { ArkivService } from "@apiritivo/shared";
import { useEffect, useState } from "react";
import { friendlyMessage } from "./errors";

export type EnsState =
  | { status: "none" }
  | { status: "loading"; name: string }
  | { status: "ready"; name: string; records: EnsServiceRecords; verification: EnsVerification }
  | { status: "error"; name: string; error: string };

/** Resolve and verify the ENS name linked to a service. Read-only, runs in the browser against the public RPC. */
export function useEnsService(service: ArkivService | null | undefined): EnsState {
  const name = service?.ensName ?? null;
  // Only these three fields matter to resolution; a refreshed list must not re-run the RPC calls.
  const serviceId = service?.serviceId ?? null;
  const manifestRef = service?.manifestRef ?? null;
  const payoutAddress = service?.payoutAddress;
  const [state, setState] = useState<EnsState>(name ? { status: "loading", name } : { status: "none" });

  useEffect(() => {
    if (!name || !serviceId || !manifestRef) {
      setState({ status: "none" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", name });
    resolveServiceRecords(name)
      .then((records) => {
        if (cancelled) return;
        setState({
          status: "ready",
          name,
          records,
          verification: verifyServiceRecords(records, { serviceId, manifestRef, payoutAddress }),
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", name, error: friendlyMessage(err, "ENS could not be resolved right now.") });
      });
    return () => {
      cancelled = true;
    };
  }, [name, serviceId, manifestRef, payoutAddress]);

  return state;
}

const nameCache = new Map<string, string | null>();

/** Forget a cached reverse lookup (after the user sets a primary name). */
export function forgetEnsName(address: string): void {
  nameCache.delete(address.toLowerCase());
}

/** Primary ENS name of an address (reverse record, forward-verified), null while unknown or when there is none. */
export function useEnsName(address: string | null | undefined): string | null {
  const key = address ? address.toLowerCase() : null;
  const [name, setName] = useState<string | null>(key ? (nameCache.get(key) ?? null) : null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener("apiritivo:ens-name-changed", onChange);
    return () => window.removeEventListener("apiritivo:ens-name-changed", onChange);
  }, []);
  useEffect(() => {
    if (!key) {
      setName(null);
      return;
    }
    if (nameCache.has(key)) {
      setName(nameCache.get(key) ?? null);
      return;
    }
    let cancelled = false;
    resolveEnsName(key as `0x${string}`).then((n) => {
      nameCache.set(key, n);
      if (!cancelled) setName(n);
    });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);
  return name;
}
