"use client";

import { useCopy } from "@/lib/use-copy";
import type { PassBearer } from "@/lib/use-pass-bearer";
import { CodeBlock } from "./code-panel";
import { Button, Disclosure } from "./ui";

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
  const { copied, copy } = useCopy();

  if (bearer.status === "loading")
    return (
      <p role="status" className="text-xs text-subtle">
        Unlocking API key…
      </p>
    );
  if (bearer.status === "legacy") return <p className="text-xs text-warning">This older pass is unsupported. Buy access again.</p>;
  if (bearer.status === "locked") return <p className="text-xs text-warning">{bearer.error}</p>;

  const curl = curlForService(serviceId, bearer.bearer, operation, input);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => copy("key", bearer.bearer)}>
          {copied === "key" ? "Copied" : "Copy API key"}
        </Button>
        <Button size="sm" variant="subtle" onClick={() => copy("curl", curl)}>
          {copied === "curl" ? "Copied" : "Copy curl"}
        </Button>
        <span role="status" className="sr-only">
          {copied ? `${copied === "key" ? "API key" : "curl"} copied.` : ""}
        </span>
      </div>
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-3 text-xs text-subtle hover:text-content">Show credentials</summary>
        <p className="mb-3 text-xs text-subtle">Keep this key private. It grants access until your pass expires.</p>
        <code className="block break-all font-mono text-xs leading-6 text-muted">{bearer.bearer}</code>
        <div className="mt-4">
          <Disclosure title="Request example">
            <CodeBlock label="curl request" className="max-w-full overflow-auto py-2 font-mono text-xs leading-6 text-muted">
              {curl}
            </CodeBlock>
          </Disclosure>
        </div>
      </details>
    </div>
  );
}
