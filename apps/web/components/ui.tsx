"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { categoryLabel } from "@apiperitivo/shared";
import { publicEnv } from "@/lib/env";
import { copyText, hueFor, initials, shortRef } from "@/lib/format";

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

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-spritz-400/70 disabled:cursor-not-allowed disabled:opacity-50";
const variants = {
  primary:
    "bg-spritz-500 text-ink-950 hover:bg-spritz-400 shadow-[0_10px_30px_-10px_rgb(255_122_26_/0.7)] hover:shadow-glow",
  ghost: "border border-white/15 text-ink-100 hover:border-spritz-400/50 hover:bg-white/5",
  subtle: "text-ink-300 hover:text-ink-100 hover:bg-white/5",
  danger: "border border-rose-400/40 text-rose-400 hover:bg-rose-400/10",
};
const sizes = { sm: "h-8 shrink-0 px-3 text-xs", md: "h-10 px-5 text-sm", lg: "h-12 px-7 text-base" };

export function Button({
  children,
  onClick,
  href,
  type = "button",
  variant = "primary",
  size = "md",
  disabled,
  className = "",
  title,
}: ButtonProps) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  if (href && !disabled) {
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} title={title}>
      {children}
    </button>
  );
}

/* ---------- Pills & chips ---------- */

const CATEGORY_TONES: Record<string, string> = {
  "market-data": "bg-spritz-500/15 text-spritz-300 border-spritz-500/30",
  "ai-text": "bg-rose-400/15 text-rose-400 border-rose-400/30",
  "ai-vision": "bg-fuchsia-400/15 text-fuchsia-300 border-fuchsia-400/30",
  weather: "bg-sky-400/15 text-sky-300 border-sky-400/30",
  geo: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  identity: "bg-violet-400/15 text-violet-300 border-violet-400/30",
  payments: "bg-olive-400/15 text-olive-400 border-olive-400/30",
  storage: "bg-amber-300/15 text-amber-200 border-amber-300/30",
  messaging: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30",
  analytics: "bg-indigo-400/15 text-indigo-300 border-indigo-400/30",
  utility: "bg-white/10 text-ink-200 border-white/15",
};

export function CategoryPill({ slug, className = "" }: { slug: string; className?: string }) {
  const tone = CATEGORY_TONES[slug] ?? "bg-white/10 text-ink-200 border-white/15";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${tone} ${className}`}
    >
      {categoryLabel(slug)}
    </span>
  );
}

export function ProofChip({
  label,
  ok = true,
  title,
  href,
}: {
  label: "Arkiv" | "Swarm" | "Swarm ID";
  ok?: boolean;
  title?: string;
  href?: string;
}) {
  const tone = ok
    ? "border-olive-400/30 bg-olive-400/10 text-olive-400"
    : "border-white/15 bg-white/5 text-ink-400";
  const content = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] ${tone}`}
      title={title}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label} {ok ? "✓" : "–"}
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

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  const tones = {
    neutral: "border-white/15 bg-white/5 text-ink-300",
    accent: "border-spritz-500/30 bg-spritz-500/10 text-spritz-300",
    warn: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ---------- Avatar ---------- */

export function Avatar({
  name,
  seed,
  src,
  size = 36,
}: {
  name: string;
  seed?: string;
  src?: string;
  size?: number;
}) {
  const hue = hueFor(seed ?? name);
  const style = {
    width: size,
    height: size,
    background: `linear-gradient(135deg, hsl(${hue} 80% 60%), hsl(${(hue + 50) % 360} 80% 45%))`,
    fontSize: Math.max(10, size * 0.36),
  };
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-ink-950 ring-2 ring-white/10"
      style={style}
      aria-label={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* ---------- Copyable reference ---------- */

export function RefField({ label, value, href }: { label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</span>
      <div className="flex items-center gap-2">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="truncate font-mono text-xs text-ink-200 hover:text-spritz-300" title={value}>
            {shortRef(value, 10, 8)}
          </a>
        ) : (
          <span className="truncate font-mono text-xs text-ink-200" title={value}>
            {shortRef(value, 10, 8)}
          </span>
        )}
        <button
          type="button"
          onClick={async () => {
            if (await copyText(value)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }
          }}
          className="rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] text-ink-400 hover:border-spritz-400/50 hover:text-ink-100"
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
    <div className="card flex flex-col gap-4 rounded-2xl p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="mt-2 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = "◌",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-3xl px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-2xl text-spritz-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? <p className="max-w-md text-sm text-ink-300">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorNotice({
  message,
  detail,
  onRetry,
  tone = "error",
}: {
  message: string;
  detail?: string;
  onRetry?: () => void;
  tone?: "error" | "warn";
}) {
  const tones =
    tone === "error"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
      : "border-amber-300/30 bg-amber-300/10 text-amber-100";
  return (
    <div className={`rounded-2xl border p-4 text-sm ${tones}`}>
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
          <summary className="cursor-pointer text-xs text-ink-300">Debug details (development only)</summary>
          <pre className="mt-2 max-h-64 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink-900/80 p-3 font-mono text-[11px] leading-relaxed text-ink-200">
            {detail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, description, right }: { eyebrow?: string; title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-ink-300 sm:text-base">{description}</p> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

export function JsonInspector({ value, title = "Raw JSON", defaultOpen = false }: { value: unknown; title?: string; defaultOpen?: boolean }) {
  return (
    <details className="group min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-ink-900/70" open={defaultOpen}>
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm text-ink-300 hover:text-ink-100">
        <span>{title}</span>
        <span className="text-xs transition-transform group-open:rotate-90">▸</span>
      </summary>
      <pre className="max-w-full overflow-auto border-t border-white/15 p-4 font-mono text-xs leading-relaxed text-ink-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
