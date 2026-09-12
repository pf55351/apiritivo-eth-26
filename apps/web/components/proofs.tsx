"use client";

import { useState } from "react";
import { copyText } from "@/lib/format";

export type ProofLink = {
  /** Where the proof lives. */
  network: "Arkiv · Tiramisu testnet" | "Swarm · public gateway";
  /** What the value is. */
  label: string;
  value: string;
  href?: string;
  hrefLabel?: string;
};

function ProofRow({ proof }: { proof: ProofLink }) {
  const [copied, setCopied] = useState(false);
  const arkiv = proof.network.startsWith("Arkiv");
  return (
    <div className="rounded-2xl border border-white/15 bg-ink-900/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${arkiv ? "text-spritz-300" : "text-olive-400"}`}>
          {proof.network}
        </span>
        <span className="text-[11px] text-ink-400">{proof.label}</span>
      </div>
      <code className="mt-2 block break-all font-mono text-xs leading-relaxed text-ink-100" title={proof.value}>
        {proof.value}
      </code>
      <div className="mt-3 flex flex-wrap gap-2">
        {proof.href ? (
          <a
            href={proof.href}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition ${
              arkiv ? "bg-spritz-500 text-ink-950 hover:bg-spritz-400" : "bg-olive-400 text-ink-950 hover:bg-olive-500"
            }`}
          >
            {proof.hrefLabel ?? "Open"} ↗
          </a>
        ) : null}
        <button
          type="button"
          onClick={async () => {
            if (await copyText(proof.value)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }
          }}
          className="inline-flex h-8 items-center whitespace-nowrap rounded-full border border-white/15 px-3 text-xs text-ink-200 hover:border-spritz-400/60 hover:text-ink-100"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/** Explicit, clickable on-chain / on-swarm references. */
export function ProofPanel({
  proofs,
  title = "Verify it yourself",
  columns = 1,
}: {
  proofs: ProofLink[];
  title?: string;
  /** 2 = two columns from the sm breakpoint (only for wide hosts). */
  columns?: 1 | 2;
}) {
  return (
    <section className="card rounded-3xl p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Proofs</p>
      <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-ink-300">Every reference below is public. Open it in the explorer or gateway to check the raw data.</p>
      <div className={`mt-5 grid gap-3 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {proofs.map((p) => (
          <ProofRow key={`${p.network}-${p.label}-${p.value}`} proof={p} />
        ))}
      </div>
    </section>
  );
}
