"use client";

import { useMemo, useState } from "react";
import type { BotVerification, ServiceManifest } from "@apiritivo/shared";
import { formatRemaining } from "@apiritivo/shared";
import { Button } from "./ui";
import type { PassBearer } from "@/lib/use-pass-bearer";
import { ApiKeyBox } from "./api-key-box";

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
  const endpoint = manifest.endpoint ?? `/api/bot/${serviceId}`;

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
    <section className="card rounded-3xl p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-olive-400">Unlocked · try the bot</p>
      <h2 className="mt-1 text-xl font-semibold">Call the service with your pass</h2>
      <p className="mt-1 text-sm text-ink-300">
        The bot checks your pass on Arkiv before every answer: the entity must exist, match this service, not be expired, and the secret half of your key must hash to the pass&apos;s <code className="font-mono">secret_hash</code>.
      </p>
      <div className="mt-4 rounded-2xl border border-white/15 bg-ink-900/60 p-3 font-mono text-[11px] text-ink-300">
        <div>POST {endpoint}</div>
      </div>
      <div className="mt-3">
        <ApiKeyBox serviceId={serviceId} bearer={bearer} operation={operation || "getQuote"} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-300">Operation</span>
          <select className={inputCls} value={operation} onChange={(e) => setOperation(e.target.value)}>
            {operations.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          {inputs.length === 0 ? <p className="pt-6 text-xs text-ink-400">No input fields.</p> : null}
          {inputs.map(([name, type]) => (
            <label key={name} className="block">
              <span className="mb-1 flex justify-between text-xs text-ink-300">
                <span>{name}</span>
                <span className="font-mono text-ink-400">{type}</span>
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

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={run} disabled={busy || !operation || !token}>
          {busy ? "Verifying pass on Arkiv…" : `Call ${operation || "operation"}`}
        </Button>
        {status !== null ? <span className={`font-mono text-xs ${status < 300 ? "text-olive-400" : "text-rose-400"}`}>HTTP {status}</span> : null}
      </div>

      {response ? (
        <div className="mt-4 space-y-3">
          {response.verification ? (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-olive-400/40 bg-olive-400/10 px-2.5 py-0.5 font-semibold text-olive-400">Pass verified on Arkiv ✓</span>
              <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-ink-300">
                expires in {formatRemaining(response.verification.secondsRemaining)} · block {response.verification.expiresAtBlock}
              </span>
            </div>
          ) : response.error ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{response.error}</div>
          ) : null}
          <pre className="max-w-full overflow-auto rounded-2xl border border-white/15 bg-ink-900/70 p-4 font-mono text-xs leading-relaxed text-ink-100">
            {JSON.stringify(response.result ?? response, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
