"use client";

import { useEffect, useState } from "react";
import { invalidateRequest, sharedRequest } from "./shared-request";

/** What GET /api/services reports about the app-owned Arkiv writer (no secrets). */
export type WriterStatus = {
  writerConfigured: boolean;
  address?: string;
  balance?: string;
  funded?: boolean;
  trustedOwner?: string;
  ownerMismatch?: boolean;
  explorerUrl?: string;
  dataExplorerUrl?: string;
  faucetUrl: string;
};

const KEY = "writer-status";

export function fetchWriterStatus(): Promise<WriterStatus | null> {
  return sharedRequest(KEY, async () => {
    const res = await fetch("/api/services", { cache: "no-store" });
    return res.ok ? ((await res.json()) as WriterStatus) : null;
  });
}

/**
 * Writer health, shared by every reader on the page. `undefined` = loading,
 * `null` = unreachable. `enabled` false skips the request (guests); `tick`
 * forces a fresh read.
 */
export function useWriterStatus(enabled = true, tick = 0): WriterStatus | null | undefined {
  const [status, setStatus] = useState<WriterStatus | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (tick > 0) invalidateRequest(KEY);
    fetchWriterStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, tick]);
  return status;
}
