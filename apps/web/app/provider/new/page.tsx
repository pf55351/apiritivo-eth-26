"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ACCESS_DURATIONS,
  SERVICE_CATEGORIES,
  buildManifest,
  formatAccessDuration,
  formatPriceUsdc,
  generateServiceId,
  manifestStats,
  priceUsdcSchema,
  publishServiceInputSchema,
  serializeManifest,
  slugify,
  validateManifest,
  type OperationDraft,
  type PublishServiceResult,
  type ServiceManifest,
} from "@apiperitivo/shared";
import { swarmReferenceUrl, uploadServiceManifest } from "@apiperitivo/swarm";
import { arkivEntityUrl, arkivTxUrl } from "@apiperitivo/arkiv";
import { PAYMENT_CHAIN_NAME, explorerAddressUrl } from "@apiperitivo/payments";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { ProofPanel } from "@/components/proofs";
import { useSession } from "@/lib/session";
import { toFriendlyError, type FriendlyError } from "@/lib/errors";
import { AuthGate } from "@/components/auth-gate";
import { ManifestOperations } from "@/components/manifest-view";
import { OperationsBuilder, emptyOperation } from "@/components/operations-builder";
import { Button, CategoryPill, ErrorNotice, ProofChip, SectionTitle } from "@/components/ui";

type Step = "idle" | "uploading" | "publishing" | "done";

type Progress = {
  step: Step;
  manifestRef?: string;
  manifestBytes?: number;
  manifestVia?: "swarm-id" | "gateway";
  result?: PublishServiceResult;
  error?: FriendlyError & { at: "swarm" | "arkiv" | "form" };
};

