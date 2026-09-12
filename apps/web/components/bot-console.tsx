"use client";

import type { BotVerification, ServiceManifest } from "@apiritivo/shared";
import { formatRemaining } from "@apiritivo/shared";
import { useMemo, useState } from "react";
import type { PassBearer } from "@/lib/use-pass-bearer";
import { ApiKeyBox } from "./api-key-box";
import { CodeBlock } from "./code-panel";
import { Button, Disclosure } from "./ui";

type BotResponse = {
  ok: boolean;
  error?: string;
  operation?: string;
  result?: unknown;
  verification?: BotVerification;
};

const inputCls = "field-control font-mono";

/**
 * "Try it" console: calls the demo bot with the access pass as bearer token.
 * The bot verifies the pass on Arkiv before answering.
 */
export function BotConsole({ serviceId, manifest, bearer }: { serviceId: string; manifest: ServiceManifest; bearer: PassBearer }) {
  const token = bearer.status === "ready" ? bearer.bearer : null;
  const operations = useMemo(() => Object.keys(manifest.operations), [manifest]);
  const [operation, setOperation] = useState(operations[0] ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<BotResponse | null>(null);
  const [status, setStatus] = useState<number | null>(null);

  const inputs = operation ? Object.entries(manifest.operations[operation]?.input ?? {}) : [];
  const endpoint = `/api/bot/${serviceId}`;

  async function run() {
    setBusy(true);
    setResponse(null);
    const input: Record<string, unknown> = {};
    for (const [name, type] of inputs) {
      const raw = values[name] ?? "";
      input[name] = type === "number" ? Number(raw) : type === "boolean" ? raw === "true" : raw;
    }
    try {
      const res = await fetch(`/api/bot/${serviceId}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ operation, input }),
      });
      setStatus(res.status);
      setResponse((await res.json()) as BotResponse);
    } catch (err) {
      setStatus(null);
      setResponse({ ok: false, error: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="try-api" className="min-w-0 scroll-mt-40 border-t border-line pt-6">
      <h2 className="text-xl font-medium">Try API</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Operation</span>
          <select className={inputCls} value={operation} onChange={(e) => setOperation(e.target.value)}>
            {operations.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          {inputs.length === 0 ? <p className="pt-6 text-xs text-subtle">No input fields.</p> : null}
          {inputs.map(([name, type]) => (
            // biome-ignore lint/a11y/noLabelWithoutControl: the control is one of the two conditional branches below
            <label key={name} className="block">
              <span className="mb-1 flex justify-between text-xs text-muted">
                <span className="min-w-0 break-all">{name}</span>
                <span className="font-mono text-subtle">{type}</span>
              </span>
              {type === "boolean" ? (
                <select className={inputCls} value={values[name] ?? "true"} onChange={(e) => setValues({ ...values, [name]: e.target.value })}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  className={inputCls}
                  inputMode={type === "number" ? "decimal" : "text"}
                  placeholder={type === "number" ? "0" : name === "symbol" ? "BTC" : "…"}
                  value={values[name] ?? ""}
                  onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                />
              )}
            </label>
          ))}
        </div>
      </div>

      {bearer.status !== "ready" ? (
        <div className="mt-4">
          <ApiKeyBox serviceId={serviceId} bearer={bearer} />
        </div>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={run} disabled={busy || !operation || !token}>
          {busy ? "Calling…" : "Run request"}
        </Button>
        {status !== null ? <span className={`font-mono text-xs ${status < 300 ? "text-success" : "text-danger"}`}>HTTP {status}</span> : null}
      </div>

      {response ? (
        <div className="mt-4 space-y-3">
          {response.verification ? (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="text-success">Pass verified</span>
              <span className="text-subtle">{formatRemaining(response.verification.secondsRemaining)} left</span>
            </div>
          ) : response.error ? (
            <p role="alert" className="break-words border-l-2 border-danger pl-3 text-sm text-danger">
              {response.error}
            </p>
          ) : null}
          <CodeBlock label="API response" className="max-h-96 max-w-full overflow-auto rounded-control bg-surface p-4 font-mono text-xs leading-relaxed text-content">
            {JSON.stringify(response.result ?? response, null, 2)}
          </CodeBlock>
        </div>
      ) : null}
      {bearer.status === "ready" ? (
        <div className="mt-6">
          <Disclosure title="API credentials">
            <p className="mb-4 break-all font-mono text-xs text-subtle">POST {endpoint}</p>
            <ApiKeyBox serviceId={serviceId} bearer={bearer} operation={operation || "getQuote"} />
          </Disclosure>
        </div>
      ) : null}
    </section>
  );
}
