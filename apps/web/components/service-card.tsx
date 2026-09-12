"use client";

import { type ArkivService, formatAccessDuration, formatPriceUsdc } from "@apiritivo/shared";
import Link from "next/link";
import { type ReactNode, useId, useState } from "react";
import { EnsBadge } from "./ens-panel";
import { ProfileAvatar } from "./ui";

export function ServiceCard({ service, showAvailability = false }: { service: ArkivService; showAvailability?: boolean }) {
  const provider = service.providerName?.trim() || service.providerId;
  return (
    <article className="group relative flex min-w-0 flex-col gap-4 rounded-panel border border-transparent bg-surface p-5 transition-colors hover:border-line-strong focus-within:border-line-strong">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="min-w-0 break-words text-lg font-semibold leading-snug text-content group-hover:text-accent-text sm:text-xl">
            <Link href={`/services/${service.serviceId}`} className="after:absolute after:inset-0">
              {service.name}
            </Link>
          </h3>
          <CardTooltip label={`Provider: ${provider}`} content={provider} side="below" round>
            <span aria-hidden="true">
              <ProfileAvatar name={provider} size={36} />
            </span>
          </CardTooltip>
        </div>
        <p className="mt-1.5 min-h-5 truncate text-sm text-muted">{service.description}</p>
      </div>
      {showAvailability || service.ensName ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {showAvailability ? (
            <span className={`text-xs font-normal ${service.available ? "text-success" : "text-subtle"}`}>{service.available ? "● Available" : "○ Unavailable"}</span>
          ) : null}
          {service.ensName ? (
            <span className="relative z-10 ml-auto min-w-0">
              <EnsBadge service={service} />
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line pt-4">
        <span className="text-lg font-medium text-content">{service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}</span>
        <span className="text-xs font-medium text-accent-heading">{service.accessSeconds ? `${formatAccessDuration(service.accessSeconds)} access` : "open access"}</span>
      </div>
      <div className="mt-auto flex min-h-9 items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors group-hover:text-accent-text">
          View API <span aria-hidden="true">↗</span>
        </span>
        {service.privateAttachment ? <PrivateFileIndicator /> : null}
      </div>
    </article>
  );
}

function CardTooltip({
  label,
  children,
  content,
  side = "above",
  round = false,
}: {
  label: string;
  children: ReactNode;
  content: ReactNode;
  side?: "above" | "below";
  round?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`relative shrink-0 ${open ? "z-20" : "z-10"}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className={`inline-flex size-11 items-center justify-center text-subtle transition-colors hover:bg-surface-active hover:text-accent-text focus-visible:text-accent-text ${round ? "rounded-full" : "rounded-control"}`}
      >
        {children}
      </button>
      {open ? (
        <div className={`absolute right-0 w-max max-w-[min(15rem,calc(100vw-2rem))] ${side === "below" ? "top-full pt-2" : "bottom-full pb-2"}`}>
          <div
            id={id}
            role="tooltip"
            className="break-words rounded-control border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-content shadow-lg [overflow-wrap:anywhere]"
          >
            {content}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PrivateFileIndicator() {
  return (
    <CardTooltip
      label="Private file included"
      content={
        <>
          <p className="font-medium">Private file included</p>
          <p className="mt-1 text-muted">Provider approval is needed to download it.</p>
        </>
      }
    >
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
      </svg>
    </CardTooltip>
  );
}
