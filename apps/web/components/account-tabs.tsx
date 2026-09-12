"use client";

import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { ConnectionRows, SwarmWalletRows, useConnectionAttention } from "./connection-details";

type Tab = "wallet" | "connection";
const TABS: { id: Tab; label: string }[] = [
  { id: "wallet", label: "Wallet" },
  { id: "connection", label: "Connection" },
];

/**
 * Provider account menu body: the Swarm wallet and the connection facts as
 * two tabs, so the dropdown stays short. Wallet opens first; the Connection
 * tab carries a dot when storage or the Arkiv writer needs attention.
 */
export function ProviderAccountTabs() {
  const [tab, setTab] = useState<Tab>("wallet");
  const attention = useConnectionAttention();
  const id = useId();

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const index = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(index + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]!;
    setTab(next.id);
    document.getElementById(`${id}-tab-${next.id}`)?.focus();
  }

  const panel = (key: Tab, children: ReactNode) => (
    <div id={`${id}-panel-${key}`} role="tabpanel" aria-labelledby={`${id}-tab-${key}`} hidden={tab !== key}>
      {children}
    </div>
  );

  return (
    <>
      <div role="tablist" aria-label="Account sections" onKeyDown={onKey} className="mx-3 mb-1 grid grid-cols-2 gap-1 rounded-control bg-surface-active p-1">
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              id={`${id}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-control text-xs transition-colors ${selected ? "bg-surface text-content shadow-sm" : "text-muted hover:text-content"}`}
            >
              {t.label}
              {t.id === "connection" && attention ? (
                <span className="size-1.5 rounded-full bg-warning" aria-hidden="true">
                  <span className="sr-only">needs attention</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {panel("wallet", <SwarmWalletRows />)}
      {panel("connection", <ConnectionRows />)}
    </>
  );
}
