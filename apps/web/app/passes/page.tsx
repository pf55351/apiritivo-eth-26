"use client";

import { arkivEntityUrl } from "@apiritivo/arkiv";
import { explorerTxUrl } from "@apiritivo/payments";
import type { AccessPass } from "@apiritivo/shared";
import { formatRemaining } from "@apiritivo/shared";
import Link from "next/link";
import { ApiKeyBox } from "@/components/api-key-box";
import { WalletGate } from "@/components/auth-gate";
import { Button, Disclosure, EmptyState, ErrorNotice, SectionTitle, Skeleton } from "@/components/ui";
import { useActiveIdentity } from "@/lib/identity";
import { remainingSeconds, useMyPasses } from "@/lib/use-access";
import { usePassBearer } from "@/lib/use-pass-bearer";

function PassApiKey({ pass }: { pass: AccessPass }) {
  const bearer = usePassBearer(pass);
  return <ApiKeyBox serviceId={pass.serviceId} bearer={bearer} />;
}

function PassesList() {
  const identity = useActiveIdentity();
  const { data, loading, error, timing, reload } = useMyPasses(identity?.id ?? null);
  const passes = data ?? [];
  return (
    <div className="space-y-8">
      <SectionTitle
        title="My passes"
        right={
          <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
            Refresh
          </Button>
        }
      />
      {error ? <ErrorNotice message={error.message} detail={error.detail} onRetry={reload} /> : null}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : !error && passes.length === 0 ? (
        <EmptyState icon="◎" title="No active passes" description="Choose an API to get access." action={<Button href="/marketplace">Explore APIs</Button>} />
      ) : !error ? (
        <ul className="divide-y divide-line">
          {passes.map((p) => {
            const left = remainingSeconds(p, timing);
            return (
              <li key={p.passKey} className="min-w-0 py-6 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/services/${p.serviceId}`} className="break-words text-lg font-medium hover:text-accent-text">
                    {p.serviceName ?? p.serviceId}
                  </Link>
                  <span className={`text-xs font-semibold ${left !== null && left > 0 ? "text-success" : "text-subtle"}`}>
                    {left === null ? "Checking expiry…" : left <= 0 ? "Expired" : `${formatRemaining(left)} left`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-subtle">Paid {p.paidUsdc} USDC · Avalanche Fuji</p>
                <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <PassApiKey pass={p} />
                  </div>
                  <Button href={`/services/${p.serviceId}`}>Use API</Button>
                </div>
                <div className="mt-3">
                  <Disclosure title="Receipt">
                    <p className="break-all font-mono text-xs text-subtle">{p.passKey}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                      <a href={arkivEntityUrl(p.passKey)} target="_blank" rel="noreferrer" className="py-2 hover:text-content">
                        Pass ↗
                      </a>
                      <a href={explorerTxUrl(p.txHash)} target="_blank" rel="noreferrer" className="py-2 hover:text-content">
                        Payment ↗
                      </a>
                    </div>
                  </Disclosure>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function PassesPage() {
  return (
    <WalletGate title="Connect a wallet for your passes">
      <PassesList />
    </WalletGate>
  );
}
