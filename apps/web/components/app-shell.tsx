"use client";

import { explorerAddressUrl, paymentsContractAddress } from "@apiritivo/payments";
import type { Role } from "@apiritivo/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { AccountDropdown, GuestAccountIcon } from "./account-dropdown";
import { AccountPanel } from "./account-panel";
import { SwarmSignIn } from "./swarm-sign-in";
import { ThemeSync } from "./theme-toggle";
import { BrandLogo, BrandMark, Button, ProfileAvatar } from "./ui";
import { WalletMenu } from "./wallet-menu";
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
      className="inline-flex min-h-11 items-center gap-1 text-xs text-subtle underline decoration-transparent underline-offset-4 transition-colors hover:text-content hover:decoration-content"
    >
      {short ? "Contract" : `Contract ${contract.slice(0, 6)}…${contract.slice(-4)}`} ↗
    </a>
  );
}

function IdentityMenu() {
  const session = useSession();
  const wallet = useSwarmWallet();
  const router = useRouter();
  // Client workspace: the connected wallet is the identity; Swarm ID stays optional for private files.
  if ((session.role ?? "client") === "client") return <WalletMenu />;

  if (!session.identity) {
    return (
      <AccountDropdown label="Account settings" trigger={<GuestAccountIcon />}>
        {(close) => (
          <AccountPanel>
            <div className="px-3 py-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  close();
                  session.connect();
                }}
                disabled={session.status !== "ready" || session.connecting}
              >
                {session.connecting ? "Complete sign in" : "Enter with Swarm ID"}
              </Button>
            </div>
          </AccountPanel>
        )}
      </AccountDropdown>
    );
  }

  const { identity } = session;

  return (
    <AccountDropdown
      label={`Account for ${identity.name}`}
      trigger={
        <>
          <ProfileAvatar name={identity.name} size={34} />
          <span className="hidden max-w-[120px] truncate text-sm xl:block">{identity.name}</span>
        </>
      }
    >
      {(close) => (
        <AccountPanel name={identity.name} address={wallet.address}>
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="text-muted">Swarm upload</span>
            <span className={`inline-flex items-center gap-1.5 ${session.canUpload ? "text-success" : "text-warning"}`}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              {session.canUpload ? "Available" : "Unavailable"}
            </span>
          </div>
          <button
            type="button"
            className="mt-2 min-h-11 w-full rounded-control px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
            onClick={async () => {
              close();
              await session.disconnect();
              router.push("/");
            }}
          >
            Logout
          </button>
        </AccountPanel>
      )}
    </AccountDropdown>
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
      <ThemeSync />
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
            className="order-4 col-span-3 col-start-1 row-start-2 flex min-w-0 items-center gap-1 overflow-x-auto p-1 lg:order-2 lg:col-span-1 lg:col-start-auto lg:row-start-auto lg:justify-center"
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
          <div className="order-2 justify-self-end lg:order-3">
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
