"use client";

import { type ReadinessCheck, stateLabel } from "@/lib/readiness";
import { RefreshButton } from "./refresh-button";

const STATE_TONE: Record<ReadinessCheck["state"], string> = {
  ok: "text-success",
  low: "text-warning",
  missing: "text-danger",
  info: "text-subtle",
  loading: "text-subtle",
  unknown: "text-subtle",
};

export function ReadinessPanel({
  id,
  title,
  checks,
  refreshing = false,
  onRefresh,
}: {
  id?: string;
  title: string;
  checks: ReadinessCheck[];
  refreshing?: boolean;
  onRefresh: () => void;
}) {
  return (
    <section id={id} aria-label={title} className="max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-panel border border-line bg-surface shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium text-content">{title}</h2>
        <RefreshButton variant="subtle" onClick={onRefresh} refreshing={refreshing} />
      </div>
      <ul className="divide-y divide-line px-4">
        {checks.map((check) => {
          const showAction = check.href && check.state !== "ok" && check.state !== "info";
          return (
            <li key={check.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-content">{check.label}</span>
                <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${STATE_TONE[check.state]}`}>
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                  {stateLabel(check.state)}
                </span>
              </div>
              {check.value || showAction ? (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  {check.value ? <span className="min-w-0 break-words text-sm tabular-nums text-muted">{check.value}</span> : null}
                  {showAction ? (
                    <a
                      href={check.href}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-control text-xs text-accent-text hover:underline"
                    >
                      {check.hrefLabel} <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
