"use client";

import { type EnsServiceRecords, type EnsVerification, normalizeEnsName, resolveEnsAddress, resolveEnsName, resolveServiceRecords, verifyServiceRecords } from "@apiritivo/ens";
import type { Address } from "@apiritivo/payments";
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

/** Primary ENS name of an address (reverse record, forward-verified), null while unknown or when there is none. */
export function useEnsName(address: string | null | undefined): string | null {
  const key = address ? address.toLowerCase() : null;
  const [name, setName] = useState<string | null>(key ? (nameCache.get(key) ?? null) : null);
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
  }, [key]);
  return name;
}

export type RecipientState =
  | { status: "empty" }
  /** A plain `0x…` address. */
  | { status: "address"; address: Address }
  | { status: "resolving"; name: string }
  | { status: "resolved"; name: string; address: Address }
  /** A well-formed `.eth` name with no address record on the ENS chain. */
  | { status: "unresolved"; name: string }
  | { status: "invalid" };

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * What a recipient field means: an address as typed, or an ENS name resolved
 * to its address record (debounced while typing). Operations must use the
 * returned address, never the raw input.
 */
export function useResolvedRecipient(input: string): RecipientState {
  const raw = input.trim();
  const name = ADDRESS_RE.test(raw) ? null : normalizeEnsName(raw);
  const [resolved, setResolved] = useState<{ name: string; address: Address | null } | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      resolveEnsAddress(name)
        .catch(() => null)
        .then((address) => {
          if (!cancelled) setResolved({ name, address });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name]);

  if (!raw) return { status: "empty" };
  if (ADDRESS_RE.test(raw)) return { status: "address", address: raw as Address };
  if (!name) return { status: "invalid" };
  if (resolved?.name !== name) return { status: "resolving", name };
  return resolved.address ? { status: "resolved", name, address: resolved.address } : { status: "unresolved", name };
}
