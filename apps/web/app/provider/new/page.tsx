"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  type PrivateAttachment,
  type ServiceManifest,
} from "@apiritivo/shared";
import { swarmReferenceUrl, uploadPrivateFile, uploadServiceManifest } from "@apiritivo/swarm";
import { arkivEntityUrl, arkivTxUrl } from "@apiritivo/arkiv";
import { PAYMENT_CHAIN_NAME, explorerAddressUrl } from "@apiritivo/payments";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { ProofPanel, type ProofLink } from "@/components/proofs";
import { useSession } from "@/lib/session";
import { toFriendlyError, type FriendlyError } from "@/lib/errors";
import { AuthGate } from "@/components/auth-gate";
import { ManifestOperations } from "@/components/manifest-view";
import { OperationsBuilder, emptyOperation } from "@/components/operations-builder";
import { Button, CategoryPill, ErrorNotice, ProofChip, SectionTitle } from "@/components/ui";

type Step = "idle" | "uploading" | "uploading-private" | "publishing" | "done";

type Progress = {
  step: Step;
  manifestRef?: string;
  manifestBytes?: number;
  manifestVia?: "swarm-id" | "gateway";
  privateFile?: PrivateAttachment;
  result?: PublishServiceResult;
  error?: FriendlyError & { at: "swarm" | "arkiv" | "form" };
};

/** Private files travel through the Swarm ID iframe as one message; keep them small. */
const PRIVATE_FILE_MAX_BYTES = 512 * 1024;

const fieldCls =
  "field-control";

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
  // Payout wallet is always the wallet derived from the Swarm ID: same identity, same address, no typing.
  const payoutAddress = swarmWallet.address ?? "";
  const [operations, setOperations] = useState<OperationDraft[]>([emptyOperation("getQuote")]);
  const [privateFile, setPrivateFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<Progress>({ step: "idle" });

  const effectiveCategory = category === "custom" ? slugify(customCategory) : category;
  const manifest = useMemo(() => buildManifest(operations), [operations]);
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
  const busy = progress.step === "uploading" || progress.step === "uploading-private" || progress.step === "publishing";

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

    // 1b) Optional private file: encrypted on Swarm with ACT, nobody can read it yet.
    let privateAttachment: PrivateAttachment | undefined;
    if (privateFile) {
      setProgress({ step: "uploading-private", manifestRef, manifestBytes, manifestVia });
      try {
        const bytes = new Uint8Array(await privateFile.arrayBuffer());
        const uploaded = await uploadPrivateFile(bytes);
        privateAttachment = {
          name: privateFile.name,
          bytes: uploaded.bytes,
          contentType: privateFile.type || undefined,
          encryptedRef: uploaded.encryptedRef,
          historyRef: uploaded.historyRef,
          publisherPubKey: uploaded.publisherPubKey,
        };
      } catch (err) {
        setProgress({ step: "idle", manifestRef, manifestBytes, manifestVia, error: { ...toFriendlyError(err, "Private file upload failed."), at: "swarm" } });
        return;
      }
    }

    // 2) Publish the service entity to Arkiv via the server writer.
    setProgress({ step: "publishing", manifestRef, manifestBytes, manifestVia, privateFile: privateAttachment });
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
      privateAttachment,
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
        privateFile: privateAttachment,
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
            {progress.privateFile ? <StepRow label="Encrypting private file on Swarm (ACT)" state="done" /> : null}
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
            ...(progress.privateFile
              ? [{ network: "Swarm · public gateway", label: `private file · ${progress.privateFile.name} · ${progress.privateFile.bytes} bytes · ACT encrypted, no public link`, value: progress.privateFile.encryptedRef } satisfies ProofLink]
              : []),
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
            <div className={`${fieldCls} flex items-center justify-between gap-2 font-mono`}>
              <span className="truncate text-ink-100">{swarmWallet.address ?? (swarmWallet.status === "deriving" ? "Deriving from your Swarm ID…" : "Swarm wallet unavailable")}</span>
              {swarmWallet.address ? (
                <a href={explorerAddressUrl(swarmWallet.address)} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] text-ink-400 hover:text-ink-200">
                  explorer ↗
                </a>
              ) : null}
            </div>
            <p className="mt-1.5 text-[11px] text-ink-400">
              Your Swarm wallet, derived from your Swarm ID. Same identity, same address on every device. Withdraw or export its key from the provider dashboard.
            </p>
          </Field>
        </section>

        <section className="card space-y-5 rounded-3xl p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">3 · Operations</p>
            <h2 className="mt-1 text-xl font-semibold">How does a machine call it?</h2>
            <p className="mt-1 text-sm text-ink-300">Each operation has a name and typed input fields. This becomes the Swarm manifest.</p>
          </div>
          <OperationsBuilder operations={operations} onChange={setOperations} />
        </section>

        <section className="card space-y-4 rounded-3xl p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">3b · Private file <span className="text-ink-400">· optional</span></p>
            <h2 className="mt-1 text-xl font-semibold">Something only buyers should read?</h2>
            <p className="mt-1 text-sm text-ink-300">
              Full docs, examples, a data sample. It is encrypted on Swarm with an Access Control Trie: nobody can read it until you grant a buyer&apos;s Swarm key from your dashboard. Max {Math.round(PRIVATE_FILE_MAX_BYTES / 1024)} KB.
            </p>
          </div>
          <Field label="File" hint="stays encrypted on Swarm">
            <input
              type="file"
              className="block w-full text-sm text-ink-300 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-100 hover:file:bg-white/15"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > PRIVATE_FILE_MAX_BYTES) {
                  setProgress({ step: "idle", error: { message: `Private file is too large (${Math.round(f.size / 1024)} KB, max ${Math.round(PRIVATE_FILE_MAX_BYTES / 1024)} KB).`, at: "form" } });
                  e.target.value = "";
                  setPrivateFile(null);
                  return;
                }
                setPrivateFile(f);
              }}
            />
            {privateFile ? (
              <p className="mt-1.5 text-[11px] text-ink-400">
                {privateFile.name} · {privateFile.size < 1024 ? `${privateFile.size} B` : `${Math.round(privateFile.size / 1024)} KB`} · {privateFile.type || "unknown type"}{" "}
                <button type="button" className="underline hover:text-ink-200" onClick={() => setPrivateFile(null)}>remove</button>
              </p>
            ) : null}
          </Field>
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
              {privateFile ? <StepRow label="Encrypting private file on Swarm (ACT)" state={progress.step === "uploading-private" ? "active" : progress.step === "publishing" ? "done" : "todo"} /> : null}
              <StepRow label="Publishing service to Arkiv" state={progress.step === "publishing" ? "active" : "todo"} />
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={!canPublish || busy}>
              {progress.step === "uploading" ? "Uploading to Swarm…" : progress.step === "uploading-private" ? "Encrypting private file…" : progress.step === "publishing" ? "Publishing to Arkiv…" : "Publish service"}
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