const fieldCls =
  "h-11 w-full rounded-xl border border-white/15 bg-ink-900/70 px-4 text-sm text-ink-100 placeholder:text-ink-400 focus:border-spritz-400/60 focus:outline-none";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs text-ink-300">
        <span>{label}</span>
        {hint ? <span className="text-[11px] text-ink-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function StepRow({ label, state }: { label: string; state: "todo" | "active" | "done" | "error" }) {
  const icon = state === "done" ? "✓" : state === "error" ? "✕" : state === "active" ? "…" : "○";
  const tone =
    state === "done" ? "text-olive-400" : state === "error" ? "text-rose-400" : state === "active" ? "text-spritz-300" : "text-ink-400";
  return (
    <li className={`flex items-center gap-3 text-sm ${tone}`}>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full border border-current font-mono text-xs ${state === "active" ? "animate-pulse" : ""}`}>
        {icon}
      </span>
      {label}
    </li>
  );
}

function PublishForm() {
  const session = useSession();
  const identity = session.identity!;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(SERVICE_CATEGORIES[0].slug);
  const [customCategory, setCustomCategory] = useState("");
  const [priceUsdc, setPriceUsdc] = useState("0.50");
  const [accessSeconds, setAccessSeconds] = useState<number>(7 * 86400);
  const swarmWallet = useSwarmWallet();
  const [payoutAddress, setPayoutAddress] = useState<string>("");
  const [payoutTouched, setPayoutTouched] = useState(false);
  useEffect(() => {
    if (!payoutTouched && swarmWallet.address) setPayoutAddress(swarmWallet.address);
  }, [swarmWallet.address, payoutTouched]);
  const [endpoint, setEndpoint] = useState("");
  const [operations, setOperations] = useState<OperationDraft[]>([emptyOperation("getQuote")]);
  const [progress, setProgress] = useState<Progress>({ step: "idle" });

  const effectiveCategory = category === "custom" ? slugify(customCategory) : category;
  const manifest = useMemo(() => buildManifest(operations, endpoint), [operations, endpoint]);
  const manifestValidation = useMemo(() => validateManifest(manifest), [manifest]);
  const stats = manifestStats(manifest);

  const formIssues = useMemo(() => {
    const probe = publishServiceInputSchema.safeParse({
      serviceId: "probe-0000",
      category: effectiveCategory || "x",
      providerId: identity.id,
      providerName: identity.name,
      manifestRef: "0".repeat(64),
      name,
      description,
      priceUsdc,
      accessSeconds,
      payoutAddress: payoutAddress.trim(),
    });
    const issues: string[] = [];
    if (!probe.success) {
      for (const i of probe.error.issues) {
        const key = i.path[0];
        if (key === "name") issues.push(`Service name: ${i.message}`);
        else if (key === "description") issues.push(`Description: ${i.message}`);
        else if (key === "category") issues.push(`Category: ${i.message}`);
        else if (key === "priceUsdc") issues.push(`Price: ${i.message}`);
        else if (key === "accessSeconds") issues.push(`Access duration: ${i.message}`);
        else if (key === "payoutAddress") issues.push(`Payout wallet: ${i.message}`);
      }
    }
    if (!manifestValidation.ok) issues.push(...manifestValidation.errors);
    return issues;
  }, [name, description, effectiveCategory, identity.id, identity.name, manifestValidation, priceUsdc, accessSeconds, payoutAddress]);

  const canPublish = formIssues.length === 0 && session.canUpload && progress.step === "idle";
  const busy = progress.step === "uploading" || progress.step === "publishing";

  async function publish() {
    if (!manifestValidation.ok) return;
    const validManifest: ServiceManifest = manifestValidation.manifest;
    const serviceId = generateServiceId(name);

    // 1) Upload manifest to Swarm — must succeed before touching Arkiv.
    setProgress({ step: "uploading" });
    let manifestRef: string;
    let manifestBytes: number;
    let manifestVia: "swarm-id" | "gateway";
    try {
      const uploaded = await uploadServiceManifest(validManifest);
      manifestRef = uploaded.reference;
      manifestBytes = uploaded.bytes;
      manifestVia = uploaded.via;
    } catch (err) {
      setProgress({ step: "idle", error: { ...toFriendlyError(err, "Manifest upload failed."), at: "swarm" } });
      return;
    }

    // 2) Publish the service entity to Arkiv via the server writer.
    setProgress({ step: "publishing", manifestRef, manifestBytes, manifestVia });
    const body = {
      serviceId,
      category: effectiveCategory,
      providerId: identity.id,
      providerName: identity.name,
      manifestRef,
      name: name.trim(),
      description: description.trim(),
      priceUsdc: priceUsdc.trim(),
      accessSeconds,
      payoutAddress: payoutAddress.trim(),
    };
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<PublishServiceResult> & {
        error?: string;
        reason?: string;
        detail?: string;
        issues?: string[];
      };
      if (!res.ok || !json.entityKey || !json.txHash) {
        const detail = [json.reason, json.detail, ...(json.issues ?? [])].filter(Boolean).join("\n");
        setProgress({
          step: "idle",
          manifestRef,
          manifestBytes,
          error: { message: json.reason ?? json.error ?? "Arkiv publication failed.", detail: detail || undefined, at: "arkiv" },
        });
        return;
      }
      setProgress({
        step: "done",
        manifestRef,
        manifestBytes,
        manifestVia,
        result: { entityKey: json.entityKey, txHash: json.txHash, serviceId: json.serviceId ?? serviceId },
      });
    } catch (err) {
      setProgress({ step: "idle", manifestRef, manifestBytes, error: { ...toFriendlyError(err, "Arkiv publication failed."), at: "arkiv" } });
    }
  }

  if (progress.step === "done" && progress.result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 animate-fade-up">
        <div className="card rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-olive-400/15 text-3xl text-olive-400">✓</div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-olive-400">Service live</p>
          <h2 className="mt-1 text-3xl font-semibold">{name}</h2>
          <p className="mt-2 text-sm text-ink-300">Manifest stored on Swarm, service registered on Arkiv.</p>
          <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left">
            <StepRow label="Uploading manifest to Swarm" state="done" />
            <StepRow label="Publishing service to Arkiv" state="done" />
          </ul>
          <div className="mt-6 flex justify-center gap-2">
            <ProofChip label="Swarm" />
            <ProofChip label="Arkiv" href={arkivEntityUrl(progress.result.entityKey)} />
          </div>
        </div>
        <ProofPanel
          columns={2}
          title="Your service, verifiable"
          proofs={[
            { network: "Swarm · public gateway", label: `manifestRef · ${progress.manifestBytes ?? 0} bytes · via ${progress.manifestVia === "gateway" ? "public gateway" : "Swarm ID"}`, value: progress.manifestRef ?? "", href: swarmReferenceUrl(progress.manifestRef ?? ""), hrefLabel: "Swarm gateway" },
            { network: "Arkiv · Tiramisu testnet", label: "entity key", value: progress.result.entityKey, href: arkivEntityUrl(progress.result.entityKey), hrefLabel: "Arkiv explorer" },
            { network: "Arkiv · Tiramisu testnet", label: "transaction", value: progress.result.txHash, href: arkivTxUrl(progress.result.txHash), hrefLabel: "Transaction" },
            { network: "Arkiv · Tiramisu testnet", label: "serviceId", value: progress.result.serviceId },
            { network: "Arkiv · Tiramisu testnet", label: "access terms", value: `${formatPriceUsdc(priceUsdc.trim())} · ${formatAccessDuration(accessSeconds)}` },
          ]}
        />
        <div className="flex flex-wrap justify-center gap-3">
          <Button href={`/services/${progress.result.serviceId}`}>View service</Button>
          <Button variant="ghost" href="/provider">Back to dashboard</Button>
          <Button variant="ghost" href="/marketplace">Marketplace</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <form
        className="min-w-0 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (canPublish) void publish();
        }}
      >
        <section className="card space-y-5 rounded-3xl p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">1 · Service</p>
            <h2 className="mt-1 text-xl font-semibold">What are you offering?</h2>
          </div>
          <Field label="Service name" hint="shown on the card">
            <input className={fieldCls} placeholder="Market Data API" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Description" hint={`${description.length}/400`}>
            <textarea
              className={`${fieldCls} h-28 resize-none py-3`}
              placeholder="Real-time crypto prices for any symbol."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={400}
            />
          </Field>
          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATEGORIES.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setCategory(c.slug)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    category === c.slug ? "border-spritz-400/70 bg-spritz-500/15 text-spritz-300" : "border-white/15 text-ink-300 hover:border-white/25"
                  }`}
                >
                  {c.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCategory("custom")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  category === "custom" ? "border-spritz-400/70 bg-spritz-500/15 text-spritz-300" : "border-white/15 text-ink-300 hover:border-white/25"
                }`}
              >
                Custom…
              </button>
            </div>
            {category === "custom" ? (
              <input
                className={`${fieldCls} mt-3`}
                placeholder="my-category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            ) : null}
          </Field>
        </section>

        <section className="card space-y-5 rounded-3xl p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">2 · Access terms</p>
            <h2 className="mt-1 text-xl font-semibold">What does one access cost?</h2>
            <p className="mt-1 text-sm text-ink-300">Stored on Arkiv with the listing. Clients will buy exactly this in Phase 2.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price per access" hint="USDC">
              <div className="relative">
                <input
                  className={`${fieldCls} pr-16 font-mono`}
                  inputMode="decimal"
                  placeholder="0.50"
                  value={priceUsdc}
                  onChange={(e) => setPriceUsdc(e.target.value)}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-400">USDC</span>
              </div>
            </Field>
            <Field label="Access duration" hint="per purchase">
              <select
                className={fieldCls}
                value={accessSeconds}
                onChange={(e) => setAccessSeconds(Number(e.target.value))}
              >
                {ACCESS_DURATIONS.map((d) => (
                  <option key={d.seconds} value={d.seconds}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Payout wallet" hint={`USDC on ${PAYMENT_CHAIN_NAME}`}>
            <input
              className={`${fieldCls} font-mono`}
              placeholder="0x…"
              value={payoutAddress}
              onChange={(e) => {
                setPayoutTouched(true);
                setPayoutAddress(e.target.value);
              }}
              spellCheck={false}
            />
            <p className="mt-1.5 text-[11px] text-ink-400">
              Default is your Swarm wallet, derived from your Swarm ID
              {swarmWallet.address ? (
                <>
                  {" "}(<a href={explorerAddressUrl(swarmWallet.address)} target="_blank" rel="noreferrer" className="hover:text-ink-200">Snowtrace ↗</a>)
                </>
              ) : null}
              . You can withdraw from it or export its key in the provider dashboard. Or paste any other EVM address.
            </p>
          </Field>
        </section>

        <section className="card space-y-5 rounded-3xl p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">3 · Operations</p>
            <h2 className="mt-1 text-xl font-semibold">How does a machine call it?</h2>
            <p className="mt-1 text-sm text-ink-300">Each operation has a name and typed input fields. This becomes the Swarm manifest.</p>
          </div>
          <Field label="Endpoint URL" hint="optional · stored in the manifest">
            <input
              className={`${fieldCls} font-mono`}
              placeholder="https://your-bot.example/api  (leave empty to use the APIperitivo demo bot)"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              spellCheck={false}
            />
          </Field>
          <OperationsBuilder operations={operations} onChange={setOperations} />
        </section>

        <section className="card space-y-4 rounded-3xl p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">4 · Publish</p>
            <h2 className="mt-1 text-xl font-semibold">Ship it</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-300">
            <span>Publishing as</span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-medium text-ink-100">{identity.name}</span>
            <span className="break-all font-mono text-[11px] text-ink-400">{identity.id}</span>
          </div>

          {!session.canUpload ? (
            <ErrorNotice
              tone="warn"
              message="Publishing requires Swarm upload capability for this identity. Swarm upload unavailable for this identity (no postage stamp / no subsidised gateway)."
              detail={session.uploadUnavailableReason ? `uploadMode=${session.uploadMode ?? "?"} reason=${session.uploadUnavailableReason}` : undefined}
            />
          ) : null}

          {progress.error ? (
            <ErrorNotice
              message={progress.error.message}
              detail={
                progress.error.at === "arkiv" && progress.manifestRef
                  ? `Manifest was uploaded to Swarm (${progress.manifestRef}) but Arkiv publication failed. Nothing was written to Arkiv.\n\n${progress.error.detail ?? ""}`
                  : progress.error.detail
              }
            />
          ) : null}

          {formIssues.length > 0 && (name || description || operations.some((o) => o.name)) ? (
            <ul className="space-y-1 text-xs text-amber-200">
              {formIssues.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          ) : null}

          {busy ? (
            <ul className="space-y-2 rounded-2xl border border-white/15 bg-ink-900/60 p-4">
              <StepRow label="Uploading manifest to Swarm" state={progress.step === "uploading" ? "active" : "done"} />
              <StepRow label="Publishing service to Arkiv" state={progress.step === "publishing" ? "active" : "todo"} />
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={!canPublish || busy}>
              {progress.step === "uploading" ? "Uploading to Swarm…" : progress.step === "publishing" ? "Publishing to Arkiv…" : "Publish service"}
            </Button>
            <Link href="/provider" className="text-sm text-ink-400 hover:text-ink-100">
              Cancel
            </Link>
          </div>
          <p className="text-[11px] text-ink-400">
            Order is enforced: manifest → Swarm → reference → Arkiv entity. Arkiv is never written before Swarm succeeds.
          </p>
        </section>
      </form>

      <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <section className="card rounded-3xl p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Card preview</p>
          <div className="mt-4 rounded-2xl border border-white/15 bg-ink-900/60 p-5">
            <CategoryPill slug={effectiveCategory || "utility"} />
            <h3 className="mt-3 text-lg font-semibold">{name.trim() || "Your service name"}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-ink-300">{description.trim() || "A short description that clients will read on the marketplace."}</p>
            <p className="mt-3 text-sm text-ink-200">by {identity.name}</p>
            <p className="mt-2 font-mono text-xs text-spritz-300">
              {priceUsdcSchema.safeParse(priceUsdc).success ? formatPriceUsdc(priceUsdc.trim()) : "— USDC"} · {formatAccessDuration(accessSeconds)}
            </p>
            <div className="mt-3 flex gap-2">
              <ProofChip label="Arkiv" ok={false} />
              <ProofChip label="Swarm" ok={false} />
            </div>
          </div>
        </section>

        <section className="card rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Manifest preview</p>
            <span className="font-mono text-[11px] text-ink-400">
              {stats.operations} op · {stats.inputs} inputs
            </span>
          </div>
          <div className="mt-4">
            <ManifestOperations manifest={manifest} compact />
          </div>
          <details className="group mt-4 rounded-2xl border border-white/15 bg-ink-900/70" open>
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm text-ink-300 hover:text-ink-100">
              <span>Raw manifest (goes to Swarm)</span>
              <span className="text-xs transition-transform group-open:rotate-90">▸</span>
            </summary>
            <pre className="max-w-full overflow-auto border-t border-white/15 p-4 font-mono text-xs leading-relaxed text-ink-200">{serializeManifest(manifest)}</pre>
          </details>
          {!manifestValidation.ok ? (
            <ul className="mt-3 space-y-1 text-xs text-amber-200">
              {manifestValidation.errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-olive-400">Manifest is valid.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

export default function NewServicePage() {
  return (
    <AuthGate title="Sign in to publish a service">
      <div className="space-y-8">
        <SectionTitle
          eyebrow="Provider · new service"
          title="Publish a service"
          description="Friendly form first. The reduced manifest is generated live, uploaded to Swarm, then the service is registered on Arkiv."
          right={
            <Link href="/provider" className="text-sm text-ink-400 hover:text-ink-100">
              ← Dashboard
            </Link>
          }
        />
        <PublishForm />
      </div>
    </AuthGate>
  );
}
