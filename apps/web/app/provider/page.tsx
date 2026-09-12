"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { useProviderServices } from "@/lib/use-services";
import { useProviderSales } from "@/lib/use-access";
import { formatPriceUsdc, sumUsdc } from "@apiritivo/shared";
import Link from "next/link";
import { arkivEntityUrl } from "@apiritivo/arkiv";
import { explorerTxUrl } from "@apiritivo/payments";
import { SwarmWalletPanel } from "@/components/swarm-wallet-panel";
import { SwarmDriveChip } from "@/components/swarm-drive-chip";
import { LiveSales } from "@/components/live-sales";
import { PrivateGrantsPanel } from "@/components/private-grants-panel";
import { ContractPanel } from "@/components/contract-panel";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { AuthGate } from "@/components/auth-gate";
import { ServiceCard } from "@/components/service-card";
import { Avatar, Badge, Button, EmptyState, ErrorNotice, SectionTitle, ServiceCardSkeleton } from "@/components/ui";

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

function StatCard({ label, value, hint, badge }: { label: string; value: string; hint?: string; badge?: string }) {
  return (
    <div className="card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">{label}</p>
        {badge ? <Badge tone="warn">{badge}</Badge> : null}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
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
  const available = services.filter((s) => s.available).length;
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
        eyebrow="Provider"
        title="Your services"
        description={loading ? "Loading your services from Arkiv…" : `${services.length} published ${services.length === 1 ? "service" : "services"}`}
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
              Refresh
            </Button>
            <Button href="/provider/new">+ Publish Service</Button>
          </div>
        }
      />

      <div className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4">
        <Avatar name={identity.name} seed={identity.id} src={identity.avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{identity.name}</p>
          <p className="break-all font-mono text-[11px] text-ink-400">providerId · {identity.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">Swarm ID ✓</Badge>
          <Badge tone={session.canUpload ? "accent" : "warn"}>
            {session.canUpload ? `Swarm upload ✓${session.uploadMode === "subsidised" ? " · subsidised" : session.uploadMode === "user-stamp" ? " · own stamp" : ""}` : "Swarm upload unavailable"}
          </Badge>
          <SwarmDriveChip />
          {writer ? (
            <Badge tone={writer.writerConfigured && writer.funded !== false ? "accent" : "warn"}>
              {!writer.writerConfigured ? "Arkiv writer not configured" : writer.funded === false ? "Arkiv writer unfunded" : "Arkiv writer ✓"}
            </Badge>
          ) : null}
        </div>
      </div>

      {!session.canUpload ? (
        <ErrorNotice
          tone="warn"
          message="Swarm upload unavailable for this identity. You can browse and view your dashboard, but publishing requires Swarm upload capability: add a drive in Swarm ID (Storage → Add drive, or import an existing batch), or configure the subsidised gateway in NEXT_PUBLIC_SWARM_SUBSIDISED_GATEWAY_URL."
          detail={session.uploadUnavailableReason ? `uploadMode=${session.uploadMode ?? "?"} reason=${session.uploadUnavailableReason}` : undefined}
        />
      ) : null}
      {writer && !writer.writerConfigured ? (
        <ErrorNotice tone="warn" message="Arkiv writer not configured on the server. Set ARKIV_WRITER_PRIVATE_KEY to enable publishing." />
      ) : null}
      {writer && writer.writerConfigured && writer.funded === false ? (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          <p className="font-medium">Arkiv writer has 0 GLM on Tiramisu, so publishing will fail until it is funded.</p>
          <p className="mt-1 break-all font-mono text-xs text-amber-200/90">{writer.address}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={writer.faucetUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-full bg-amber-300 px-3 text-xs font-semibold text-ink-950 hover:bg-amber-200">
              Get testnet GLM at the Arkiv faucet ↗
            </a>
            {writer.explorerUrl ? (
              <a href={writer.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-full border border-amber-300/40 px-3 text-xs text-amber-100 hover:bg-amber-300/10">
                Balance on Tiramisu explorer ↗
              </a>
            ) : null}
            {writer.dataExplorerUrl ? (
              <a href={writer.dataExplorerUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-full border border-amber-300/40 px-3 text-xs text-amber-100 hover:bg-amber-300/10">
                Entities on Arkiv Data Explorer ↗
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {writer && writer.writerConfigured && writer.funded ? (
        <p className="text-xs text-ink-400">
          Arkiv writer <span className="break-all font-mono text-ink-300">{writer.address}</span> · {Number(writer.balance).toFixed(4)} GLM ·{" "}
          {writer.dataExplorerUrl ? (
            <a href={writer.dataExplorerUrl} target="_blank" rel="noreferrer" className="text-spritz-300 hover:underline">
              entities on Arkiv Data Explorer ↗
            </a>
          ) : null}
          {writer.explorerUrl ? (
            <>
              {" · "}
              <a href={writer.explorerUrl} target="_blank" rel="noreferrer" className="text-spritz-300 hover:underline">
                balance on Tiramisu explorer ↗
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Published" value={loading ? "…" : String(services.length)} hint="Service entities on Arkiv" />
        <StatCard label="Available" value={loading ? "…" : String(available)} hint="Visible in the marketplace" />
        <StatCard
          label="Earnings"
          value={sales.loading ? "…" : formatPriceUsdc(revenue)}
          hint={`${salesList.length} ${salesList.length === 1 ? "sale" : "sales"} · USDC on Avalanche Fuji, paid to your payout wallet`}
        />
      </div>

      {error ? <ErrorNotice message={error.message} detail={error.detail} onRetry={reload} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <SwarmWalletPanel />
        <ContractPanel provider={swarmWallet.address ?? undefined} title="Your on-chain revenue" refreshKey={chainTick} />
      </div>
      <LiveSales provider={swarmWallet.address ?? undefined} onSale={onChainSale} />
      <PrivateGrantsPanel services={services} sales={salesList} />

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ServiceCardSkeleton key={i} />
          ))}
        </div>
      ) : !error && services.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No services published yet."
          description="Publish your first service: the manifest goes to Swarm, the registry entry to Arkiv."
          action={<Button href="/provider/new">+ Publish Service</Button>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div key={s.serviceId} className="relative">
              <ServiceCard service={s} showAvailability />
              <div className="pointer-events-none absolute right-5 top-14 font-mono text-[10px] text-olive-400">
                earned · {formatPriceUsdc(earnedByService.get(s.serviceId) ?? "0")}
              </div>
            </div>
          ))}
        </div>
      )}
      <SalesList providerId={identity.id} />
    </div>
  );
}

function SalesList({ providerId }: { providerId: string }) {
  const sales = useProviderSales(providerId);
  const list = sales.data ?? [];
  if (sales.loading || list.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Recent sales</h2>
      <ul className="divide-y divide-white/10 rounded-2xl border border-white/15 bg-ink-900/40">
        {list.slice(0, 20).map((x) => (
          <li key={x.saleKey} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
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
    </section>
  );
}

export default function ProviderPage() {
  return (
    <AuthGate title="Sign in to open your provider dashboard">
      <Dashboard />
    </AuthGate>
  );
}
