"use client";

import { arkivEntityUrl } from "@apiritivo/arkiv";
import { type ArkivService, formatAccessDuration, formatPriceUsdc, type Grant, type Sale, sumUsdc } from "@apiritivo/shared";
import Link from "next/link";
import { ServiceFileAccess } from "./service-file-access";
import { CategoryPill, StatusDot } from "./ui";

/**
 * One published API on the provider dashboard: what it costs, what it earned,
 * and, when it ships a private file, who is waiting for access. Everything
 * about the API lives on its card; the page only adds wallet and history.
 */
export function ProviderApiCard({
  service,
  sales,
  salesLoaded,
  grants,
  onGranted,
}: {
  service: ArkivService;
  sales: Sale[];
  salesLoaded: boolean;
  grants: Grant[] | undefined;
  onGranted: () => void;
}) {
  const mine = sales.filter((s) => s.serviceId === service.serviceId);
  const earned = sumUsdc(mine.map((s) => s.paidUsdc));
  return (
    <article aria-label={service.name} className="flex min-w-0 flex-col gap-4 rounded-panel bg-surface p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryPill slug={service.category} />
            <StatusDot tone={service.available ? "success" : "subtle"}>{service.available ? "Available" : "Unavailable"}</StatusDot>
          </div>
          <h3 className="mt-2 break-words text-lg font-medium">
            <Link href={`/services/${service.serviceId}`} className="hover:text-accent-text">
              {service.name}
            </Link>
          </h3>
        </div>
        <p className="shrink-0 text-right text-sm text-content">
          {service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}
          <span className="block text-xs text-subtle">{service.accessSeconds ? `per ${formatAccessDuration(service.accessSeconds)}` : "open access"}</span>
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4">
        <div>
          <dt className="text-xs text-subtle">Earned</dt>
          <dd className="mt-1 text-xl font-medium">{salesLoaded ? formatPriceUsdc(earned) : "…"}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Sales</dt>
          <dd className="mt-1 text-xl font-medium">{salesLoaded ? mine.length : "…"}</dd>
        </div>
      </dl>
      {service.privateAttachment ? (
        <div className="border-t border-line pt-4">
          <ServiceFileAccess service={service} sales={sales} grants={grants} onGranted={onGranted} />
        </div>
      ) : null}
      <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-xs">
        <Link href={`/services/${service.serviceId}`} className="inline-flex min-h-9 items-center text-accent-text hover:underline">
          Open API ↗
        </Link>
        {service.entityKey ? (
          <a href={arkivEntityUrl(service.entityKey)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center text-subtle hover:text-content">
            Arkiv ↗
          </a>
        ) : null}
        <span className="ml-auto truncate font-mono text-subtle">{service.serviceId}</span>
      </footer>
    </article>
  );
}
