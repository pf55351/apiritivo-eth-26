"use client";

import { useState } from "react";
import type { PassBearer } from "@/lib/use-pass-bearer";
import { copyText } from "@/lib/format";

/** curl that a machine (or you) can paste to call the service with this pass. */
export function curlForService(serviceId: string, bearer: string, operation = "getQuote", input: Record<string, unknown> = { symbol: "BTC" }): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  return [
    `curl -s ${origin}/api/gateway/${serviceId} \\`,
    `  -H 'authorization: Bearer ${bearer}' \\`,
    `  -H 'content-type: application/json' \\`,
    `  -d '${JSON.stringify({ operation, input })}'`,
  ].join("\n");
}

/**
 * The buyer's API key for a pass. The secret half is decrypted client-side and
 * is never shown to anyone else, so this is the only place it appears.
 */
export function ApiKeyBox({ serviceId, bearer, operation, input }: { serviceId: string; bearer: PassBearer; operation?: string; input?: Record<string, unknown> }) {
  const [copied, setCopied] = useState<"key" | "curl" | null>(null);
  const copy = async (what: "key" | "curl", text: string) => {
    if (await copyText(text)) {
      setCopied(what);
      setTimeout(() => setCopied(null), 1200);
    }
  };

  if (bearer.status === "loading") return <p className="text-xs text-ink-400">Unlocking your API key with Swarm ID…</p>;
  if (bearer.status === "legacy") return <p className="text-xs text-amber-200">This pass was minted before pass secrets. It cannot be used; buy access again.</p>;
  if (bearer.status === "locked") return <p className="text-xs text-amber-200">{bearer.error}</p>;

  const curl = curlForService(serviceId, bearer.bearer, operation, input);
  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-white/15 bg-ink-900/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wider text-ink-400">API key · passKey.secret</p>
          <button type="button" onClick={() => copy("key", bearer.bearer)} className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-ink-300 hover:text-ink-100">
            {copied === "key" ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <code className="mt-1 block break-all font-mono text-[11px] leading-relaxed text-ink-100">{bearer.bearer}</code>
        <p className="mt-1 text-[11px] text-ink-400">The part after the dot is secret: only its hash is on Arkiv. Anyone with the whole key can use your pass until it expires.</p>
      </div>
      <div className="rounded-2xl border border-white/15 bg-ink-900/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wider text-ink-400">Call it from anywhere</p>
          <button type="button" onClick={() => copy("curl", curl)} className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-ink-300 hover:text-ink-100">
            {copied === "curl" ? "Copied ✓" : "Copy curl"}
          </button>
        </div>
        <pre className="mt-1 max-w-full overflow-x-auto font-mono text-[11px] leading-relaxed text-ink-200">{curl}</pre>
      </div>
    </div>
  );
}
