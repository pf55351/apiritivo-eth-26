"use client";

import { arkivEntityUrl, listGrantsForService } from "@apiritivo/arkiv";
import type { ArkivService, Grant, Sale } from "@apiritivo/shared";
import { grantPrivateFile } from "@apiritivo/swarm";
import { useCallback, useEffect, useRef, useState } from "react";
import { type FriendlyError, toFriendlyError } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { Button, Disclosure, ErrorNotice } from "./ui";

type Row = { service: ArkivService; grants: Grant[] };

/**
 * Provider side of private files: every buyer of a service with a private
 * file who has not been granted yet. "Grant" runs `actAddGrantees` in this
 * browser (only the publisher can) and records the new history reference on
 * Arkiv so the buyer can decrypt.
 */
export function PrivateGrantsPanel({ services, sales }: { services: ArkivService[]; sales: Sale[] }) {
  const session = useSession();
  const withFiles = services.filter((s) => s.privateAttachment);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  const serviceIds = withFiles.map((s) => s.serviceId).join(",");
  const withFilesRef = useRef(withFiles);
  withFilesRef.current = withFiles;
  const load = useCallback(async () => {
    if (!serviceIds) {
      setRows([]);
      return;
    }
    const next = await Promise.all(withFilesRef.current.map(async (service) => ({ service, grants: await listGrantsForService(service.serviceId).catch(() => []) })));
    setRows(next);
  }, [serviceIds]);

  useEffect(() => {
    void load();
  }, [load]);

  if (withFiles.length === 0) return null;

  async function grant(service: ArkivService, sale: Sale, grants: Grant[]) {
    if (!session.identity || !service.privateAttachment || !sale.buyerPublicKey) return;
    setBusy(sale.saleKey);
    setError(null);
    try {
      // ACT is immutable: each grant builds on the newest history reference.
      const current = grants[0]?.historyRef ?? service.privateAttachment.historyRef;
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
          encryptedRef: service.privateAttachment.encryptedRef,
          publisherPubKey: service.privateAttachment.publisherPubKey,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
      if (!res.ok) throw new Error(json.reason ?? json.error ?? "Grant could not be recorded.");
      await load();
    } catch (err) {
      setError(toFriendlyError(err, "Granting access failed."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="min-w-0">
      <h2 className="text-xl font-medium">File access</h2>
      <p className="mt-1 text-sm text-ink-300">Grant buyers access to their purchased files.</p>
      {error ? (
        <div className="mt-3">
          <ErrorNotice message={error.message} detail={error.detail} />
        </div>
      ) : null}
      <div className="mt-4 space-y-4">
        {(rows ?? withFiles.map((service) => ({ service, grants: [] as Grant[] }))).map(({ service, grants }) => {
          const buyers = new Map<string, Sale>();
          for (const s of sales) if (s.serviceId === service.serviceId && s.buyerPublicKey && !buyers.has(s.buyerId)) buyers.set(s.buyerId, s);
          const granted = new Set(grants.map((g) => g.buyerId));
          const pending = Array.from(buyers.values()).filter((s) => !granted.has(s.buyerId));
          return (
            <div key={service.serviceId} className="border-t border-line py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{service.name}</p>
                  <p className="text-[11px] text-ink-400">
                    {service.privateAttachment!.name} · {grants.length} granted · {rows === null ? "…" : `${pending.length} waiting`}
                  </p>
                </div>
                <button type="button" onClick={() => void load()} className="text-xs text-ink-400 underline hover:text-ink-200">
                  refresh
                </button>
              </div>
              {pending.length > 0 ? (
                <ul className="mt-3 divide-y divide-white/10">
                  {pending.map((sale) => (
                    <li key={sale.saleKey} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                      <span className="font-mono text-ink-300">Buyer {sale.buyerId.slice(0, 10)}…</span>
                      <Button size="sm" onClick={() => grant(service, sale, grants)} disabled={busy !== null}>
                        {busy === sale.saleKey ? "Granting…" : "Grant access"}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {grants.length > 0 ? (
                <Disclosure title="Granted buyers" meta={grants.length}>
                  <ul className="space-y-2 text-xs text-subtle">
                    {grants.map((g) => (
                      <li key={g.grantKey}>
                        ✓ buyer {g.buyerId.slice(0, 10)}… ·{" "}
                        <a href={arkivEntityUrl(g.grantKey)} target="_blank" rel="noreferrer" className="font-mono hover:text-ink-200">
                          grant {g.grantKey.slice(0, 10)}… ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              ) : null}
              {rows !== null && pending.length === 0 && grants.length === 0 ? <p className="mt-2 text-xs text-ink-400">No buyers yet.</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
