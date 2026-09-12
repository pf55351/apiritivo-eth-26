"use client";

import { AVAX_FAUCET_URL, USDC_FAUCET_URL } from "@apiritivo/payments";
import { getSwarmDrive, type SwarmDrive } from "@apiritivo/swarm";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { publicEnv } from "@/lib/env";
import { useActiveAccount } from "@/lib/identity";
import { buildChecks, type ReadinessInput, summarize } from "@/lib/readiness";
import { useSession } from "@/lib/session";
import { ReadinessPanel } from "./readiness-panel";

const GLM_FAUCET_URL = "https://hub.arkiv.network/faucet";
const REFRESH_MS = 30_000;

type Writer = ReadinessInput["writer"];

/** App writer health from GET /api/services (no secrets). undefined = loading, null = unreachable. */
function useWriter(identityId: string | null, tick: number): Writer {
  const [writer, setWriter] = useState<Writer>(undefined);
  useEffect(() => {
    if (!identityId) return;
    let cancelled = false;
    fetch("/api/services", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { funded?: boolean; balance?: string; faucetUrl?: string } | null) => {
        if (!cancelled) setWriter(j ? { funded: j.funded, balance: j.balance, faucetUrl: j.faucetUrl } : null);
      })
      .catch(() => {
        if (!cancelled) setWriter(null);
      });
    return () => {
      cancelled = true;
    };
  }, [identityId, tick]);
  return writer;
}

function useDrive(identityId: string | null, ownStamp: boolean, tick: number): SwarmDrive | null | undefined {
  const [drive, setDrive] = useState<SwarmDrive | null | undefined>(undefined);
  useEffect(() => {
    if (!identityId || !ownStamp) {
      setDrive(null);
      return;
    }
    let cancelled = false;
    getSwarmDrive()
      .then((d) => {
        if (!cancelled) setDrive(d);
      })
      .catch(() => {
        if (!cancelled) setDrive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [identityId, ownStamp, tick]);
  return drive;
}

const DOT: Record<ReturnType<typeof summarize>["tone"], string> = {
  ok: "bg-success",
  warn: "bg-warning",
  block: "bg-danger",
  loading: "bg-subtle",
};

/**
 * Fixed bottom-right beacon that tells a signed-in identity what it still
 * needs in the current view (USDC, AVAX, GLM writer, Swarm drive). Click for
 * the per-resource list with faucet links.
 */
export function ReadinessBeacon() {
  const session = useSession();
  const account = useActiveAccount();
  const identityId = account.identity?.id ?? null;
  const view = session.role ?? "client";
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const writer = useWriter(identityId, tick);
  const drive = useDrive(session.identity?.id ?? null, session.uploadMode === "user-stamp", tick);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await account.refreshBalances();
    setTick((t) => t + 1);
    setRefreshing(false);
  }, [account]);

  // Balances change outside the app (faucets, wallet transfers): poll gently.
  useEffect(() => {
    if (!identityId) return;
    const id = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [identityId, refresh]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!identityId) return null;

  const checks = buildChecks({
    view,
    wallet: { status: account.status, balances: account.balances },
    writer,
    drive: {
      mode: session.uploadMode,
      ttlSeconds: drive?.ttlSeconds,
      label: drive?.label,
      usable: drive?.usable,
      manageUrl: `${publicEnv.swarmIframeOrigin.replace(/\/+$/, "")}/`,
    },
    faucets: { avax: AVAX_FAUCET_URL, usdc: USDC_FAUCET_URL, glm: GLM_FAUCET_URL },
  });
  const summary = summarize(checks);
  const title = view === "provider" ? "Provider checks" : "Client checks";

  return (
    <div ref={rootRef} className="fixed bottom-4 right-4 z-30 sm:bottom-6 sm:right-6">
      {open ? (
        <div className="absolute bottom-full right-0 mb-2 w-80 max-w-[calc(100vw-2rem)] animate-fade-up">
          <ReadinessPanel id={panelId} title={title} checks={checks} refreshing={refreshing} onRefresh={() => void refresh()} />
        </div>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Account readiness: ${summary.label}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm shadow-sm transition-colors hover:border-line-strong"
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[summary.tone]}`} />
        <span aria-live="polite">{summary.label}</span>
      </button>
    </div>
  );
}
