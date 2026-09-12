"use client";

import { type ReadinessCheck, stateLabel } from "@/lib/readiness";
import { RefreshButton } from "./refresh-button";
import { StatusDot } from "./ui";

const STATE_TONE: Record<ReadinessCheck["state"], "success" | "warning" | "danger" | "subtle"> = {
  ok: "success",
  low: "warning",
  missing: "danger",
  info: "subtle",
  loading: "subtle",
  unknown: "subtle",
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
                <StatusDot tone={STATE_TONE[check.state]} className="shrink-0">
                  {stateLabel(check.state)}
                </StatusDot>
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
