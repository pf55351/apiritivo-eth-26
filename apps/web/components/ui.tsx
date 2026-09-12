"use client";

import { categoryLabel } from "@apiritivo/shared";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { publicEnv } from "@/lib/env";
import { hueFor, initials, shortRef } from "@/lib/format";
import { useCopy } from "@/lib/use-copy";
import { CodePanel } from "./code-panel";

/* ---------- Buttons ---------- */

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "subtle" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  title?: string;
};

export function Button({ children, onClick, href, type = "button", variant = "primary", size = "md", disabled, className = "", title }: ButtonProps) {
  const cls = `ui-button ${className}`;
  if (href && !disabled) {
    return (
      <Link href={href} className={cls} data-variant={variant} data-size={size} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} data-variant={variant} data-size={size} title={title}>
      {children}
    </button>
  );
}

/* ---------- Pills & chips ---------- */

export function CategoryPill({ slug, className = "" }: { slug: string; className?: string }) {
  return <span className={`inline-flex items-center text-xs font-normal text-subtle ${className}`}>{categoryLabel(slug)}</span>;
}

/** Secondary information stays available without adding another panel. */
export function Disclosure({ title, children, meta }: { title: string; children: ReactNode; meta?: ReactNode }) {
  return (
    <details className="ui-disclosure">
      <summary>
        <span>{title}</span>
        {meta !== undefined && meta !== null ? <span className="ml-auto min-w-0 max-w-[50%] truncate text-xs font-normal text-subtle">{meta}</span> : null}
        <span aria-hidden="true" className="disclosure-chevron">
          ⌄
        </span>
      </summary>
      <div className="min-w-0 pb-5 pt-1">{children}</div>
    </details>
  );
}

export function ProofChip({ label, ok = true, title, href }: { label: "Arkiv" | "Swarm" | "Swarm ID"; ok?: boolean; title?: string; href?: string }) {
  const tone = ok ? "border-success/30 bg-success/10 text-success" : "border-line bg-surface-raised text-subtle";
  const content = (
    <span className={`inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-[11px] ${tone}`} title={title}>
      {label} {ok ? "✓" : "· Unverified"}
    </span>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="hover:opacity-80">
        {content}
      </a>
    );
  }
  return content;
}

