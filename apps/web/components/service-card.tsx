"use client";

import { type ArkivService, formatAccessDuration, formatPriceUsdc } from "@apiritivo/shared";
import Link from "next/link";
import { Avatar, CategoryPill } from "./ui";

export function ServiceCard({ service, showAvailability = false }: { service: ArkivService; showAvailability?: boolean }) {
  const provider = service.providerName?.trim() || service.providerId;
  return (
    <article className="group relative flex min-w-0 flex-col gap-4 border-t border-line py-5 transition-colors hover:border-line-strong focus-within:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <CategoryPill slug={service.category} />
        {showAvailability ? (
          <span className={`text-xs font-normal ${service.available ? "text-olive-400" : "text-ink-400"}`}>{service.available ? "● Available" : "○ Unavailable"}</span>
        ) : null}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-medium leading-snug text-ink-100 group-hover:text-spritz-300">
          <Link href={`/services/${service.serviceId}`} className="after:absolute after:inset-0">
            {service.name}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 break-words text-sm text-ink-300">{service.description}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <Avatar name={provider} seed={service.providerId} size={28} />
        <div className="min-w-0">
          <p className="truncate text-xs text-subtle">{provider}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-1">
        <span className="text-lg font-medium text-content">{service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}</span>
        <span className="text-xs text-ink-300">{service.accessSeconds ? `${formatAccessDuration(service.accessSeconds)} access` : "open access"}</span>
      </div>
      {service.privateAttachment ? <span className="text-xs text-subtle">Private file included</span> : null}
      <span className="inline-flex items-center justify-between pt-1 text-xs text-muted transition-colors group-hover:text-accent-text">
        View API <span aria-hidden="true">↗</span>
      </span>
    </article>
  );
}
