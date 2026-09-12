"use client";

import { useCopy } from "@/lib/use-copy";
import { Disclosure } from "./ui";

export type ProofLink = {
  /** Where the proof lives. */
  network: "Arkiv · Tiramisu testnet" | "Swarm · public gateway" | "Avalanche Fuji · SnowTrace";
  /** What the value is. */
  label: string;
  value: string;
  href?: string;
  hrefLabel?: string;
};

function ProofRow({ proof }: { proof: ProofLink }) {
  const { copied, copy } = useCopy();
  return (
    <div className="min-w-0 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{proof.label}</p>
        <div className="flex items-center gap-3 text-xs text-subtle">
          {proof.href ? (
            <a href={proof.href} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center hover:text-accent-text">
              {proof.hrefLabel ?? "Explorer"} ↗
            </a>
          ) : null}
          <button type="button" aria-label={`Copy ${proof.label}`} className="min-h-9 hover:text-content" onClick={() => void copy("proof", proof.value)}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <code className="block break-all font-mono text-xs leading-6 text-subtle">{proof.value}</code>
      <p className="mt-1 text-xs text-subtle">{proof.network}</p>
    </div>
  );
}

/** Full public references remain available on demand. */
export function ProofPanel({ proofs, title = "Technical details", columns = 1 }: { proofs: ProofLink[]; title?: string; columns?: 1 | 2 }) {
  return (
    <Disclosure title={title}>
      <div className={`grid gap-x-8 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {proofs.map((proof) => (
          <ProofRow key={`${proof.network}-${proof.label}-${proof.value}`} proof={proof} />
        ))}
      </div>
    </Disclosure>
  );
}
