"use client";

import { ENS_SERVICE_TEXT_KEY, ensAppUrl, ensChainLabel, recordsForService } from "@apiritivo/ens";
import type { ArkivService } from "@apiritivo/shared";
import { useState } from "react";
import { copyText } from "@/lib/format";
import { useEnsService } from "@/lib/use-ens";

/** Small inline badge for cards and headers: the linked ENS name, green once the address record matches. */
export function EnsBadge({ service }: { service: ArkivService }) {
  const ens = useEnsService(service);
  if (ens.status === "none") return null;
  const ok = ens.status === "ready" && ens.verification.addressOk;
  const complete = ens.status === "ready" && ens.verification.complete;
  const tone = complete ? "border-olive-400/40 text-olive-400" : ok ? "border-spritz-300/40 text-spritz-300" : "border-white/15 text-ink-400";
  const title = complete
    ? "ENS name resolves to this service (address, service id, manifest)"
    : ok
      ? "ENS address record verified; service records not set yet"
      : ens.status === "loading"
        ? "Resolving ENS…"
        : "ENS name does not resolve";
  return (
    <span title={title} className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 font-mono text-[11px] ${tone}`}>
      <span aria-hidden="true">{complete ? "✓" : ok ? "◐" : "○"}</span>
      <span className="truncate">{ens.name}</span>
    </span>
  );
}

function Row({ label, ok, value }: { label: string; ok: boolean | null; value: string }) {
  const icon = ok === null ? "…" : ok ? "✓" : "○";
  const tone = ok === null ? "text-ink-400" : ok ? "text-olive-400" : "text-ink-400";
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={`font-mono ${tone}`}>{icon}</span>
      <span className="text-ink-300">{label}</span>
      <span className="ml-auto max-w-[55%] truncate font-mono text-ink-100" title={value}>
        {value}
      </span>
    </div>
  );
}

/**
 * Service page panel: what the linked ENS name resolves to, and the three
 * records the provider sets in the ENS app so a `.eth` name fully describes
 * the API (address → payout, text → Arkiv service id, contenthash → Swarm manifest).
 */
export function EnsPanel({ service, isProviderView }: { service: ArkivService; isProviderView: boolean }) {
  const ens = useEnsService(service);
  const [copied, setCopied] = useState<string | null>(null);
  if (ens.status === "none") return null;

  const copy = async (key: string, value: string) => {
    if (await copyText(value)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    }
  };
  const v = ens.status === "ready" ? ens.verification : null;
  const r = ens.status === "ready" ? ens.records : null;
  const recipe = service.payoutAddress ? recordsForService({ serviceId: service.serviceId, manifestRef: service.manifestRef, payoutAddress: service.payoutAddress }) : [];
  const missing = v ? !v.complete : false;

  return (
    <section className="rounded-panel bg-surface p-6">
      <p className="eyebrow">ENS · {ensChainLabel()}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <a href={ensAppUrl(ens.name)} target="_blank" rel="noreferrer" className="break-all font-mono text-base text-ink-100 hover:text-spritz-300">
          {ens.name} ↗
        </a>
        {v ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] ${v.complete ? "border-olive-400/40 text-olive-400" : v.addressOk ? "border-spritz-300/40 text-spritz-300" : "border-rose-400/40 text-rose-300"}`}
          >
            {v.complete ? "fully resolvable" : v.addressOk ? "address verified" : "not resolving"}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted">A machine that knows only this name can find the payout wallet, the Arkiv listing and the Swarm manifest.</p>

      <div className="mt-4 space-y-2">
        <Row label="ETH address → payout wallet" ok={v ? v.addressOk : null} value={r?.address ?? "not set"} />
        <Row label={`text ${ENS_SERVICE_TEXT_KEY}`} ok={v ? v.serviceOk : null} value={r?.serviceId ?? "not set"} />
        <Row label="contenthash → Swarm manifest" ok={v ? v.manifestOk : null} value={r?.manifestRef ? `bzz://${r.manifestRef.slice(0, 12)}…` : "not set"} />
      </div>
      {ens.status === "error" ? <p className="mt-3 text-xs text-rose-300">ENS resolution failed: {ens.error}</p> : null}

      {isProviderView && missing && recipe.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-ink-900/40 p-3">
          <p className="text-xs font-semibold text-ink-100">Records to set in the ENS app</p>
          <p className="mt-1 text-[11px] text-ink-400">Open the name, edit records, paste these three. Reads update within a minute.</p>
          <div className="mt-2 space-y-1.5">
            {recipe.map((rec) => (
              <div key={rec.kind} className="flex items-center gap-2 text-[11px]">
                <span className="w-28 shrink-0 text-ink-400">{rec.key}</span>
                <code className="min-w-0 flex-1 truncate font-mono text-ink-100" title={rec.value}>
                  {rec.value}
                </code>
                <button
                  type="button"
                  onClick={() => copy(rec.kind, rec.value)}
                  className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-ink-300 hover:text-ink-100"
                >
                  {copied === rec.kind ? "Copied ✓" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
