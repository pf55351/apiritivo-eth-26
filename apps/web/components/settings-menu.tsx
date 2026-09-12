"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountDropdown } from "./account-dropdown";
import { ThemeToggle } from "./theme-toggle";

function GearIcon() {
  return (
    <span className="inline-flex size-[34px] items-center justify-center rounded-full bg-surface-active text-content-secondary">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    </span>
  );
}

/** Docs and the appearance picker, shown in a dropdown from the header gear. */
export function SettingsPanel() {
  const pathname = usePathname();
  return (
    <div className="rounded-panel border border-line bg-surface p-2 shadow-lg">
      <p className="px-3 py-2 text-sm font-semibold">Settings</p>
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
      <div className="mx-3 my-1 border-t border-line" />
      <div className="px-3 py-1">
        <ThemeToggle />
      </div>
    </div>
  );
}

/** Header gear: the same dropdown in both workspaces, signed in or not. */
export function SettingsMenu() {
  return (
    <AccountDropdown label="Settings" panelLabel="Settings" caret={false} trigger={<GearIcon />}>
      {() => <SettingsPanel />}
    </AccountDropdown>
  );
}
