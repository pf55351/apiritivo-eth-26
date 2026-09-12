"use client";

import { arkivEntityUrl, arkivTxUrl } from "@apiritivo/arkiv";
import { ensChainLabel } from "@apiritivo/ens";
import { explorerAddressUrl, PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import {
  ACCESS_DURATIONS,
  buildManifest,
  DEMO_ACCESS_SECONDS,
  formatAccessDuration,
  formatPriceUsdc,
  generateServiceId,
  manifestStats,
  type OperationDraft,
  type PrivateAttachment,
  type PublishServiceResult,
  priceUsdcSchema,
  publishServiceInputSchema,
  SERVICE_CATEGORIES,
  type ServiceManifest,
  serializeManifest,
  slugify,
  validateManifest,
} from "@apiritivo/shared";
import { swarmReferenceUrl, uploadPrivateFile, uploadServiceManifest } from "@apiritivo/swarm";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CodeBlock } from "@/components/code-panel";
import { ManifestOperations } from "@/components/manifest-view";
import { emptyOperation, OperationsBuilder } from "@/components/operations-builder";
import { type ProofLink, ProofPanel } from "@/components/proofs";
import { Button, CategoryPill, Disclosure, ErrorNotice, SectionTitle } from "@/components/ui";
import { type FriendlyError, toFriendlyError } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";

const ENS_CHAIN_LABEL = ensChainLabel();

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

