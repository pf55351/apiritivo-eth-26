"use client";

import { explorerAddressUrl, PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import type { ReactNode } from "react";
import { ProfileAvatar } from "./ui";

/** Shared account presentation; each workspace supplies its own actions. Docs and theme live in SettingsMenu. */
export function AccountPanel({ name, address, children }: { name?: string; address?: string | null; children?: ReactNode }) {
  return (
    <div className="rounded-panel border border-line bg-surface p-2 shadow-lg">
      {name ? (
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
      ) : (
        <p className="px-3 py-2 text-sm font-semibold">Account</p>
      )}
      {children ? <div className="mx-3 my-1 border-t border-line" /> : null}
      {children}
    </div>
  );
}
