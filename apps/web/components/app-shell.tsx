"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ROLE_HOME } from "@apiperitivo/shared";
import { SWARM_ID_FRAME_CONTAINER_ID, useSession } from "@/lib/session";
import { Avatar, Badge, Button } from "./ui";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
        active ? "bg-white/10 text-ink-100" : "text-ink-300 hover:bg-white/5 hover:text-ink-100"
      }`}
    >
      {children}
    </Link>
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
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!session.identity) {
    return (
      <Button size="sm" className="whitespace-nowrap" onClick={session.connect} disabled={session.status !== "ready" || session.connecting}>
        <span className="hidden sm:inline">{session.connecting ? "Waiting for Swarm ID…" : "Enter with Swarm ID"}</span>
        <span className="sm:hidden">{session.connecting ? "Waiting…" : "Enter"}</span>
      </Button>
    );
  }

  const { identity, role } = session;
  const otherRole = role === "client" ? "provider" : "client";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 transition hover:border-spritz-400/40"
      >
        <Avatar name={identity.name} seed={identity.id} src={identity.avatarUrl} size={28} />
        <span className="hidden max-w-[140px] truncate text-sm sm:block">{identity.name}</span>
        {role ? <Badge tone="accent">{role}</Badge> : <Badge tone="warn">no role</Badge>}
        <span className="text-xs text-ink-400">▾</span>
      </button>
      {open ? (
        <div className="glass absolute right-0 z-30 mt-2 w-72 rounded-2xl p-2 shadow-2xl">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2">
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
    <div className="bg-scene min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-spritz-400 to-rose-400 text-sm font-black text-ink-950">
                A
              </span>
              <span className="text-base font-semibold tracking-tight">
                API<span className="text-spritz-300">peritivo</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink href="/marketplace">Marketplace</NavLink>
              <NavLink href="/provider">Provider</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 max-sm:flex">
              <NavLink href="/marketplace">Market</NavLink>
              <NavLink href="/provider">Provider</NavLink>
            </nav>
            <IdentityMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-7xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
      <footer className="border-t border-white/10 py-6 text-center text-xs text-ink-400">
        APIperitivo · Phase 1 · Swarm ID · Swarm · Arkiv · no payments yet
      </footer>
      {/* Swarm ID mounts its iframe here. Zero-size so the SDK's own login widget never shows; we use our buttons. */}
      <div id={SWARM_ID_FRAME_CONTAINER_ID} aria-hidden style={{ position: "fixed", bottom: 0, right: 0, width: 0, height: 0, overflow: "hidden" }} />
    </div>
  );
}
