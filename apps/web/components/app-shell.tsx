"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ROLE_HOME } from "@apiritivo/shared";
import { explorerAddressUrl, paymentsContractAddress } from "@apiritivo/payments";
import { useSession } from "@/lib/session";
import { Avatar, Badge, BrandMark, Button } from "./ui";
import { SwarmSignIn } from "./swarm-sign-in";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center border-b-2 px-3 text-[13px] transition-colors ${
        active ? "border-accent text-content" : "border-transparent text-subtle hover:text-content"
      }`}
    >
      {children}
    </Link>
  );
}

/** External link to the deployed APIritivoPayments contract on SnowTrace; hidden in direct-transfer mode. */
function ContractLink({ short = false }: { short?: boolean }) {
  const contract = paymentsContractAddress();
  if (!contract) return null;
  return (
    <a
      href={explorerAddressUrl(contract)}
      target="_blank"
      rel="noreferrer"
      title={`APIritivoPayments · ${contract}`}
      className="inline-flex min-h-9 items-center gap-1 rounded-control border border-line px-2.5 py-1 font-mono text-[10px] text-subtle transition hover:border-line-strong hover:text-content"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {short ? "Contract" : `Contract ${contract.slice(0, 6)}…${contract.slice(-4)}`} ↗
    </a>
  );
}

function IdentityMenu() {
  const session = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!session.identity) {
    return (
      <Button size="sm" className="whitespace-nowrap" onClick={session.connect} disabled={session.status !== "ready" || session.connecting}>
        <span className="hidden sm:inline">{session.connecting ? "Complete sign-in" : "Enter with Swarm ID"}</span>
        <span className="sm:hidden">{session.connecting ? "Sign in" : "Enter"}</span>
      </Button>
    );
  }

  const { identity, role } = session;
  const otherRole = role === "client" ? "provider" : "client";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Account for ${identity.name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 items-center gap-2 rounded-control border border-line bg-surface py-1 pl-1 pr-2.5 transition hover:border-line-strong"
      >
        <Avatar name={identity.name} seed={identity.id} src={identity.avatarUrl} size={28} />
        <span className="hidden max-w-[140px] truncate text-sm sm:block">{identity.name}</span>
        <span className="hidden md:inline-flex">{role ? <Badge tone="accent">{role}</Badge> : <Badge tone="warn">no role</Badge>}</span>
        <span className="text-xs text-ink-400">▾</span>
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-panel border border-line bg-surface-raised p-2 shadow-xl">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
            <Avatar name={identity.name} seed={identity.id} src={identity.avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{identity.name}</p>
              <p className="truncate font-mono text-[11px] text-ink-400" title={identity.id}>
                {identity.id}
              </p>
            </div>
          </div>
          <div className="mx-2 my-1 border-t border-white/15" />
          <p className="px-3 pt-1 text-[11px] uppercase tracking-wider text-ink-400">
            Swarm upload: {session.canUpload ? "available" : "unavailable"}
          </p>
          <button
            type="button"
            className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-ink-200 hover:bg-white/5"
            onClick={() => {
              session.setRole(otherRole);
              setOpen(false);
              router.push(ROLE_HOME[otherRole]);
            }}
          >
            Switch to {otherRole}
          </button>
          <Link href="/choose-role" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm text-ink-200 hover:bg-white/5">
            Choose role…
          </Link>
          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-400 hover:bg-rose-400/10"
            onClick={async () => {
              setOpen(false);
              await session.disconnect();
              router.push("/");
            }}
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-scene flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-6 lg:gap-10">
            <Link href="/" aria-label="APIritivo home" className="flex shrink-0 items-center gap-2.5">
              <BrandMark className="text-accent" />
              <span className="text-lg font-semibold tracking-[-0.055em]">APIritivo</span>
            </Link>
            <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
              <NavLink href="/marketplace">Marketplace</NavLink>
              <NavLink href="/passes">My passes</NavLink>
              <NavLink href="/provider">Provider</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden xl:inline-flex">
              <ContractLink />
            </span>
            <IdentityMenu />
          </div>
        </div>
        <nav aria-label="Mobile navigation" className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 lg:hidden">
          <NavLink href="/marketplace">Marketplace</NavLink>
          <NavLink href="/passes">My passes</NavLink>
          <NavLink href="/provider">Provider</NavLink>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 pb-20 pt-8 sm:px-6 lg:px-8">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-4 py-7 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold tracking-tight">APIritivo <span className="ml-2 text-xs font-normal text-subtle">An open table for APIs.</span></p>
            <p className="mt-2 text-xs text-subtle">Swarm ID · Swarm · Arkiv · USDC on Avalanche Fuji</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-subtle">
            <span className="rounded-md border border-line px-2 py-1">Testnet edition</span>
            <Link href="/design-system" className="py-2 hover:text-content">UI library ↗</Link>
            <ContractLink short />
          </div>
        </div>
      </footer>
      <SwarmSignIn />
    </div>
  );
}
