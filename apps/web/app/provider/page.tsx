"use client";

import { formatPriceUsdc, sumUsdc } from "@apiritivo/shared";
import Link from "next/link";
import { useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { ProviderApiCard } from "@/components/provider-api-card";
import { RefreshButton } from "@/components/refresh-button";
import { useFileGrants } from "@/components/service-file-access";
import { Button, EmptyState, ErrorNotice, SectionTitle, Skeleton } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { useProviderSales } from "@/lib/use-access";
import { useProviderStats } from "@/lib/use-provider-stats";
import { useProviderServices } from "@/lib/use-services";
import { useWriterStatus } from "@/lib/use-writer-status";

const SKELETON_KEYS = ["s1", "s2"];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-2 text-2xl font-medium">{value}</p>
    </div>
  );
}

function Dashboard() {
  const session = useSession();
  const identity = session.identity!;
  const services = useProviderServices(identity.id);
  const sales = useProviderSales(identity.id);
  const [writerTick, setWriterTick] = useState(0);
  const list = services.data ?? [];
  const grants = useFileGrants(list);
  const writer = useWriterStatus(true, writerTick) ?? null;

  const salesList = sales.data ?? [];
  const revenue = sumUsdc(salesList.map((x) => x.paidUsdc));
  const [chainTick, setChainTick] = useState(0);
  const swarmWallet = useSwarmWallet();
  const { stats, contractMode } = useProviderStats(swarmWallet.address, chainTick);
  const refreshing = services.refreshing || sales.refreshing;

  return (
    <div className="space-y-8">
      <SectionTitle
        title="My APIs"
        right={
          <div className="flex items-center gap-2">
            <RefreshButton
              variant="subtle"
              onClick={() => {
                services.reload();
                sales.reload();
                grants.reload();
                setChainTick((value) => value + 1);
                setWriterTick((value) => value + 1);
              }}
              refreshing={refreshing}
            />
            <Button href="/provider/new">Publish API</Button>
          </div>
        }
      />
      <span role="status" className="sr-only">
        {refreshing ? "Refreshing your APIs. The current list stays available." : ""}
      </span>
      {!session.canUpload ? (
        <ErrorNotice tone="warn" message="Publishing needs Swarm storage. Add a drive or enable the shared gateway." detail={session.uploadUnavailableReason} />
      ) : null}
      {writer && !writer.writerConfigured ? (
        <ErrorNotice tone="warn" message="Publishing is unavailable. Configure the server writer." detail="Set ARKIV_WRITER_PRIVATE_KEY on the server." />
      ) : null}
      {writer?.ownerMismatch ? (
        <ErrorNotice
          tone="warn"
          message="Publishing is unavailable. The writer key does not match the trusted writer address."
          detail={`The server signs as ${writer.address} but reads trust ${writer.trustedOwner}. Set NEXT_PUBLIC_ARKIV_WRITER_ADDRESS to match.`}
        />
      ) : null}
      {writer?.writerConfigured && writer.funded === false ? (
        <div className="text-sm text-muted">
          <p>Publishing needs GLM on Tiramisu.</p>
          <a href={writer.faucetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center text-accent-text">
            Fund writer ↗
          </a>
          <p className="break-all font-mono text-xs text-subtle">{writer.address}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-6 border-b border-line pb-6 sm:grid-cols-4">
        <StatCard label="Published APIs" value={services.initialLoading ? "…" : services.error && !services.data ? "Unavailable" : String(list.length)} />
        <StatCard label="Sales" value={sales.initialLoading ? "…" : sales.error && !sales.data ? "Unavailable" : String(salesList.length)} />
        <StatCard label="Revenue" value={sales.initialLoading ? "…" : sales.error && !sales.data ? "Unavailable" : formatPriceUsdc(revenue)} />
        <div>
          <p className="text-xs text-subtle">{contractMode ? "Ready to claim" : "In your wallet"}</p>
          <p className="mt-2 text-2xl font-medium text-accent-text">
            {contractMode ? (stats ? formatPriceUsdc(stats.claimableUsdc) : "…") : swarmWallet.balances ? formatPriceUsdc(swarmWallet.balances.usdc) : "…"}
          </p>
          <Link href="/provider/sales" className="mt-1 inline-flex min-h-9 items-center text-xs text-accent-text hover:underline">
            {contractMode ? "Claim in Sales ↗" : "Sales ↗"}
          </Link>
        </div>
      </div>
      {services.error ? (
        <ErrorNotice message={services.data ? "Refresh failed. Showing your last loaded APIs." : services.error.message} detail={services.error.detail} onRetry={services.reload} />
      ) : null}
      {sales.error ? (
        <ErrorNotice message={sales.data ? "Refresh failed. Showing your last loaded sales." : sales.error.message} detail={sales.error.detail} onRetry={sales.reload} />
      ) : null}
      {grants.error ? <ErrorNotice message={grants.error.message} detail={grants.error.detail} onRetry={grants.reload} /> : null}
      <div className="min-w-0">
        {services.initialLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {SKELETON_KEYS.map((k) => (
              <Skeleton key={k} className="h-56 rounded-panel" />
            ))}
          </div>
        ) : services.data && list.length === 0 ? (
          <EmptyState title="Publish your first API" description="Set your price and start earning." action={<Button href="/provider/new">Publish API</Button>} />
        ) : services.data ? (
          <div className="grid gap-4 lg:grid-cols-2" aria-busy={services.refreshing}>
            {list.map((service) => (
              <ProviderApiCard
                key={service.serviceId}
                service={service}
                sales={salesList}
                salesLoaded={Boolean(sales.data)}
                grants={grants.data?.[service.serviceId]}
                onGranted={grants.reload}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ProviderPage() {
  return (
    <AuthGate title="Sign in to manage APIs">
      <Dashboard />
    </AuthGate>
  );
}
