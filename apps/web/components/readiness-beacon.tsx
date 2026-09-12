"use client";

import { AVAX_FAUCET_URL, USDC_FAUCET_URL } from "@apiritivo/payments";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { publicEnv } from "@/lib/env";
import { useActiveAccount } from "@/lib/identity";
import { buildChecks, summarize } from "@/lib/readiness";
import { useSession } from "@/lib/session";
import { useSwarmDrive } from "@/lib/use-swarm-drive";
import { useWriterStatus } from "@/lib/use-writer-status";
import { useView } from "@/lib/view";
import { ReadinessPanel } from "./readiness-panel";

const GLM_FAUCET_URL = "https://hub.arkiv.network/faucet";
const REFRESH_MS = 30_000;

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
  const { view } = useView();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Shared with the provider dashboard: one request per page, whoever mounts first.
  const writerStatus = useWriterStatus(Boolean(identityId), tick);
  const writer =
    writerStatus === undefined
      ? undefined
      : writerStatus === null
        ? null
        : { funded: writerStatus.funded, balance: writerStatus.balance, faucetUrl: writerStatus.faucetUrl, ownerMismatch: writerStatus.ownerMismatch };
  const drive = useSwarmDrive(tick);

  const refreshBalances = account.refreshBalances;
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshBalances();
    } finally {
      setTick((t) => t + 1);
      setRefreshing(false);
    }
  }, [refreshBalances]);

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
