"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ServiceManifest } from "@apiperitivo/shared";
import { formatAccessDuration, formatPriceUsdc, manifestStats } from "@apiperitivo/shared";
import { arkivEntityUrl } from "@apiperitivo/arkiv";
import { ProofPanel, type ProofLink } from "@/components/proofs";
import { downloadServiceManifest, swarmReferenceUrl } from "@apiperitivo/swarm";
import { useService } from "@/lib/use-services";
import { useSession } from "@/lib/session";
import { toFriendlyError, type FriendlyError } from "@/lib/errors";
import { ManifestPanel } from "@/components/manifest-view";
import { Avatar, Button, CategoryPill, EmptyState, ErrorNotice, JsonInspector, ProofChip, Skeleton } from "@/components/ui";

function useManifest(reference: string | null, sessionReady: boolean) {
  const [manifest, setManifest] = useState<ServiceManifest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!reference || !sessionReady) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    downloadServiceManifest(reference)
      .then((m) => {
        if (!cancelled) setManifest(m);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toFriendlyError(err, "Manifest could not be downloaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reference, sessionReady, tick]);

  return { manifest, loading, error, reload: () => setTick((n) => n + 1) };
}

export default function ServiceDetailPage() {
  const params = useParams<{ serviceId: string }>();
  const serviceId = typeof params?.serviceId === "string" ? params.serviceId : null;
  const session = useSession();
  const { data: service, loading, error, reload } = useService(serviceId);
  const sessionReady = session.status !== "initializing";
  const manifestState = useManifest(service?.manifestRef ?? null, sessionReady);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorNotice message={error.message} detail={error.detail} onRetry={reload} />
      </div>
    );
  }

  if (!service) {
    return (
      <EmptyState
        title="Service not found."
        description="This service is not in the Arkiv registry (or was never published)."
        action={<Button href="/marketplace">Back to marketplace</Button>}
      />
    );
  }

  const provider = service.providerName?.trim() || service.providerId;
  const stats = manifestState.manifest ? manifestStats(manifestState.manifest) : null;
  const swarmUrl = swarmReferenceUrl(service.manifestRef);

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-up">
      <Link href="/marketplace" className="text-sm text-ink-400 hover:text-ink-100">
        ← Marketplace
      </Link>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryPill slug={service.category} />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${service.available ? "text-olive-400" : "text-ink-400"}`}>
              {service.available ? "● Available" : "○ Unavailable"}
            </span>
          </div>
          <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-5xl">{service.name}</h1>
          <p className="max-w-2xl text-base text-ink-300">{service.description}</p>
          <div className="flex items-center gap-3 pt-1">
            <Avatar name={provider} seed={service.providerId} size={36} />
            <div>
              <p className="text-sm text-ink-100">by {provider}</p>
              <p className="break-all font-mono text-[11px] text-ink-400" title={service.providerId}>
                {service.providerId}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          <ProofChip label="Arkiv" title="Registered on Arkiv" href={service.entityKey ? arkivEntityUrl(service.entityKey) : undefined} />
          <ProofChip label="Swarm" ok={Boolean(manifestState.manifest)} title="Manifest on Swarm" href={swarmUrl} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <section className="card min-w-0 rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Swarm manifest</p>
              <h2 className="mt-1 text-xl font-semibold">Operations</h2>
            </div>
            {stats ? (
              <p className="font-mono text-xs text-ink-400">
                {stats.operations} op · {stats.inputs} inputs · v{manifestState.manifest?.v}
              </p>
            ) : null}
          </div>
          <div className="mt-5">
            {manifestState.loading || (!manifestState.manifest && !manifestState.error) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </div>
            ) : manifestState.error ? (
              <ErrorNotice message={manifestState.error.message} detail={manifestState.error.detail} onRetry={manifestState.reload} />
            ) : manifestState.manifest ? (
              <ManifestPanel manifest={manifestState.manifest} />
            ) : null}
          </div>
        </section>

        <aside className="min-w-0 space-y-6">
          <section className="card rounded-3xl p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Access</p>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <span className="text-3xl font-semibold tracking-tight text-ink-100">{service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}</span>
              <span className="text-sm text-ink-300">{service.accessSeconds ? `per ${formatAccessDuration(service.accessSeconds)}` : "open access"}</span>
            </div>
            <button
              type="button"
              disabled
              title="Payments and access passes arrive in Phase 2"
              className="mt-4 inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-full border border-spritz-500/40 bg-spritz-500/15 text-sm font-semibold text-spritz-300 opacity-80"
            >
              Buy access · Phase 2
            </button>
            <p className="mt-2 text-[11px] text-ink-400">USDC payment creates an Arkiv access pass with this duration. Not yet available.</p>
          </section>
          <ProofPanel
            proofs={[
              ...(service.entityKey
                ? [{ network: "Arkiv · Tiramisu testnet", label: "entity key", value: service.entityKey, href: arkivEntityUrl(service.entityKey), hrefLabel: "Arkiv explorer" } satisfies ProofLink]
                : []),
              { network: "Swarm · public gateway", label: "manifestRef", value: service.manifestRef, href: swarmUrl, hrefLabel: "Swarm gateway" },
              { network: "Arkiv · Tiramisu testnet", label: "serviceId", value: service.serviceId },
              { network: "Arkiv · Tiramisu testnet", label: "providerId (Swarm ID)", value: service.providerId },
            ]}
          />
          <section className="card rounded-3xl p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Arkiv registry</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-ink-300">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-400">Version</p>
                <p className="font-mono">{service.version}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-400">Created at block</p>
                <p className="font-mono">{service.createdAtBlock ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-400">Writer (owner)</p>
                <p className="break-all font-mono" title={service.owner}>{service.owner ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-400">Available</p>
                <p className="font-mono">{service.available ? "true" : "false"}</p>
              </div>
            </div>
          </section>
          <JsonInspector value={service} title="Raw service (Arkiv)" />
        </aside>
      </div>
    </div>
  );
}
