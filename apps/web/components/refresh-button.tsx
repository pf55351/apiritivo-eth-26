"use client";

import { useState } from "react";
import { Button } from "./ui";

export function RefreshButton({
  refreshing = false,
  onClick,
  variant = "ghost",
  label = "Refresh",
}: {
  refreshing?: boolean;
  onClick: () => void | Promise<void>;
  variant?: "ghost" | "subtle";
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const busy = refreshing || pending;
  async function refresh() {
    if (busy) return;
    setPending(true);
    try {
      await onClick();
    } finally {
      setPending(false);
    }
  }
  return (
    <Button variant={variant} size="sm" className="size-11 shrink-0 p-0" onClick={() => void refresh()} disabled={busy} title={busy ? "Refreshing…" : label}>
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`shrink-0 ${busy ? "motion-safe:animate-spin" : ""}`}
      >
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6.1 6.1A8 8 0 0 1 19.5 10M4.5 14A8 8 0 0 0 17.9 17.9" />
      </svg>
      <span className="sr-only">{busy ? "Refreshing…" : label}</span>
    </Button>
  );
}