/** One-word state with a coloured dot: "Funded", "Wrong network", "Ready". Colour is never the only signal. */
export function StatusDot({ children, tone, className = "" }: { children: ReactNode; tone: "success" | "warning" | "danger" | "subtle"; className?: string }) {
  const color = { success: "text-success", warning: "text-warning", danger: "text-danger", subtle: "text-subtle" }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${color} ${className}`}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  const tones = {
    neutral: "border-line bg-surface-raised text-muted",
    accent: "border-accent/30 bg-accent/10 text-accent-text",
    warn: "border-warning/30 bg-warning/10 text-warning",
  };
  return <span className={`inline-flex items-center rounded-control border px-2 py-0.5 text-xs font-normal ${tones[tone]}`}>{children}</span>;
}

/* ---------- Avatar ---------- */

/** Simple initials placeholder shared by the header and account menu. */
export function ProfileAvatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-active font-medium text-content-secondary"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
      role="img"
      aria-label={`${name} profile`}
    >
      {initials(name)}
    </span>
  );
}

export function Avatar({ name, seed, src, size = 36 }: { name: string; seed?: string; src?: string; size?: number }) {
  const hue = hueFor(seed ?? name);
  const style = {
    width: size,
    height: size,
    background: `hsl(${hue} 28% 73%)`,
    fontSize: Math.max(10, size * 0.36),
  };
  return (
    <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg font-semibold text-on-accent" style={style} role="img" aria-label={name}>
      {src ? (
        // biome-ignore lint/performance/noImgElement: avatar URLs come from Swarm ID and are not allow-listed for next/image
        <img src={src} alt={name} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* ---------- Copyable reference ---------- */

export function RefField({ label, value, href }: { label: string; value: string; href?: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-subtle">{label}</span>
      <div className="flex items-center gap-2">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="truncate font-mono text-xs text-content-secondary hover:text-accent-text" title={value}>
            {shortRef(value, 10, 8)}
          </a>
        ) : (
          <span className="truncate font-mono text-xs text-content-secondary" title={value}>
            {shortRef(value, 10, 8)}
          </span>
        )}
        <button
          type="button"
          onClick={() => void copy("ref", value)}
          aria-label={`Copy ${label}`}
          className="min-h-8 rounded-md border border-line px-2 text-[11px] text-subtle hover:border-line-strong hover:text-content"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
    </div>
  );
}

/* ---------- States ---------- */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function ServiceCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4 border-t border-line py-5">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="size-9 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-5 w-28" />
      <div className="flex min-h-11 items-center">
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function EmptyStateIcon({ kind = "api" }: { kind?: "api" | "search" | "pass" }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "search" ? (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </>
      ) : kind === "pass" ? (
        <>
          <path d="M4 5h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6V6a1 1 0 0 1 1-1Z" />
          <path d="M15 5v14" strokeDasharray="2 3" />
        </>
      ) : (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m8 9-3 3 3 3m8-6 3 3-3 3m-3-7-2 8" />
        </>
      )}
    </svg>
  );
}

export function EmptyState({ title, description, action, icon = <EmptyStateIcon /> }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <div aria-hidden="true" className="text-2xl text-accent-text">
        {icon}
      </div>
      <h3 className="text-base font-medium">{title}</h3>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorNotice({
  message,
  detail,
  onRetry,
  tone = "error",
  announce = true,
}: {
  message: string;
  detail?: string;
  onRetry?: () => void;
  tone?: "error" | "warn";
  /** Disable live announcements only for static examples in the UI library. */
  announce?: boolean;
}) {
  const tones = tone === "error" ? "border-danger text-danger" : "border-warning text-warning";
  return (
    <div role={announce ? (tone === "error" ? "alert" : "status") : undefined} className={`min-w-0 border-l-2 py-2 pl-4 text-sm ${tones}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">{message}</p>
        {onRetry ? (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
      {publicEnv.isDev && detail ? (
        <details className="mt-3">
          <summary className="min-h-9 cursor-pointer py-2 text-xs text-subtle">Debug details</summary>
          <pre className="mt-2 max-h-64 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface/80 p-3 font-mono text-[11px] leading-relaxed text-content-secondary">
            {detail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-11 w-fit max-w-full items-center gap-1.5 rounded-control text-sm text-subtle transition-colors hover:text-content">
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="m12 5-7 7 7 7M5 12h14" />
      </svg>
      <span className="sr-only">Back to </span>
      <span>{children}</span>
    </Link>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  right,
  back,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
  back?: { href: string; label: string };
}) {
  const heading = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
        <h1 className="section-heading">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
  return back ? (
    <div className="space-y-3">
      <BackLink href={back.href}>{back.label}</BackLink>
      {heading}
    </div>
  ) : (
    heading
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

/** Supplied brand artwork, framed to remove the exports' transparent margins. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-block h-8 w-11 shrink-0 overflow-hidden ${className}`}>
      <Image
        src="/brand/icons/apiritivo-symbol.png"
        alt=""
        width={1254}
        height={1254}
        sizes="56px"
        priority
        className="absolute left-1/2 top-1/2 h-14 w-14 max-w-none -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  );
}

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span role="img" aria-label="APIritivo" className={`relative inline-block h-10 w-48 shrink-0 overflow-hidden ${className}`}>
      {(["dark", "light"] as const).map((theme) => (
        <Image
          key={theme}
          src={`/brand/logos/apiritivo-logo-${theme}.png`}
          alt=""
          width={2172}
          height={724}
          sizes="208px"
          priority
          className={`theme-${theme}-only absolute left-1/2 top-1/2 h-auto w-[208px] max-w-none -translate-x-1/2 -translate-y-1/2`}
        />
      ))}
    </span>
  );
}

export function JsonInspector({ value, title = "Raw JSON", defaultOpen = false }: { value: unknown; title?: string; defaultOpen?: boolean }) {
  return (
    <details className="group min-w-0" open={defaultOpen}>
      <summary className="flex cursor-pointer items-center justify-between rounded-control py-3 text-sm text-muted hover:text-content">
        <span>{title}</span>
        <span className="text-xs transition-transform group-open:rotate-90">▸</span>
      </summary>
      <CodePanel title={title} code={JSON.stringify(value, null, 2) ?? "null"} />
    </details>
  );
}
