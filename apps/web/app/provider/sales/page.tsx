"use client";

import { formatPriceUsdc, sumUsdc } from "@apiritivo/shared";
import { type KeyboardEvent, useId, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { ContractPanel } from "@/components/contract-panel";
import { RefreshButton } from "@/components/refresh-button";
import { SalesReceipts } from "@/components/sales-receipts";
import { EarningsPanel } from "@/components/swarm-wallet-panel";
import { ErrorNotice, SectionTitle, Skeleton } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { useProviderSales } from "@/lib/use-access";
import { useProviderServices } from "@/lib/use-services";

type Tab = "receipts" | "activity";
const TABS: { id: Tab; label: string }[] = [
  { id: "receipts", label: "Receipts" },
  { id: "activity", label: "Payment activity" },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-2 text-2xl font-medium">{value}</p>
    </div>
  );
}

/** Sales history of the provider: Arkiv receipts in one tab, contract balances and claims in the other. */
function Sales() {
  const session = useSession();
  const identity = session.identity!;
  const sales = useProviderSales(identity.id);
  const services = useProviderServices(identity.id);
  const swarmWallet = useSwarmWallet();
  const [chainTick, setChainTick] = useState(0);
  const [tab, setTab] = useState<Tab>("receipts");
  const tabsId = useId();
  const list = sales.data ?? [];
  const serviceNames = new Map((services.data ?? []).map((s) => [s.serviceId, s.name]));

  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const index = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(index + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]!;
    setTab(next.id);
    document.getElementById(`${tabsId}-tab-${next.id}`)?.focus();
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Sales"
        description="Every purchase of your APIs: a permanent receipt on Arkiv, USDC held for you by the contract on Avalanche Fuji."
        right={
          <RefreshButton
            variant="subtle"
            refreshing={sales.refreshing}
            onClick={() => {
              sales.reload();
              setChainTick((n) => n + 1);
            }}
          />
        }
      />
      <div className="grid grid-cols-2 gap-6 border-b border-line pb-6">
        <Stat label="Recorded sales" value={sales.initialLoading ? "…" : sales.error && !sales.data ? "Unavailable" : String(list.length)} />
        <Stat label="Recorded revenue" value={sales.initialLoading ? "…" : sales.error && !sales.data ? "Unavailable" : formatPriceUsdc(sumUsdc(list.map((x) => x.paidUsdc)))} />
      </div>
      {sales.error ? (
        <ErrorNotice message={sales.data ? "Refresh failed. Showing your last loaded sales." : sales.error.message} detail={sales.error.detail} onRetry={sales.reload} />
      ) : null}
      <div>
        <div role="tablist" aria-label="Sales views" className="flex gap-1 border-b border-line" onKeyDown={onTabKey}>
          {TABS.map((t) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                id={`${tabsId}-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${tabsId}-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`-mb-px min-h-11 border-b-2 px-3 text-sm transition-colors ${selected ? "border-content text-content" : "border-transparent text-muted hover:text-content"}`}
              >
                {t.label}
                {t.id === "receipts" && sales.data ? <span className="ml-2 text-xs tabular-nums text-subtle">{list.length}</span> : null}
              </button>
            );
          })}
        </div>
        <div id={`${tabsId}-panel-receipts`} role="tabpanel" aria-labelledby={`${tabsId}-tab-receipts`} hidden={tab !== "receipts"} className="pt-2">
          {sales.initialLoading ? (
            <div className="space-y-3 pt-4">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : sales.data ? (
            <SalesReceipts sales={list} serviceNames={serviceNames} />
          ) : null}
        </div>
        <div id={`${tabsId}-panel-activity`} role="tabpanel" aria-labelledby={`${tabsId}-tab-activity`} hidden={tab !== "activity"} className="pt-2">
          <EarningsPanel refreshKey={chainTick} />
          {swarmWallet.address ? (
            <div className="mt-8 border-t border-line pt-6">
              <ContractPanel provider={swarmWallet.address} title="Contract activity" refreshKey={chainTick} inline />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ProviderSalesPage() {
  return (
    <AuthGate title="Sign in to see your sales">
      <Sales />
    </AuthGate>
  );
}
