"use client";

import { explorerAddressUrl, paymentsContractAddress } from "@apiritivo/payments";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActiveLink, REPO_URL, routeWorkspace, VIEW_LINKS } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { useView } from "@/lib/view";
import { PendingMenu } from "./guest-menu";
import { SettingsMenu } from "./settings-menu";
import { SwarmMenu } from "./swarm-menu";
import { SwarmSignIn } from "./swarm-sign-in";
import { ThemeSync } from "./theme-toggle";
import { BrandLogo, BrandMark, Button } from "./ui";
import { WorkspaceSwitch } from "./workspace-switch";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = isActiveLink(pathname, href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className="app-nav-link">
      {children}
    </Link>
  );
}

/** Footer link to the deployed APIritivoPayments contract on SnowTrace; hidden in direct-transfer mode. */
function ContractLink() {
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
      Contract ↗
    </a>
  );
}

/** Swarm ID in both workspaces; the Client menu adds the payment wallet. Nothing until the saved view is known. */
function IdentityMenu() {
  const { view, loaded } = useView();
  if (!loaded) return <PendingMenu />;
  return <SwarmMenu workspace={view} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { switchWorkspace } = useSession();
  const { view, loaded } = useView();
  const pathname = usePathname();
  const requiredView = routeWorkspace(pathname);
  const otherWorkspace = requiredView !== null && requiredView !== view;

  return (
    <div className="bg-scene flex min-h-dvh flex-col">
      <ThemeSync />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-navbar sticky top-0 z-20 border-b border-line" data-workspace={view}>
        <div className="mx-auto grid min-h-16 max-w-7xl grid-cols-[44px_minmax(0,1fr)_auto_auto_auto] items-center gap-x-1 gap-y-2 px-3 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:gap-x-3 sm:px-6 lg:grid-cols-[auto_1fr_auto_auto_auto] lg:px-8">
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
            className="order-5 col-span-5 col-start-1 row-start-2 flex min-w-0 items-center gap-1 overflow-x-auto p-1 sm:col-span-4 lg:order-2 lg:col-span-1 lg:col-start-auto lg:row-start-auto lg:justify-center"
          >
            {loaded ? (
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
          <div className="order-4 justify-self-end sm:ml-1 lg:order-5">
            <SettingsMenu />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        {requiredView && !loaded ? (
          <p role="status" className="py-16 text-center text-sm text-subtle">
            Loading view…
          </p>
        ) : otherWorkspace && requiredView ? (
          <section className="mx-auto max-w-lg py-16 text-center">
            <p className="eyebrow">{requiredView === "provider" ? "Provider" : "Client"} workspace</p>
            <h1 className="mt-3 text-3xl font-medium">Switch your view</h1>
            <p className="mt-3 text-sm text-muted">{requiredView === "provider" ? "Manage APIs, publishing, and earnings here." : "Discover APIs and manage your passes here."}</p>
            <div className="mt-6">
              <Button onClick={() => void switchWorkspace(requiredView)}>Switch to {requiredView === "provider" ? "Provider" : "Client"}</Button>
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
            <p className="mt-1 text-xs text-subtle">Developed by Protocol Bar</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-subtle">
            <span>Testnet edition</span>
            <Link href="/docs" className="py-2 hover:text-content">
              Docs
            </Link>
            <Link href="/design-system" className="py-2 hover:text-content">
              UI library ↗
            </Link>
            <ContractLink />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              title="Source code on GitHub"
              className="inline-flex min-h-11 items-center gap-1 text-xs text-subtle underline decoration-transparent underline-offset-4 transition-colors hover:text-content hover:decoration-content"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </footer>
      <SwarmSignIn />
    </div>
  );
}
