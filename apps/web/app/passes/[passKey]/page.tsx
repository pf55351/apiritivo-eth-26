"use client";

import { arkivEntityUrl, getAccessPass, getBlockTiming } from "@apiritivo/arkiv";
import { explorerTxUrl } from "@apiritivo/payments";
import type { AccessPass } from "@apiritivo/shared";
import { formatRemaining } from "@apiritivo/shared";
import { useParams } from "next/navigation";
import { ApiKeyBox } from "@/components/api-key-box";
import { AuthGate } from "@/components/auth-gate";
import { PassDetails } from "@/components/pass-details";
import { RefreshButton } from "@/components/refresh-button";
import { BackLink, Button, Disclosure, EmptyState, ErrorNotice, SectionTitle, Skeleton, StatusDot } from "@/components/ui";
import { useSession } from "@/lib/session";
import { remainingSeconds } from "@/lib/use-access";
import { usePassBearer } from "@/lib/use-pass-bearer";
import { useQuery } from "@/lib/use-query";

/** One pass of the signed-in Swarm ID: the API key, the private file and the console, with the receipt below. */
function Pass({ passKey }: { passKey: string }) {
  const session = useSession();
  const query = useQuery<AccessPass | null>(passKey, getAccessPass, "Could not load this pass from Arkiv.", getBlockTiming);
  const pass = query.data;
  const mine = pass ? pass.buyerId === session.identity?.id : false;
  const bearer = usePassBearer(mine ? pass : null);
  const back = <BackLink href="/passes">My passes</BackLink>;

  if (query.initialLoading) {
    return (
      <div className="space-y-6">
        {back}
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (query.error && !pass) {
    return (
      <div className="space-y-6">
        {back}
        <ErrorNotice message={query.error.message} detail={query.error.detail} onRetry={query.reload} />
      </div>
    );
  }
  if (!pass || !mine) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          icon={null}
          title={pass ? "This pass belongs to another Swarm ID" : "Pass not found"}
          description={pass ? "Sign in with the Swarm ID that bought it." : "It may have expired: passes are removed from Arkiv when their access ends."}
          action={<Button href="/passes">My passes</Button>}
        />
      </div>
    );
  }

  const left = remainingSeconds(pass, query.timing);
  const active = left === null || left > 0;
  return (
    <div className="space-y-8">
      {back}
      <SectionTitle
        eyebrow="Access pass"
        title={pass.serviceName ?? pass.serviceId}
        right={
          <div className="flex items-center gap-2">
            <RefreshButton variant="subtle" refreshing={query.refreshing} onClick={query.reload} />
            <Button href={`/services/${pass.serviceId}`} variant="subtle">
              View API
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-6 text-sm">
        <StatusDot tone={left === null ? "subtle" : active ? "success" : "subtle"}>
          {left === null ? "Checking expiry…" : active ? `${formatRemaining(left)} left` : "Expired"}
        </StatusDot>
        <span className="text-muted">Paid {pass.paidUsdc} USDC · Avalanche Fuji</span>
      </div>
      <section aria-label="API key" className="min-w-0">
        <h2 className="text-xl font-medium">API key</h2>
        <div className="mt-4">
          <ApiKeyBox serviceId={pass.serviceId} bearer={bearer} />
        </div>
      </section>
      <PassDetails pass={pass} active={active} />
      <Disclosure title="Receipt">
        <p className="break-all font-mono text-xs text-subtle">{pass.passKey}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          <a href={arkivEntityUrl(pass.passKey)} target="_blank" rel="noreferrer" className="py-2 hover:text-content">
            Pass on Arkiv ↗
          </a>
          <a href={explorerTxUrl(pass.txHash)} target="_blank" rel="noreferrer" className="py-2 hover:text-content">
            Payment ↗
          </a>
        </div>
      </Disclosure>
    </div>
  );
}

export default function PassPage() {
  const params = useParams<{ passKey: string }>();
  const passKey = typeof params?.passKey === "string" ? params.passKey : null;
  return (
    <AuthGate title="Sign in to open this pass">
      {passKey ? <Pass passKey={passKey} /> : <EmptyState title="Pass not found" action={<Button href="/passes">My passes</Button>} />}
    </AuthGate>
  );
}
