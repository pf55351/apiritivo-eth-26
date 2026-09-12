"use client";

import { useId, useState } from "react";
import type { ServiceManifest } from "@apiritivo/shared";
import { CodePanel } from "./code-panel";

const manifest = {
  v: 1,
  endpoint: "https://your-api.example/quote",
  operations: {
    getQuote: { input: { symbol: "string" } },
  },
} satisfies ServiceManifest;

const examples = {
  manifest: {
    label: "Manifest",
    title: "manifest.json",
    language: "JSON",
    code: JSON.stringify(manifest, null, 2),
    note: "A technical manifest describes the endpoint, operations, and input types. Published manifests are stored on Swarm.",
  },
  request: {
    label: "Request",
    title: "request.http",
    language: "HTTP",
    code: [
      "POST /api/gateway/YOUR_SERVICE_ID HTTP/1.1",
      "Content-Type: application/json",
      "Authorization: Bearer YOUR_ACCESS_PASS_KEY",
      "",
      "{",
      '  "operation": "getQuote",',
      '  "input": { "symbol": "BTC" }',
      "}",
    ].join("\n"),
    note: "Replace the service ID and access pass key. The gateway checks the pass on Arkiv before forwarding the request.",
  },
};

/** Illustrative examples only. Selecting a format never calls an API or spends funds. */
export function ApiExample() {
  const id = useId();
  const [selected, setSelected] = useState<keyof typeof examples>("manifest");
  const example = examples[selected];
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="text-xs font-medium text-subtle">Inside an API</h2>
        <span className="rounded-md border border-line px-2 py-1 font-mono text-[10px] text-subtle">Illustrative example</span>
      </div>
      <div role="group" aria-label="Example format" className="mb-3 flex gap-1">
        {(Object.keys(examples) as (keyof typeof examples)[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={selected === key}
            onClick={() => setSelected(key)}
            className={`min-h-10 rounded-control px-4 text-xs font-medium transition-colors ${selected === key ? "bg-surface-raised text-content" : "text-subtle hover:text-content"}`}
          >
            {examples[key].label}
          </button>
        ))}
      </div>
      <CodePanel key={selected} title={example.title} language={example.language} code={example.code} footer={example.note} />
    </section>
  );
}
