"use client";

import { arkivEntityUrl } from "@apiritivo/arkiv";
import { explorerAddressUrl, explorerTokenUrl, paymentsContractAddress, USDC_ADDRESS } from "@apiritivo/payments";
import { formatAccessDuration, formatPriceUsdc, manifestStats } from "@apiritivo/shared";
import { swarmReferenceUrl } from "@apiritivo/swarm";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { BuyAccess } from "@/components/buy-access";
import { ContractPanel } from "@/components/contract-panel";
import { EnsPanel } from "@/components/ens-panel";
import { ManifestOperations } from "@/components/manifest-view";
import { PrivateFilesPanel } from "@/components/private-files-panel";
import { type ProofLink, ProofPanel } from "@/components/proofs";
import { Avatar, BackLink, CategoryPill, EmptyState, ErrorNotice, JsonInspector, Skeleton } from "@/components/ui";
import { useActiveIdentity } from "@/lib/identity";
import { useSession } from "@/lib/session";
import { remainingSeconds, usePassesForService } from "@/lib/use-access";
import { useManifest } from "@/lib/use-manifest";
import { useService } from "@/lib/use-services";

function ServiceDetail() {
  const params = useParams<{ serviceId: string }>();
  const serviceId = typeof params?.serviceId === "string" ? params.serviceId : null;
  const session = useSession();
  const isProviderView = session.role === "provider";
  const workspaceHref = isProviderView ? "/provider" : "/marketplace";
  const { data: service, loading, error, reload } = useService(serviceId);
  const sessionReady = session.status !== "initializing";
  const manifestState = useManifest(service?.manifestRef ?? null, sessionReady);
  const identity = useActiveIdentity();
  const passesState = usePassesForService(service?.serviceId ?? null, identity?.id ?? null);
  const passes = passesState.data ?? [];
  const activePass = passes.find((p) => {
    const left = remainingSeconds(p, passesState.timing);
    return left === null || left > 0;
  });
  const backLink = <BackLink href={workspaceHref}>{isProviderView ? "My APIs" : "Marketplace"}</BackLink>;

  if (loading || !session.roleLoaded) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        {session.roleLoaded ? backLink : <Skeleton className="h-11 w-32" />}
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
      <div className="mx-auto max-w-5xl space-y-8">
        {backLink}
        <ErrorNotice message={error.message} detail={error.detail} onRetry={reload} />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        {backLink}
        <EmptyState title="API not found" description="This listing is unavailable. Return to your workspace." />
      </div>
    );
  }

  const provider = service.providerName?.trim() || service.providerId;
  const stats = manifestState.manifest ? manifestStats(manifestState.manifest) : null;
  const swarmUrl = swarmReferenceUrl(service.manifestRef);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {backLink}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr] lg:gap-x-12">
        <header className="min-w-0">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryPill slug={service.category} />
              <span className={`text-xs font-normal ${service.available ? "text-success" : "text-subtle"}`}>{service.available ? "● Available" : "○ Unavailable"}</span>
            </div>
            <h1 className="break-words text-3xl font-medium sm:text-4xl">{service.name}</h1>
            <p className="max-w-2xl break-words text-base text-muted">{service.description}</p>
            <div className="flex items-center gap-3 pt-1">
              <Avatar name={provider} seed={service.providerId} size={36} />
              <div className="min-w-0">
                <p className="break-words text-sm text-content">by {provider}</p>
              </div>
            </div>
          </div>
        </header>
        <aside aria-label="Service access" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {!isProviderView ? (
            passesState.loading && !passesState.data ? (
              <Skeleton className="h-48" />
            ) : passesState.error ? (
              <ErrorNotice message={passesState.error.message} detail={passesState.error.detail} onRetry={passesState.reload} />
            ) : (
              <BuyAccess service={service} passes={passes} timing={passesState.timing} onIssued={() => passesState.reload()} />
            )
          ) : (
            <div className="rounded-panel bg-surface p-6">
              <p className="eyebrow">Access price</p>
              <div className="mt-3 flex flex-wrap items-baseline gap-2">
                <h2 className="text-3xl font-medium">{service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}</h2>
                <span className="text-sm font-medium text-accent-heading">{service.accessSeconds ? `/ ${formatAccessDuration(service.accessSeconds)}` : "Open access"}</span>
              </div>
              <p className="mt-2 text-xs text-subtle">Avalanche Fuji</p>
              <p className="mt-4 text-xs text-subtle">Switch to Client to buy access.</p>
            </div>
          )}
        </aside>
        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
          <section className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-medium">Operations</h2>
              </div>
              {stats ? (
                <p className="font-mono text-xs text-subtle">
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
        </div>
      </div>

      {/* The service page only describes the API: file download and Try API live in My passes. */}
      <PrivateFilesPanel service={service} activePass={activePass} summary />
      <EnsPanel service={service} isProviderView={isProviderView} />

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

export default function ServiceDetailPage() {
  return (
    <AuthGate title="Sign in to view this API">
      <ServiceDetail />
    </AuthGate>
  );
}
