"use client";

import { explorerAddressUrl, paymentsContractAddress } from "@apiritivo/payments";
import type { Role } from "@apiritivo/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { SwarmSignIn } from "./swarm-sign-in";
import { BrandLogo, BrandMark, Button, ProfileAvatar } from "./ui";
import { WorkspaceSwitch } from "./workspace-switch";

const VIEW_LINKS = {
  client: [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/passes", label: "My passes" },
  ],
  provider: [
    { href: "/provider", label: "My APIs" },
    { href: "/provider/new", label: "Publish" },
  ],
};

function routeWorkspace(pathname: string): Role | null {
  if (pathname === "/provider" || pathname.startsWith("/provider/")) return "provider";
  if (["/marketplace", "/passes"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return "client";
  return null;
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/provider" && pathname.startsWith(`${href}/`));
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className="app-nav-link">
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
      className="inline-flex min-h-11 items-center gap-1 text-xs text-subtle underline decoration-transparent underline-offset-4 transition-colors hover:text-content hover:decoration-white"
    >
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
      <Button size="sm" className="w-11 whitespace-nowrap px-0 sm:w-auto sm:px-2.5" onClick={session.connect} disabled={session.status !== "ready" || session.connecting}>
        <span className="sr-only sm:not-sr-only">{session.connecting ? "Complete sign in" : "Enter with Swarm ID"}</span>
        <svg className="h-5 w-5 sm:hidden" aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M11 3h5v14h-5M3 10h9m-3-3 3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>
    );
  }

  const { identity, role } = session;

  return (
    <div className="sm:relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Account for ${identity.name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-11 items-center justify-center gap-2 rounded-full border border-transparent p-1 transition-colors hover:border-line hover:bg-surface sm:w-auto sm:justify-start sm:pr-3"
      >
        <ProfileAvatar name={identity.name} size={34} />
        <span className="hidden max-w-[120px] truncate text-sm xl:block">{identity.name}</span>
        <span className="hidden text-xs text-subtle sm:inline">▾</span>
      </button>
      {open ? (
        <div className="absolute right-3 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-panel border border-line bg-surface-raised p-2 shadow-xl sm:right-0 sm:top-auto">
          <div className="flex items-center gap-3 px-3 py-2">
            <ProfileAvatar name={identity.name} size={48} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{identity.name}</p>
              <p className="text-xs text-subtle">{role === "provider" ? "Provider view" : "Client view"}</p>
              <p className="truncate font-mono text-[11px] text-ink-400" title={identity.id}>
                {identity.id}
              </p>
            </div>
          </div>
          <div className="mx-2 my-1 border-t border-white/15" />
          <p className="px-3 pt-1 text-xs text-ink-400">Swarm upload: {session.canUpload ? "available" : "unavailable"}</p>
          <button
            type="button"
            className="mt-2 min-h-11 w-full rounded-control px-3 py-2 text-left text-sm text-rose-400 hover:bg-rose-400/10"
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
  const { role, roleLoaded, setRole } = useSession();
  const pathname = usePathname();
  const view = role ?? "client";
  const requiredView = routeWorkspace(pathname);
  const otherWorkspace = requiredView !== null && requiredView !== view;

  return (
    <div className="bg-scene flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-navbar sticky top-0 z-20 border-b border-line" data-workspace={view}>
        <div className="mx-auto grid min-h-16 max-w-7xl grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:gap-x-4 sm:px-6 lg:grid-cols-[auto_1fr_auto_auto] lg:px-8">
          <Link href="/" aria-label="APIritivo home" className="order-1 flex min-h-11 items-center justify-center gap-2.5 sm:justify-start">
            <span className="sm:hidden">
              <BrandMark />
            </span>
            <span className="hidden sm:inline-flex">
              <BrandLogo />
            </span>
          </Link>
          <nav
            aria-label={`${view === "client" ? "Client" : "Provider"} navigation`}
            className="order-4 col-span-3 flex min-w-0 items-center justify-center gap-1 overflow-x-auto p-1 lg:order-2 lg:col-span-1"
          >
            {roleLoaded ? (
              VIEW_LINKS[view].map((link) => (
                <NavLink key={link.href} href={link.href}>
                  {link.label}
                </NavLink>
              ))
            ) : (
              <span role="status" className="px-3 text-xs text-subtle">
                Loading view…
              </span>
            )}
          </nav>
          <div className="order-2 flex items-center justify-self-center gap-1 sm:gap-3 lg:order-3">
            <nav aria-label="Documentation">
              <NavLink href="/docs">Docs</NavLink>
            </nav>
            <IdentityMenu />
          </div>
          <div className="order-3 justify-self-end lg:order-4">
            <WorkspaceSwitch />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        {requiredView && !roleLoaded ? (
          <p role="status" className="py-16 text-center text-sm text-subtle">
            Loading view…
          </p>
        ) : otherWorkspace && requiredView ? (
          <section className="mx-auto max-w-lg py-16 text-center">
            <p className="eyebrow">{requiredView === "provider" ? "Provider" : "Client"} workspace</p>
            <h1 className="mt-3 text-3xl font-medium">Switch your view</h1>
            <p className="mt-3 text-sm text-muted">{requiredView === "provider" ? "Manage APIs, publishing, and earnings here." : "Discover APIs and manage your passes here."}</p>
            <div className="mt-6">
              <Button onClick={() => setRole(requiredView)}>Switch to {requiredView === "provider" ? "Provider" : "Client"}</Button>
            </div>
          </section>
        ) : (
          children
        )}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-4 py-7 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-medium">APIritivo</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-subtle">
            <span>Testnet edition</span>
            <Link href="/docs" className="py-2 hover:text-content">
              Docs
            </Link>
            <Link href="/design-system" className="py-2 hover:text-content">
              UI library ↗
            </Link>
            <ContractLink short />
          </div>
        </div>
      </footer>
      <SwarmSignIn />
    </div>
  );
}
