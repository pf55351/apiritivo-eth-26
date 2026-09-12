"use client";

import Link from "next/link";
import { formatAccessDuration, formatPriceUsdc, type ArkivService } from "@apiperitivo/shared";
import { arkivEntityUrl } from "@apiperitivo/arkiv";
import { swarmReferenceUrl } from "@apiperitivo/swarm";
import { Avatar, CategoryPill, ProofChip } from "./ui";

export function ServiceCard({ service, showAvailability = false }: { service: ArkivService; showAvailability?: boolean }) {
  const provider = service.providerName?.trim() || service.providerId;
  return (
    <article className="card group relative flex min-w-0 flex-col gap-4 rounded-2xl p-5 animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <CategoryPill slug={service.category} />
        {showAvailability ? (
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${service.available ? "text-olive-400" : "text-ink-400"}`}>
            {service.available ? "● Available" : "○ Unavailable"}
          </span>
        ) : null}
      </div>
      <div className="min-h-[4.5rem]">
        <h3 className="text-lg font-semibold leading-snug tracking-tight text-ink-100 group-hover:text-spritz-300">
          <Link href={`/services/${service.serviceId}`} className="after:absolute after:inset-0">
            {service.name}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-300">{service.description}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <Avatar name={provider} seed={service.providerId} size={28} />
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-200">by {provider}</p>
          <p className="truncate font-mono text-[10px] text-ink-400" title={service.serviceId}>
            {service.serviceId}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl border border-white/15 bg-ink-900/60 px-3 py-2">
        <span className="text-base font-semibold text-spritz-300">{service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}</span>
        <span className="text-xs text-ink-300">{service.accessSeconds ? `${formatAccessDuration(service.accessSeconds)} access` : "open access"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative z-10 flex gap-2">
          <ProofChip label="Arkiv" title="Open entity on Arkiv explorer (Tiramisu)" href={service.entityKey ? arkivEntityUrl(service.entityKey) : undefined} />
          <ProofChip label="Swarm" title="Open manifest on Swarm gateway" href={swarmReferenceUrl(service.manifestRef)} />
        </span>
        <span className="ml-auto font-mono text-[10px] text-ink-400">v{service.version}</span>
      </div>
      <span className="mt-1 inline-flex h-10 items-center justify-center rounded-full border border-white/15 text-sm font-medium text-ink-100 transition group-hover:border-spritz-400/60 group-hover:bg-spritz-500 group-hover:text-ink-950">
        View service →
      </span>
    </article>
  );
}
