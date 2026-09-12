"use client";

import { type ArkivService, formatAccessDuration, formatPriceUsdc } from "@apiritivo/shared";
import Link from "next/link";
import { EnsBadge } from "./ens-panel";
import { Avatar } from "./ui";

export function ServiceCard({ service, showAvailability = false }: { service: ArkivService; showAvailability?: boolean }) {
  const provider = service.providerName?.trim() || service.providerId;
  return (
    <article className="group relative flex min-w-0 flex-col gap-4 self-start border-t border-line py-5 transition-colors hover:border-line-strong focus-within:border-line-strong">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words text-lg font-semibold leading-snug text-content group-hover:text-accent-text sm:text-xl">
            <Link href={`/services/${service.serviceId}`} className="after:absolute after:inset-0">
              {service.name}
            </Link>
          </h3>
          {showAvailability ? (
            <span className={`shrink-0 pt-1 text-xs font-normal ${service.available ? "text-success" : "text-subtle"}`}>{service.available ? "● Available" : "○ Unavailable"}</span>
          ) : null}
        </div>
        <p className="mt-1.5 line-clamp-2 break-words text-sm text-muted">{service.description}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <Avatar name={provider} seed={service.providerId} size={28} />
        <div className="min-w-0">
          <p className="truncate text-xs text-subtle">{provider}</p>
        </div>
        {service.ensName ? (
          <span className="relative z-10 ml-auto min-w-0">
            <EnsBadge service={service} />
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-2">
        <span className="text-lg font-medium text-content">{service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}</span>
        <span className="text-xs text-muted">{service.accessSeconds ? `${formatAccessDuration(service.accessSeconds)} access` : "open access"}</span>
      </div>
      {service.privateAttachment ? <span className="text-xs text-subtle">Private file included</span> : null}
      <span className="inline-flex items-center gap-1.5 self-start pt-1 text-xs text-muted transition-colors group-hover:text-accent-text">
        View API <span aria-hidden="true">↗</span>
      </span>
    </article>
  );
}
