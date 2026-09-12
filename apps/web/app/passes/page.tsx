"use client";

import Link from "next/link";
import { formatRemaining } from "@apiritivo/shared";
import { arkivEntityUrl } from "@apiritivo/arkiv";
import { explorerTxUrl } from "@apiritivo/payments";
import { useSession } from "@/lib/session";
import { remainingSeconds, useMyPasses } from "@/lib/use-access";
import { AuthGate } from "@/components/auth-gate";
import { Button, EmptyState, ErrorNotice, SectionTitle, Skeleton } from "@/components/ui";
import { usePassBearer } from "@/lib/use-pass-bearer";
import { ApiKeyBox } from "@/components/api-key-box";
import type { AccessPass } from "@apiritivo/shared";

function PassApiKey({ pass }: { pass: AccessPass }) {
  const bearer = usePassBearer(pass);
  return <ApiKeyBox serviceId={pass.serviceId} bearer={bearer} />;
}

function PassesList() {
  const session = useSession();
  const { data, loading, error, timing, reload } = useMyPasses(session.identity?.id ?? null);
  const passes = data ?? [];
  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Client"
        title="My access passes"
        description="Live passes on Arkiv. Your API key is passKey.secret: the secret is decrypted here with your Swarm ID, only its hash is on-chain. When a pass expires, Arkiv removes it and the bot stops answering."
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
      ) : passes.length === 0 ? (
        <EmptyState icon="◎" title="No active passes." description="Buy access to a service from the marketplace." action={<Button href="/marketplace">Open marketplace</Button>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {passes.map((p) => {
            const left = remainingSeconds(p, timing);
            return (
              <li key={p.passKey} className="card min-w-0 rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/services/${p.serviceId}`} className="text-lg font-semibold hover:text-spritz-300">
                    {p.serviceName ?? p.serviceId}
                  </Link>
                  <span className={`text-xs font-semibold ${left !== null && left > 0 ? "text-olive-400" : "text-ink-400"}`}>
                    {left === null ? "…" : formatRemaining(left) + " left"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-400">{p.serviceId} · paid {p.paidUsdc} USDC</p>
                <p className="mt-3 break-all font-mono text-[11px] text-ink-400">pass {p.passKey}</p>
                <div className="mt-3">
                  <PassApiKey pass={p} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <a href={arkivEntityUrl(p.passKey)} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-2.5 py-0.5 text-ink-300 hover:text-ink-100">
                    Arkiv explorer ↗
                  </a>
                  <a href={explorerTxUrl(p.txHash)} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-2.5 py-0.5 text-ink-300 hover:text-ink-100">
                    payment tx ↗
                  </a>
                  <Link href={`/services/${p.serviceId}`} className="rounded-full bg-spritz-500 px-2.5 py-0.5 font-semibold text-ink-950 hover:bg-spritz-400">
                    Use it →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function PassesPage() {
  return (
    <AuthGate title="Sign in to see your access passes">
      <PassesList />
    </AuthGate>
  );
}
