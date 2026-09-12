"use client";

import { explorerAddressUrl, PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";
import { ProfileAvatar } from "./ui";

/** Shared account presentation; each workspace supplies its own actions. */
export function AccountPanel({ name, address, children }: { name?: string; address?: string | null; children?: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="rounded-panel border border-line bg-surface p-2 shadow-lg">
      {name ? (
        <>
          <div className="flex items-center gap-3 px-3 py-2">
            <ProfileAvatar name={name} size={48} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              {address ? (
                <a
                  href={explorerAddressUrl(address)}
                  target="_blank"
                  rel="noreferrer"
                  title={`View wallet on ${PAYMENT_CHAIN_NAME}`}
                  className="inline-flex min-h-8 items-center gap-1 rounded-control text-xs text-accent-text hover:underline"
                >
                  Address <span aria-hidden="true">↗</span>
                </a>
              ) : null}
            </div>
          </div>
          <div className="mx-3 my-1 border-t border-line" />
        </>
      ) : (
        <p className="px-3 py-2 text-sm font-semibold">Account settings</p>
      )}
      <Link
        href="/docs"
        aria-current={pathname === "/docs" ? "page" : undefined}
        className="flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-sm hover:bg-surface-active"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3Z" />
          <path d="M8 7h8m-8 4h6" />
        </svg>
        Docs
      </Link>
      <div className="px-3 py-1">
        <ThemeToggle />
      </div>
      {children ? <div className="mx-3 my-2 border-t border-line" /> : null}
      {children}
    </div>
  );
}
