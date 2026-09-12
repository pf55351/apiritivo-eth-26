"use client";

import { arkivEntityUrl } from "@apiritivo/arkiv";
import { explorerTxUrl } from "@apiritivo/payments";
import { formatAccessDuration, formatPriceUsdc, type Sale, sumUsdc } from "@apiritivo/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { ContractPanel } from "@/components/contract-panel";
import { LiveSales } from "@/components/live-sales";
import { PrivateGrantsPanel } from "@/components/private-grants-panel";
import { SwarmDriveChip } from "@/components/swarm-drive-chip";
import { SwarmWalletPanel } from "@/components/swarm-wallet-panel";
import { Badge, Button, Disclosure, EmptyState, ErrorNotice, SectionTitle, ServiceCardSkeleton } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { useProviderSales } from "@/lib/use-access";
import { useProviderServices } from "@/lib/use-services";

const SKELETON_KEYS = ["s1", "s2", "s3"];

type WriterStatus = {
  writerConfigured: boolean;
  address?: string;
  balance?: string;
  funded?: boolean;
  explorerUrl?: string;
  dataExplorerUrl?: string;
  faucetUrl: string;
} | null;

function useWriterStatus(): WriterStatus {
  const [status, setStatus] = useState<WriterStatus>(null);
  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setStatus(j))
      .catch(() => setStatus(null));
  }, []);
  return status;
}

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
  const { data, loading, error, reload } = useProviderServices(identity.id);
  const sales = useProviderSales(identity.id);
  const writer = useWriterStatus();

  const services = data ?? [];
  const salesList = sales.data ?? [];
  const revenue = sumUsdc(salesList.map((x) => x.paidUsdc));
  const earnedByService = new Map<string, string>();
  for (const svc of services) earnedByService.set(svc.serviceId, sumUsdc(salesList.filter((x) => x.serviceId === svc.serviceId).map((x) => x.paidUsdc)));
  const swarmWallet = useSwarmWallet();
  const [chainTick, setChainTick] = useState(0);
  // A sale lands on chain first; the server writes the Arkiv receipt right after
  // verifying it, so refresh Arkiv-backed lists a moment later (twice, to be safe).
  const onChainSale = useCallback(() => {
    setChainTick((n) => n + 1);
    setTimeout(() => sales.reload(), 4_000);
    setTimeout(() => sales.reload(), 15_000);
  }, [sales]);

  return (
    <div className="space-y-8">
      <SectionTitle
        title="My APIs"
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                reload();
                sales.reload();
                setChainTick((value) => value + 1);
              }}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button href="/provider/new">Publish API</Button>
          </div>
        }
      />
      {!session.canUpload ? (
        <ErrorNotice tone="warn" message="Publishing needs Swarm storage. Add a drive or enable the shared gateway." detail={session.uploadUnavailableReason} />
      ) : null}
      {writer && !writer.writerConfigured ? (
        <ErrorNotice tone="warn" message="Publishing is unavailable. Configure the server writer." detail="Set ARKIV_WRITER_PRIVATE_KEY on the server." />
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
      <div className="grid grid-cols-2 gap-6 border-b border-line pb-6 sm:grid-cols-3">
        <StatCard label="Published APIs" value={loading ? "…" : error ? "Unavailable" : String(services.length)} />
        <StatCard label="Recorded sales" value={sales.loading ? "…" : sales.error ? "Unavailable" : String(salesList.length)} />
        <StatCard label="Recorded revenue" value={sales.loading ? "…" : sales.error ? "Unavailable" : formatPriceUsdc(revenue)} />
      </div>
      {error ? <ErrorNotice message={error.message} detail={error.detail} onRetry={reload} /> : null}
      {sales.error ? <ErrorNotice message={sales.error.message} detail={sales.error.detail} onRetry={sales.reload} /> : null}
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="min-w-0 space-y-8">
          {loading ? (
            <div className="space-y-3">
              {SKELETON_KEYS.map((k) => (
                <ServiceCardSkeleton key={k} />
              ))}
            </div>
          ) : !error && services.length === 0 ? (
            <EmptyState title="Publish your first API" description="Set your price and start earning." action={<Button href="/provider/new">Publish API</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {services.map((service) => (
                <li key={service.serviceId} className="flex min-w-0 flex-wrap items-center justify-between gap-4 py-5 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/services/${service.serviceId}`} className="break-words text-base font-medium hover:text-accent-text">
                      {service.name} <span aria-hidden="true">↗</span>
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <p className="text-subtle">
                        {service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}
                        {service.accessSeconds ? ` / ${formatAccessDuration(service.accessSeconds)}` : ""}
                      </p>
                      <span className={service.available ? "text-olive-400" : "text-subtle"}>{service.available ? "Available" : "Unavailable"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-content">{sales.loading || sales.error ? "…" : formatPriceUsdc(earnedByService.get(service.serviceId) ?? "0")}</p>
                    <p className="mt-1 text-xs text-subtle">Earned</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <PrivateGrantsPanel services={services} sales={salesList} />
          {swarmWallet.address ? <LiveSales provider={swarmWallet.address} onSale={onChainSale} /> : null}
        </div>
        <aside className="min-w-0">
          <SwarmWalletPanel refreshKey={chainTick} />
        </aside>
      </div>
      <div>
        <SalesList list={salesList} />
        {swarmWallet.address ? <ContractPanel provider={swarmWallet.address} title="Payment activity" refreshKey={chainTick} /> : null}
        <Disclosure title="Connection details">
          <div className="space-y-4 text-xs text-subtle">
            <p className="break-all font-mono">Swarm ID: {identity.id}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={session.canUpload ? "neutral" : "warn"}>{session.canUpload ? "Storage ready" : "Storage unavailable"}</Badge>
              <SwarmDriveChip />
            </div>
            {writer ? (
              <div className="space-y-2">
                <p className="break-all font-mono">Writer: {writer.address ?? "Not configured"}</p>
                <p>{writer.balance ?? "…"} GLM</p>
                <div className="flex flex-wrap gap-4">
                  {writer.dataExplorerUrl ? (
                    <a href={writer.dataExplorerUrl} target="_blank" rel="noreferrer" className="py-2 hover:text-content">
                      Registry ↗
                    </a>
                  ) : null}
                  {writer.explorerUrl ? (
                    <a href={writer.explorerUrl} target="_blank" rel="noreferrer" className="py-2 hover:text-content">
                      Writer balance ↗
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </Disclosure>
      </div>
    </div>
  );
}

function SalesList({ list }: { list: Sale[] }) {
  if (list.length === 0) return null;
  return (
    <Disclosure title="Sales receipts" meta={list.length}>
      <ul className="divide-y divide-line">
        {list.slice(0, 20).map((x) => (
          <li key={x.saleKey} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <Link href={`/services/${x.serviceId}`} className="font-mono text-xs text-ink-300 hover:text-spritz-300">
              {x.serviceId}
            </Link>
            <span className="font-semibold text-olive-400">+{formatPriceUsdc(x.paidUsdc)}</span>
            <span className="flex flex-wrap gap-2 font-mono text-[11px] text-ink-400">
              <a href={arkivEntityUrl(x.saleKey)} target="_blank" rel="noreferrer" title="Sale receipt on Arkiv" className="hover:text-ink-100">
                receipt ↗
              </a>
              {x.passKey ? (
                <a href={arkivEntityUrl(x.passKey)} target="_blank" rel="noreferrer" title="Access pass on Arkiv" className="hover:text-ink-100">
                  pass ↗
                </a>
              ) : null}
              <a href={explorerTxUrl(x.txHash)} target="_blank" rel="noreferrer" title="Payment on SnowTrace" className="hover:text-ink-100">
                {x.txHash.slice(0, 10)}… ↗
              </a>
            </span>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

export default function ProviderPage() {
  return (
    <AuthGate title="Sign in to manage APIs">
      <Dashboard />
    </AuthGate>
  );
}
