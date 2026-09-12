"use client";

import { type EnsServiceRecords, type EnsVerification, resolveServiceRecords, verifyServiceRecords } from "@apiritivo/ens";
import type { ArkivService } from "@apiritivo/shared";
import { useEffect, useState } from "react";

export type EnsState =
  | { status: "none" }
  | { status: "loading"; name: string }
  | { status: "ready"; name: string; records: EnsServiceRecords; verification: EnsVerification }
  | { status: "error"; name: string; error: string };

/** Resolve and verify the ENS name linked to a service. Read-only, runs in the browser against the public RPC. */
export function useEnsService(service: ArkivService | null | undefined): EnsState {
  const name = service?.ensName ?? null;
  const [state, setState] = useState<EnsState>(name ? { status: "loading", name } : { status: "none" });

  useEffect(() => {
    if (!name || !service) {
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
          verification: verifyServiceRecords(records, { serviceId: service.serviceId, manifestRef: service.manifestRef, payoutAddress: service.payoutAddress }),
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", name, error: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [name, service?.serviceId, service?.manifestRef, service?.payoutAddress, service]);

  return state;
}
