"use client";

import type { ServiceManifest } from "@apiritivo/shared";
import { useId, useState } from "react";
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
    note: "Example manifest. Stored on Swarm when published.",
  },
  request: {
    label: "Request",
    title: "request.http",
    language: "HTTP",
    code: [
      "POST /api/gateway/YOUR_SERVICE_ID HTTP/1.1",
      "Content-Type: application/json",
      "Authorization: Bearer YOUR_API_KEY",
      "",
      "{",
      '  "operation": "getQuote",',
      '  "input": { "symbol": "BTC" }',
      "}",
    ].join("\n"),
    note: "Example request. Add your service ID and API key.",
  },
};

/** Illustrative examples only. Selecting a format never calls an API or spends funds. */
export function ApiExample({ initialFormat = "manifest" }: { initialFormat?: keyof typeof examples }) {
  const id = useId();
  const [selected, setSelected] = useState<keyof typeof examples>(initialFormat);
  const example = examples[selected];
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2 id={id} className="sr-only">
        API example
      </h2>
      <CodePanel
        title={example.title}
        language={example.language}
        code={example.code}
        footer={example.note}
        header={
          <fieldset className="flex min-w-0 gap-4">
            <legend className="sr-only">Example format</legend>
            {(Object.keys(examples) as (keyof typeof examples)[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={selected === key}
                onClick={() => setSelected(key)}
                className={`min-h-9 border-b py-2 text-xs transition-colors ${selected === key ? "border-content text-content" : "border-transparent text-subtle hover:text-content"}`}
              >
                {examples[key].label}
              </button>
            ))}
          </fieldset>
        }
      />
    </section>
  );
}
