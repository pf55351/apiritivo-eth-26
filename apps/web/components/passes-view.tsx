"use client";

import type { BlockTiming } from "@apiritivo/arkiv";
import type { AccessPass } from "@apiritivo/shared";
import { formatRemaining } from "@apiritivo/shared";
import Link from "next/link";
import { RefreshButton } from "@/components/refresh-button";
import { Button, EmptyState, EmptyStateIcon, ErrorNotice, SectionTitle, Skeleton, StatusDot } from "@/components/ui";
import type { FriendlyError } from "@/lib/errors";
import { remainingSeconds } from "@/lib/use-access";

const SKELETON_KEYS = ["p1", "p2"];

/** One bought pass: the API, how long is left, what it cost. Opens the pass page for the key, file and console. */
export function PassCard({ pass, timing }: { pass: AccessPass; timing: BlockTiming | null }) {
  const left = remainingSeconds(pass, timing);
  const active = left === null || left > 0;
  return (
    <li className="min-w-0">
      <Link
        href={`/passes/${pass.passKey}`}
        aria-label={`Open pass for ${pass.serviceName ?? pass.serviceId}`}
        className={`flex h-full min-w-0 flex-col gap-4 rounded-panel bg-surface p-5 transition-colors hover:bg-surface-active ${active ? "" : "opacity-70"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words text-lg font-medium">{pass.serviceName ?? pass.serviceId}</h3>
          <StatusDot tone={left === null ? "subtle" : active ? "success" : "subtle"} className="shrink-0">
            {left === null ? "Checking" : active ? `${formatRemaining(left)} left` : "Expired"}
          </StatusDot>
        </div>
        <dl className="mt-auto grid grid-cols-2 gap-4 border-t border-line pt-4">
          <div>
            <dt className="text-xs text-subtle">Paid</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">{pass.paidUsdc} USDC</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Pass</dt>
            <dd className="mt-1 truncate font-mono text-sm text-muted">{pass.passKey.slice(0, 10)}…</dd>
          </div>
        </dl>
        <span className="text-xs text-accent-text">Open pass ↗</span>
      </Link>
    </li>
  );
}

export function PassesView({
  data,
  initialLoading,
  refreshing,
  error,
  timing,
  reload,
  title = "My passes",
}: {
  data: AccessPass[] | null;
  initialLoading: boolean;
  refreshing: boolean;
  error: FriendlyError | null;
  timing: BlockTiming | null;
  reload: () => void;
  title?: string;
}) {
  const passes = data ?? [];
  return (
    <div className="space-y-8">
      <SectionTitle title={title} right={<RefreshButton refreshing={initialLoading || refreshing} onClick={reload} />} />
      <span role="status" className="sr-only">
        {refreshing ? "Refreshing passes. Your current list stays available." : ""}
      </span>
      {error ? (
        <ErrorNotice message={data !== null ? "Refresh failed. Showing your last loaded passes." : error.message} detail={error.detail ?? error.message} onRetry={reload} />
      ) : null}
      {initialLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_KEYS.map((k) => (
            <Skeleton key={k} className="h-40 rounded-panel" />
          ))}
        </div>
      ) : (!error || data !== null) && passes.length === 0 ? (
        <EmptyState
          icon={<EmptyStateIcon kind="pass" />}
          title="No active passes"
          description="Choose an API to get access."
          action={<Button href="/marketplace">Explore APIs</Button>}
        />
      ) : data !== null ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={refreshing}>
          {passes.map((p) => (
            <PassCard key={p.passKey} pass={p} timing={timing} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
