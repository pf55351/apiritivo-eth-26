"use client";

import type { ServiceManifest } from "@apiritivo/shared";

export function ManifestOperations({ manifest, compact = false }: { manifest: ServiceManifest; compact?: boolean }) {
  const entries = Object.entries(manifest.operations);
  if (entries.length === 0) {
    return <p className="text-sm text-ink-400">No operations yet.</p>;
  }
  return (
    <ul className={`divide-y divide-line ${compact ? "text-xs" : "text-sm"}`}>
      {entries.map(([name, op]) => {
        const inputs = Object.entries(op.input);
        return (
          <li key={name} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2">
              <code className="break-all font-mono text-sm text-content">{name}</code>
            </div>
            <div className="mt-3 space-y-1.5">
              {inputs.length === 0 ? (
                <p className="text-xs text-ink-400">No input fields</p>
              ) : (
                inputs.map(([field, type]) => (
                  <div key={field} className="flex items-center justify-between gap-3 font-mono text-xs">
                    <span className="min-w-0 break-all text-ink-200">{field}</span>
                    <span className="shrink-0 text-subtle">{type}</span>
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
