"use client";

import { arkivEntityUrl } from "@apiritivo/arkiv";
import { explorerAddressUrl, explorerTokenUrl, paymentsContractAddress, USDC_ADDRESS } from "@apiritivo/payments";
import type { ServiceManifest } from "@apiritivo/shared";
import { formatAccessDuration, formatPriceUsdc, manifestStats } from "@apiritivo/shared";
import { downloadServiceManifest, swarmReferenceUrl } from "@apiritivo/swarm";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BotConsole } from "@/components/bot-console";
import { BuyAccess } from "@/components/buy-access";
import { ContractPanel } from "@/components/contract-panel";
import { ManifestOperations } from "@/components/manifest-view";
import { PrivateFilesPanel } from "@/components/private-files-panel";
import { type ProofLink, ProofPanel } from "@/components/proofs";
import { Avatar, Button, CategoryPill, EmptyState, ErrorNotice, JsonInspector, Skeleton } from "@/components/ui";
import { type FriendlyError, toFriendlyError } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { remainingSeconds, usePassesForService } from "@/lib/use-access";
import { usePassBearer } from "@/lib/use-pass-bearer";
import { useService } from "@/lib/use-services";

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
  const isProviderView = session.role === "provider";
  const workspaceHref = isProviderView ? "/provider" : "/marketplace";
  const { data: service, loading, error, reload } = useService(serviceId);
  const sessionReady = session.status !== "initializing";
  const manifestState = useManifest(service?.manifestRef ?? null, sessionReady);
  const passesState = usePassesForService(service?.serviceId ?? null, session.identity?.id ?? null);
  const passes = passesState.data ?? [];
  const activePass = passes.find((p) => {
    const left = remainingSeconds(p, passesState.timing);
    return left === null || left > 0;
  });
  const activeBearer = usePassBearer(activePass);

  if (loading || !session.roleLoaded) {
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
        title="API not found"
        description="This listing is unavailable. Return to your workspace."
        action={<Button href={workspaceHref}>{isProviderView ? "My APIs" : "Marketplace"}</Button>}
      />
    );
  }

  const provider = service.providerName?.trim() || service.providerId;
  const stats = manifestState.manifest ? manifestStats(manifestState.manifest) : null;
  const swarmUrl = swarmReferenceUrl(service.manifestRef);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link href={workspaceHref} className="text-sm text-ink-400 hover:text-ink-100">
        ← {isProviderView ? "My APIs" : "Marketplace"}
      </Link>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryPill slug={service.category} />
            <span className={`text-xs font-normal ${service.available ? "text-olive-400" : "text-ink-400"}`}>{service.available ? "● Available" : "○ Unavailable"}</span>
          </div>
          <h1 className="break-words text-3xl font-medium sm:text-4xl">{service.name}</h1>
          <p className="max-w-2xl break-words text-base text-ink-300">{service.description}</p>
          <div className="flex items-center gap-3 pt-1">
            <Avatar name={provider} seed={service.providerId} size={36} />
            <div className="min-w-0">
              <p className="break-words text-sm text-ink-100">by {provider}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="order-2 min-w-0 space-y-8 lg:order-1">
          <section className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-medium">Operations</h2>
              </div>
              {stats ? (
                <p className="font-mono text-xs text-ink-400">
                  {stats.operations} {stats.operations === 1 ? "operation" : "operations"}
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
                <ManifestOperations manifest={manifestState.manifest} />
              ) : null}
            </div>
          </section>
          {!isProviderView && activePass && manifestState.manifest ? <BotConsole serviceId={service.serviceId} manifest={manifestState.manifest} bearer={activeBearer} /> : null}
        </div>

        <aside className="order-1 min-w-0 space-y-6 lg:order-2">
          {!isProviderView ? (
            passesState.loading ? (
              <Skeleton className="h-48" />
            ) : passesState.error ? (
              <ErrorNotice message={passesState.error.message} detail={passesState.error.detail} onRetry={passesState.reload} />
            ) : (
              <BuyAccess service={service} passes={passes} timing={passesState.timing} onIssued={() => passesState.reload()} />
            )
          ) : (
            <div className="rounded-panel bg-surface p-6">
              <p className="eyebrow">Access price</p>
              <h2 className="mt-3 text-3xl font-medium">{service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}</h2>
              <p className="mt-2 text-sm text-muted">{service.accessSeconds ? `Per ${formatAccessDuration(service.accessSeconds)}` : "Open access"} · Avalanche Fuji</p>
              <p className="mt-4 text-xs text-subtle">Switch to Client to buy access.</p>
            </div>
          )}
          <PrivateFilesPanel service={service} activePass={activePass} />
        </aside>
      </div>

      <div>
        <ProofPanel
          columns={2}
          proofs={[
            ...(service.entityKey
              ? [
                  {
                    network: "Arkiv · Tiramisu testnet",
                    label: "entity key",
                    value: service.entityKey,
                    href: arkivEntityUrl(service.entityKey),
                    hrefLabel: "Arkiv explorer",
                  } satisfies ProofLink,
                ]
              : []),
            { network: "Swarm · public gateway", label: "manifestRef", value: service.manifestRef, href: swarmUrl, hrefLabel: "Swarm gateway" },
            { network: "Arkiv · Tiramisu testnet", label: "serviceId", value: service.serviceId },
            { network: "Arkiv · Tiramisu testnet", label: "providerId (Swarm ID)", value: service.providerId },
            ...(service.payoutAddress
              ? [
                  {
                    network: "Avalanche Fuji · SnowTrace",
                    label: "payout wallet (receives USDC)",
                    value: service.payoutAddress,
                    href: explorerAddressUrl(service.payoutAddress),
                    hrefLabel: "SnowTrace",
                  } satisfies ProofLink,
                ]
              : []),
            ...(paymentsContractAddress()
              ? [
                  {
                    network: "Avalanche Fuji · SnowTrace",
                    label: "APIritivoPayments contract",
                    value: paymentsContractAddress()!,
                    href: explorerAddressUrl(paymentsContractAddress()!),
                    hrefLabel: "SnowTrace",
                  } satisfies ProofLink,
                ]
              : []),
            { network: "Avalanche Fuji · SnowTrace", label: "USDC token (Circle testnet)", value: USDC_ADDRESS, href: explorerTokenUrl(), hrefLabel: "SnowTrace" },
          ]}
        />
        {isProviderView ? <ContractPanel serviceId={service.serviceId} /> : null}
        {manifestState.manifest ? <JsonInspector value={manifestState.manifest} title="Raw manifest" /> : null}
        <JsonInspector value={service} title="Registry data" />
      </div>
    </div>
  );
}
