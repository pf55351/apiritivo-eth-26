"use client";

import { AVAX_FAUCET_URL, USDC_FAUCET_URL } from "@apiritivo/payments";
import { getSwarmDrive, type SwarmDrive } from "@apiritivo/swarm";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { publicEnv } from "@/lib/env";
import { buildChecks, type ReadinessCheck, type ReadinessInput, stateLabel, summarize } from "@/lib/readiness";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";

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
  ok: "bg-olive-400",
  warn: "bg-amber-300",
  block: "bg-rose-400",
  loading: "bg-ink-400",
};

const STATE_TONE: Record<ReadinessCheck["state"], string> = {
  ok: "text-olive-400",
  low: "text-amber-200",
  missing: "text-rose-400",
  info: "text-subtle",
  loading: "text-subtle",
  unknown: "text-subtle",
};

const STATE_MARK: Record<ReadinessCheck["state"], string> = {
  ok: "✓",
  low: "!",
  missing: "✕",
  info: "·",
  loading: "…",
  unknown: "?",
};

/**
 * Fixed bottom-right beacon that tells a signed-in identity what it still
 * needs in the current view (USDC, AVAX, GLM writer, Swarm drive). Click for
 * the per-resource list with faucet links.
 */
export function ReadinessBeacon() {
  const session = useSession();
  const wallet = useSwarmWallet();
  const identityId = session.identity?.id ?? null;
  const view = session.role ?? "client";
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const writer = useWriter(identityId, tick);
  const drive = useDrive(identityId, session.uploadMode === "user-stamp", tick);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await wallet.refreshBalances();
    setTick((t) => t + 1);
    setRefreshing(false);
  }, [wallet]);

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
    wallet: { status: wallet.status, balances: wallet.balances },
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
        <section
          id={panelId}
          aria-label={title}
          className="absolute bottom-full right-0 mb-2 w-80 max-w-[calc(100vw-2rem)] animate-fade-up rounded-panel border border-line bg-surface-raised shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <h2 className="text-sm font-medium">{title}</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="min-h-8 rounded-control border border-line px-2 text-[11px] text-subtle hover:border-line-strong hover:text-content disabled:opacity-50"
            >
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {checks.map((check) => (
              <li key={check.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">{check.label}</span>
                  <span className={`inline-flex items-center gap-1.5 text-xs ${STATE_TONE[check.state]}`}>
                    <span aria-hidden="true" className="font-mono">
                      {STATE_MARK[check.state]}
                    </span>
                    {stateLabel(check.state)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-subtle">
                  <span>{check.value ? <span className="font-mono text-muted">{check.value}</span> : check.hint}</span>
                  {check.href && check.state !== "ok" && check.state !== "info" ? (
                    <a href={check.href} target="_blank" rel="noreferrer" className="py-1 text-accent-text hover:underline">
                      {check.hrefLabel} ↗
                    </a>
                  ) : null}
                </div>
                {check.value ? <p className="mt-0.5 text-xs text-subtle">{check.hint}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Account readiness: ${summary.label}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface-raised px-3 text-[13px] shadow-xl transition-colors hover:border-line-strong"
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[summary.tone]}`} />
        <span aria-live="polite">{summary.label}</span>
      </button>
    </div>
  );
}
