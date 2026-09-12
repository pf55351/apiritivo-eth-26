"use client";

import { arkivEntityUrl, listGrantsForService } from "@apiritivo/arkiv";
import type { ArkivService, Grant, Sale } from "@apiritivo/shared";
import { grantPrivateFile } from "@apiritivo/swarm";
import { useState } from "react";
import { type FriendlyError, toFriendlyError } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { useQuery } from "@/lib/use-query";
import { Button, Disclosure, ErrorNotice } from "./ui";

const loadGrants = async (key: string): Promise<Record<string, Grant[]>> => {
  const ids = key.split(",").filter(Boolean);
  const rows = await Promise.all(ids.map(async (id) => [id, await listGrantsForService(id).catch(() => [] as Grant[])] as const));
  return Object.fromEntries(rows);
};

/** Grants of every listed service that carries a private file, keyed by service id. `null` data = not loaded yet. */
export function useFileGrants(services: ArkivService[]) {
  const key =
    services
      .filter((s) => s.privateAttachment)
      .map((s) => s.serviceId)
      .join(",") || null;
  return useQuery<Record<string, Grant[]>>(key, loadGrants, "Could not load file access from Arkiv.");
}

/**
 * The private file of one service, on its card in the provider dashboard: who
 * bought and is waiting, who was granted. "Grant access" runs `actAddGrantees`
 * in this browser (only the publisher can) and records the new history
 * reference on Arkiv so the buyer's Swarm ID can decrypt.
 */
export function ServiceFileAccess({ service, sales, grants, onGranted }: { service: ArkivService; sales: Sale[]; grants: Grant[] | undefined; onGranted: () => void }) {
  const session = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const file = service.privateAttachment;
  if (!file) return null;

  // One row per buyer: a Swarm ID that bought twice waits once.
  const buyers = new Map<string, Sale>();
  for (const s of sales) if (s.serviceId === service.serviceId && s.buyerPublicKey && !buyers.has(s.buyerId)) buyers.set(s.buyerId, s);
  const granted = new Set((grants ?? []).map((g) => g.buyerId));
  const pending = grants ? Array.from(buyers.values()).filter((s) => !granted.has(s.buyerId)) : [];

  async function grant(sale: Sale) {
    if (!session.identity || !file || !sale.buyerPublicKey) return;
    setBusy(sale.saleKey);
    setError(null);
    try {
      // ACT is immutable: each grant builds on the newest history reference.
      const current = grants?.[0]?.historyRef ?? file.historyRef;
      const { historyRef } = await grantPrivateFile(current, sale.buyerPublicKey);
      const res = await fetch("/api/grants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: service.serviceId,
          providerId: session.identity.id,
          buyerId: sale.buyerId,
          buyerPublicKey: sale.buyerPublicKey,
          historyRef,
          encryptedRef: file.encryptedRef,
          publisherPubKey: file.publisherPubKey,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
      if (!res.ok) throw new Error(json.reason ?? json.error ?? "Grant could not be recorded.");
      onGranted();
    } catch (err) {
      setError(toFriendlyError(err, "Granting access failed."));
    } finally {
      setBusy(null);
    }
  }

  const summary = !grants ? "checking access…" : `${grants.length} granted${pending.length > 0 ? ` · ${pending.length} waiting` : ""}`;

  return (
    <div className="min-w-0 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-muted">
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V6a4 4 0 0 1 8 0v4" />
          </svg>
          <span className="truncate">Private file · {file.name}</span>
        </span>
        <span className={pending.length > 0 ? "text-warning" : "text-subtle"}>{summary}</span>
      </div>
      {pending.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          {pending.map((sale) => (
            <li key={sale.saleKey} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-mono text-muted">Buyer {sale.buyerId.slice(0, 10)}…</span>
              <Button size="sm" onClick={() => grant(sale)} disabled={busy !== null}>
                {busy === sale.saleKey ? "Granting…" : "Grant access"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <div className="mt-2">
          <ErrorNotice message={error.message} detail={error.detail} />
        </div>
      ) : null}
      {grants && grants.length > 0 ? (
        <Disclosure title="Granted buyers" meta={grants.length}>
          <ul className="space-y-2 text-subtle">
            {grants.map((g) => (
              <li key={g.grantKey}>
                ✓ buyer {g.buyerId.slice(0, 10)}… ·{" "}
                <a href={arkivEntityUrl(g.grantKey)} target="_blank" rel="noreferrer" className="font-mono hover:text-content-secondary">
                  grant {g.grantKey.slice(0, 10)}… ↗
                </a>
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </div>
  );
}
