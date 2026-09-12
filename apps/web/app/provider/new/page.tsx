"use client";

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
  priceUsdcSchema,
  SERVICE_CATEGORIES,
  serializeManifest,
  slugify,
  validateManifest,
} from "@apiritivo/shared";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CodeBlock } from "@/components/code-panel";
import { FormSteps } from "@/components/form-steps";
import { ManifestOperations } from "@/components/manifest-view";
import { emptyOperation, OperationsBuilder } from "@/components/operations-builder";
import { PublishedView } from "@/components/published-view";
import { Button, CategoryPill, Disclosure, ErrorNotice, SectionTitle } from "@/components/ui";
import { PRIVATE_FILE_MAX_BYTES, publishStepIssues } from "@/lib/publish-validation";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { usePublishService } from "@/lib/use-publish-service";

const ENS_CHAIN_LABEL = ensChainLabel();
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

function formatFileSize(size: number): string {
  return size < 1024 ? `${size} B` : `${Math.round(size / 1024)} KB`;
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
  const privateFileInput = useRef<HTMLInputElement>(null);
  const { progress, busy, publish } = usePublishService();

  const effectiveCategory = category === "custom" ? slugify(customCategory) : category;
  const manifest = useMemo(() => buildManifest(operations), [operations]);
  const manifestValidation = useMemo(() => validateManifest(manifest), [manifest]);
  const stats = manifestStats(manifest);

  const stepIssues = useMemo(
    () => publishStepIssues({ name, description, category: effectiveCategory, priceUsdc, accessSeconds, payoutAddress, ensName, operations, privateFile }),
    [name, description, effectiveCategory, priceUsdc, accessSeconds, payoutAddress, ensName, operations, privateFile],
  );
  const formIssues = Object.values(stepIssues).flat();
  const canPublish = formIssues.length === 0 && session.canUpload && progress.step === "idle";
  const priceLabel = priceUsdcSchema.safeParse(priceUsdc).success ? formatPriceUsdc(priceUsdc.trim()) : "Set a price";

  function submit() {
    if (!canPublish || !manifestValidation.ok) return;
    void publish(
      manifestValidation.manifest,
      {
        serviceId: generateServiceId(name),
        category: effectiveCategory,
        providerId: identity.id,
        providerName: identity.name,
        name: name.trim(),
        description: description.trim(),
        priceUsdc: priceUsdc.trim(),
        accessSeconds,
        payoutAddress: payoutAddress.trim(),
        ensName: ensName.trim() ? ensName.trim().toLowerCase() : undefined,
      },
      privateFile,
    );
  }

  if (progress.step === "done" && progress.result) {
    return <PublishedView name={name} priceUsdc={priceUsdc} accessSeconds={accessSeconds} progress={{ ...progress, result: progress.result }} />;
  }

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
      <div className="min-w-0">
        <div className="space-y-4">
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
        </div>
        <FormSteps
          id="publish"
          disabled={busy}
          onSubmit={submit}
          steps={[
            {
              id: "details",
              title: "API details",
              summary: name.trim() || "Name, description and category",
              issues: stepIssues.details,
              children: (
                <>
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
                </>
              ),
            },
            {
              id: "pricing",
              title: "Price and duration",
              summary: `${priceLabel} · ${formatAccessDuration(accessSeconds)}`,
              issues: stepIssues.pricing,
              children: (
                <>
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
                            {d.label}
                            {d.seconds === DEMO_ACCESS_SECONDS ? " (demo)" : ""}
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
                        <a
                          href={explorerAddressUrl(swarmWallet.address)}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-[11px] text-subtle hover:text-content-secondary"
                        >
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
                      Its ETH address record must already point to your Swarm wallet (
                      {swarmWallet.address ? `${swarmWallet.address.slice(0, 6)}…${swarmWallet.address.slice(-4)}` : "…"}); the server checks it on {ENS_CHAIN_LABEL}. After
                      publishing, the service page lists the two records that make the name resolve to this API.
                    </p>
                  ) : null}
                </>
              ),
            },
            {
              id: "operations",
              title: "Operations",
              summary: `${stats.operations} ${stats.operations === 1 ? "operation" : "operations"} · ${stats.inputs} ${stats.inputs === 1 ? "input" : "inputs"}`,
              issues: stepIssues.operations,
              children: <OperationsBuilder operations={operations} onChange={setOperations} />,
            },
            {
              id: "file",
              title: "Private file",
              summary: privateFile?.name || "Optional attachment",
              optional: true,
              hasValue: Boolean(privateFile),
              issues: stepIssues.file,
              children: (
                <>
                  <p className="mb-4 text-xs text-subtle">Encrypted on Swarm. Grant each buyer access after purchase. Max {Math.round(PRIVATE_FILE_MAX_BYTES / 1024)} KB.</p>
                  <Field label="File" hint="stays encrypted on Swarm">
                    <input
                      type="file"
                      ref={privateFileInput}
                      className="block w-full text-sm text-muted file:mr-3 file:rounded-control file:border-0 file:bg-surface-raised file:px-3 file:py-2 file:text-xs file:font-medium file:text-content hover:file:bg-surface-active"
                      onChange={(e) => setPrivateFile(e.target.files?.[0] ?? null)}
                    />
                  </Field>
                  {privateFile ? (
                    // Outside the label: a button inside a label is invalid and would toggle the file picker.
                    <p className="mt-1.5 text-[11px] text-subtle">
                      {privateFile.name} · {formatFileSize(privateFile.size)} · {privateFile.type || "unknown type"}{" "}
                      <button
                        type="button"
                        className="underline hover:text-content-secondary"
                        onClick={() => {
                          setPrivateFile(null);
                          if (privateFileInput.current) privateFileInput.current.value = "";
                        }}
                      >
                        remove
                      </button>
                    </p>
                  ) : null}
                </>
              ),
            },
            {
              id: "review",
              title: "Review and publish",
              summary: "Check your listing before publishing",
              issues: formIssues,
              children: (
                <>
                  <div className="space-y-2 break-words text-sm">
                    <p className="font-medium">{name.trim() || "Your API name"}</p>
                    <p className="text-muted">{description.trim() || "Add a description."}</p>
                    <p className="text-accent-text">
                      {priceLabel} · {formatAccessDuration(accessSeconds)}
                    </p>
                    <p className="text-xs text-subtle">
                      {stats.operations} {stats.operations === 1 ? "operation" : "operations"}
                      {privateFile ? ` · ${privateFile.name}` : " · No private file"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>Publishing as</span>
                    <span className="font-medium text-content">{identity.name}</span>
                  </div>

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
                </>
              ),
            },
          ]}
        />
      </div>

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
    <div className="space-y-8">
      <SectionTitle title="Publish API" back={{ href: "/provider", label: "My APIs" }} />
      <AuthGate title="Sign in to publish APIs">
        <PublishForm />
      </AuthGate>
    </div>
  );
}
