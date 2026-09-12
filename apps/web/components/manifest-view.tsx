"use client";

import type { ServiceManifest } from "@apiritivo/shared";
import { JsonInspector } from "./ui";

const TYPE_TONE: Record<string, string> = {
  string: "text-spritz-300",
  number: "text-sky-300",
  boolean: "text-rose-400",
};

export function ManifestOperations({ manifest, compact = false }: { manifest: ServiceManifest; compact?: boolean }) {
  const entries = Object.entries(manifest.operations);
  if (entries.length === 0) {
    return <p className="text-sm text-ink-400">No operations yet.</p>;
  }
  return (
    <ul className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
      {entries.map(([name, op]) => {
        const inputs = Object.entries(op.input);
        return (
          <li key={name} className="rounded-2xl border border-white/15 bg-ink-900/60 p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-spritz-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-spritz-300">op</span>
              <code className="font-mono text-sm text-ink-100">{name}</code>
            </div>
            <div className="mt-3 space-y-1.5">
              {inputs.length === 0 ? (
                <p className="text-xs text-ink-400">No input fields</p>
              ) : (
                inputs.map(([field, type]) => (
                  <div key={field} className="flex items-center justify-between gap-3 font-mono text-xs">
                    <span className="text-ink-200">{field}</span>
                    <span className={`${TYPE_TONE[type] ?? "text-ink-300"}`}>{type}</span>
                  </div>
                ))
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ManifestPanel({ manifest }: { manifest: ServiceManifest }) {
  return (
    <div className="space-y-4">
      <ManifestOperations manifest={manifest} />
      <JsonInspector value={manifest} title="Raw manifest (Swarm)" />
    </div>
  );
}