const fieldCls = "field-control";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is rendered as children
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
        <span>{label}</span>
        {hint ? <span className="text-[11px] text-subtle">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function StepRow({ label, state }: { label: string; state: "todo" | "active" | "done" | "error" }) {
  const icon = state === "done" ? "✓" : state === "error" ? "✕" : state === "active" ? "…" : "○";
  const tone = state === "done" ? "text-success" : state === "error" ? "text-danger" : state === "active" ? "text-accent-text" : "text-subtle";
  return (
    <li className={`flex items-center gap-3 text-sm ${tone}`}>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full border border-current font-mono text-xs ${state === "active" ? "animate-pulse" : ""}`}>{icon}</span>
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
  const [ensName, setEnsName] = useState("");
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
      ensName: ensName.trim() || undefined,
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
        else if (key === "ensName") issues.push(`ENS name: ${i.message}`);
      }
    }
    if (!manifestValidation.ok) issues.push(...manifestValidation.errors);
    return issues;
  }, [name, description, effectiveCategory, identity.id, identity.name, manifestValidation, priceUsdc, accessSeconds, payoutAddress, ensName]);

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
      ensName: ensName.trim() ? ensName.trim().toLowerCase() : undefined,
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
        <div className="py-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-3xl text-success">✓</div>
          <p className="mt-4 text-xs font-normal text-success">API published</p>
          <h2 className="mt-1 break-words text-3xl font-medium">{name}</h2>
          <p className="mt-2 text-sm text-muted">Your API is now in the marketplace.</p>
          {progress.privateFile ? <p className="mt-2 text-xs text-subtle">Private file encrypted. Grant access after each purchase.</p> : null}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button href={`/services/${progress.result.serviceId}`}>View API</Button>
          <Button variant="subtle" href="/provider">
            My APIs
          </Button>
        </div>
        <ProofPanel
          columns={2}
          title="Publication details"
          proofs={[
            {
              network: "Swarm · public gateway",
              label: `manifestRef · ${progress.manifestBytes ?? 0} bytes · via ${progress.manifestVia === "gateway" ? "public gateway" : "Swarm ID"}`,
              value: progress.manifestRef ?? "",
              href: swarmReferenceUrl(progress.manifestRef ?? ""),
              hrefLabel: "Swarm gateway",
            },
            {
              network: "Arkiv · Tiramisu testnet",
              label: "entity key",
              value: progress.result.entityKey,
              href: arkivEntityUrl(progress.result.entityKey),
              hrefLabel: "Arkiv explorer",
            },
            { network: "Arkiv · Tiramisu testnet", label: "transaction", value: progress.result.txHash, href: arkivTxUrl(progress.result.txHash), hrefLabel: "Transaction" },
            ...(progress.privateFile
              ? [
                  {
                    network: "Swarm · public gateway",
                    label: `private file · ${progress.privateFile.name} · ${progress.privateFile.bytes} bytes · ACT encrypted, no public link`,
                    value: progress.privateFile.encryptedRef,
                  } satisfies ProofLink,
                ]
              : []),
            { network: "Arkiv · Tiramisu testnet", label: "serviceId", value: progress.result.serviceId },
            { network: "Arkiv · Tiramisu testnet", label: "access terms", value: `${formatPriceUsdc(priceUsdc.trim())} · ${formatAccessDuration(accessSeconds)}` },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
      <form
        className="min-w-0 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (canPublish) void publish();
        }}
      >
        <section className="space-y-5 border-t border-line pt-6 first:border-0 first:pt-0">
          <h2 className="text-xl font-medium">API details</h2>
          <Field label="Service name">
            <input className={fieldCls} placeholder="Market Data API" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Description" hint={`${description.length}/400`}>
            <textarea
              className={`${fieldCls} h-28 resize-none py-3`}
              placeholder="Crypto prices for any symbol."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={400}
            />
          </Field>
          <Field label="Category">
            <select className={fieldCls} value={category} onChange={(event) => setCategory(event.target.value)}>
              {SERVICE_CATEGORIES.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </Field>
          {category === "custom" ? (
            <Field label="Custom category">
              <input
                className={`${fieldCls} mt-3`}
                aria-label="Custom category"
                placeholder="my-category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            </Field>
          ) : null}
        </section>

        <section className="space-y-5 border-t border-line pt-6 first:border-0 first:pt-0">
          <h2 className="text-xl font-medium">Price and duration</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price per access">
              <div className="relative">
                <input className={`${fieldCls} pr-16 font-mono`} inputMode="decimal" placeholder="0.50" value={priceUsdc} onChange={(e) => setPriceUsdc(e.target.value)} />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-subtle">USDC</span>
              </div>
            </Field>
            <Field label="Access duration">
              <select className={fieldCls} value={accessSeconds} onChange={(e) => setAccessSeconds(Number(e.target.value))}>
                {ACCESS_DURATIONS.map((d) => (
                  <option key={d.seconds} value={d.seconds}>
                    {d.label}{d.seconds === DEMO_ACCESS_SECONDS ? " (demo)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted">Payout wallet · {PAYMENT_CHAIN_NAME}</p>
            <div className="flex min-w-0 items-center justify-between gap-2 font-mono text-xs">
              <span className="truncate text-content">
                {swarmWallet.address ?? (swarmWallet.status === "deriving" ? "Deriving from your Swarm ID…" : "Swarm wallet unavailable")}
              </span>
              {swarmWallet.address ? (
                <a href={explorerAddressUrl(swarmWallet.address)} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] text-subtle hover:text-content-secondary">
                  explorer ↗
                </a>
              ) : null}
            </div>
            <p className="mt-1.5 text-[11px] text-subtle">Payments go to your Swarm wallet.</p>
          </div>
          <Field label="ENS name" hint="optional">
            <input
              className={`${fieldCls} font-mono`}
              placeholder="myapi.eth"
              value={ensName}
              onChange={(e) => setEnsName(e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
            />
          </Field>
          {ensName.trim() ? (
            <p className="-mt-3 text-[11px] text-subtle">
              Its ETH address record must already point to your Swarm wallet ({swarmWallet.address ? `${swarmWallet.address.slice(0, 6)}…${swarmWallet.address.slice(-4)}` : "…"});
              the server checks it on {ENS_CHAIN_LABEL}. After publishing, the service page lists the two records that make the name resolve to this API.
            </p>
          ) : null}
        </section>

        <section className="space-y-5 border-t border-line pt-6 first:border-0 first:pt-0">
          <div>
            <h2 className="mt-1 text-xl font-medium">Operations</h2>
            <p className="mt-1 text-sm text-muted">Define operation names and inputs.</p>
          </div>
          <OperationsBuilder operations={operations} onChange={setOperations} />
        </section>

        <Disclosure title="Private file" meta={privateFile ? privateFile.name : "Optional"}>
          <p className="mb-4 text-xs text-subtle">Encrypted on Swarm. Grant each buyer access after purchase. Max {Math.round(PRIVATE_FILE_MAX_BYTES / 1024)} KB.</p>
          <Field label="File" hint="stays encrypted on Swarm">
            <input
              type="file"
              className="block w-full text-sm text-muted file:mr-3 file:rounded-control file:border-0 file:bg-surface-raised file:px-3 file:py-2 file:text-xs file:font-medium file:text-content hover:file:bg-surface-active"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > PRIVATE_FILE_MAX_BYTES) {
                  setProgress({
                    step: "idle",
                    error: { message: `Private file is too large (${Math.round(f.size / 1024)} KB, max ${Math.round(PRIVATE_FILE_MAX_BYTES / 1024)} KB).`, at: "form" },
                  });
                  e.target.value = "";
                  setPrivateFile(null);
                  return;
                }
                setPrivateFile(f);
              }}
            />
            {privateFile ? (
              <p className="mt-1.5 text-[11px] text-subtle">
                {privateFile.name} · {privateFile.size < 1024 ? `${privateFile.size} B` : `${Math.round(privateFile.size / 1024)} KB`} · {privateFile.type || "unknown type"}{" "}
                <button type="button" className="underline hover:text-content-secondary" onClick={() => setPrivateFile(null)}>
                  remove
                </button>
              </p>
            ) : null}
          </Field>
        </Disclosure>

        <section className="space-y-4 border-t border-line pt-6">
          <h2 className="text-xl font-medium">Ready to publish</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Publishing as</span>
            <span className="font-medium text-content">{identity.name}</span>
          </div>

          {!session.canUpload ? (
            <ErrorNotice
              tone="warn"
              message="Storage is unavailable. Add a Swarm drive or enable the shared gateway."
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
            <ul className="space-y-1 text-xs text-warning">
              {formIssues.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          ) : null}

          {busy ? (
            <ul className="space-y-2 py-3">
              <StepRow label="Uploading manifest to Swarm" state={progress.step === "uploading" ? "active" : "done"} />
              {privateFile ? (
                <StepRow
                  label="Encrypting private file on Swarm (ACT)"
                  state={progress.step === "uploading-private" ? "active" : progress.step === "publishing" ? "done" : "todo"}
                />
              ) : null}
              <StepRow label="Publishing service to Arkiv" state={progress.step === "publishing" ? "active" : "todo"} />
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={!canPublish || busy}>
              {progress.step === "uploading"
                ? "Uploading to Swarm…"
                : progress.step === "uploading-private"
                  ? "Encrypting private file…"
                  : progress.step === "publishing"
                    ? "Publishing to Arkiv…"
                    : "Publish API"}
            </Button>
            <Link href="/provider" className="text-sm text-subtle hover:text-content">
              Cancel
            </Link>
          </div>
          <p className="text-[11px] text-subtle">Your listing and API manifest will be public.</p>
        </section>
      </form>

      <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <section className="min-w-0">
          <p className="text-sm text-subtle">Listing preview</p>
          <div className="mt-4 border-t border-line pt-5">
            <CategoryPill slug={effectiveCategory || "utility"} />
            <h3 className="mt-3 break-words text-lg font-medium">{name.trim() || "Your API name"}</h3>
            <p className="mt-1 line-clamp-2 break-words text-sm text-muted">{description.trim() || "Your API description."}</p>
            <p className="mt-3 break-words text-xs text-subtle">{identity.name}</p>
            <p className="mt-2 font-mono text-xs text-accent-text">
              {priceUsdcSchema.safeParse(priceUsdc).success ? formatPriceUsdc(priceUsdc.trim()) : "Enter a price"} · {formatAccessDuration(accessSeconds)}
            </p>
          </div>
        </section>

        <section className="min-w-0">
          <Disclosure title="Operations preview" meta={stats.operations}>
            <ManifestOperations manifest={manifest} compact />
          </Disclosure>
          <details className="ui-disclosure mt-4">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm text-muted hover:text-content">
              <span>Manifest JSON</span>
              <span className="text-xs transition-transform group-open:rotate-90">▸</span>
            </summary>
            <CodeBlock label="Manifest JSON" className="max-w-full overflow-auto py-4 font-mono text-xs leading-relaxed text-muted">
              {serializeManifest(manifest)}
            </CodeBlock>
          </details>
        </section>
      </aside>
    </div>
  );
}

export default function NewServicePage() {
  return (
    <AuthGate title="Sign in to publish APIs">
      <div className="space-y-8">
        <SectionTitle
          title="Publish API"
          right={
            <Link href="/provider" className="text-sm text-subtle hover:text-content">
              ← My APIs
            </Link>
          }
        />
        <PublishForm />
      </div>
    </AuthGate>
  );
}
