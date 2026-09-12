"use client";

import { ACCESS_DURATIONS, type OperationDraft } from "@apiritivo/shared";
import { useState } from "react";
import { AccountPanel } from "@/components/account-panel";
import { ApiExample } from "@/components/api-example";
import { CodePanel } from "@/components/code-panel";
import { ConnectionDetails } from "@/components/connection-details";
import { FormSteps } from "@/components/form-steps";
import { OperationsBuilder } from "@/components/operations-builder";
import { PassRefreshExample } from "@/components/pass-refresh-example";
import { ReadinessPanel } from "@/components/readiness-panel";
import { Avatar, Badge, BrandLogo, Button, CategoryPill, EmptyState, ErrorNotice, ProfileAvatar, ProofChip, SectionTitle, Skeleton } from "@/components/ui";
import { WalletFunding } from "@/components/wallet-funding";
import { publishStepIssues } from "@/lib/publish-validation";
import { buildChecks } from "@/lib/readiness";

const PALETTE = [
  { name: "Canvas", token: "bg-canvas", dark: "#121311", light: "#F7F7F2", style: "bg-canvas" },
  { name: "Surface", token: "bg-surface", dark: "#191A17", light: "#FDFDF9", style: "bg-surface" },
  { name: "Raised", token: "bg-surface-raised", dark: "#20211D", light: "#EFEFE7", style: "bg-surface-raised" },
  { name: "Orange", token: "bg-accent", dark: "#FF7847", light: "#FF7847", style: "bg-accent" },
  { name: "Accent text", token: "text-accent-text", dark: "#FFB28D", light: "#A63B17", style: "bg-accent-text" },
  { name: "Text", token: "text-content", dark: "#F4F3EB", light: "#20211D", style: "bg-content" },
  { name: "Muted", token: "text-muted", dark: "#BFC0B5", light: "#505349", style: "bg-muted" },
  { name: "Subtle", token: "text-subtle", dark: "#A2A399", light: "#64675B", style: "bg-subtle" },
  { name: "Control border", token: "border-line-strong", dark: "#747569", light: "#828675", style: "bg-line-strong" },
  { name: "Success", token: "text-success", dark: "#B5D49A", light: "#3D642C", style: "bg-success" },
  { name: "Warning", token: "text-warning", dark: "#FDE68A", light: "#805410", style: "bg-warning" },
  { name: "Danger", token: "text-danger", dark: "#F5A1A1", light: "#A82D31", style: "bg-danger" },
];

const SECTIONS = [
  ["foundations", "01", "Foundations"],
  ["controls", "02", "Controls"],
  ["data", "03", "API & identity"],
  ["states", "04", "Interface states"],
  ["usage", "05", "Use in a page"],
] as const;

export default function DesignSystemPage() {
  const [exampleName, setExampleName] = useState("");
  const [exampleCategory, setExampleCategory] = useState("market-data");
  const [exampleOperations, setExampleOperations] = useState<OperationDraft[]>([
    { id: "example-operation", name: "getQuote", inputs: [{ id: "example-input", name: "symbol", type: "string" }] },
  ]);
  const [stepName, setStepName] = useState("");
  const [stepDescription, setStepDescription] = useState("");
  const [stepPrice, setStepPrice] = useState("0.50");
  const [stepDuration, setStepDuration] = useState(7 * 86400);
  const [stepFile, setStepFile] = useState<File | null>(null);
  const [exampleSubmitted, setExampleSubmitted] = useState(false);
  const stepIssues = publishStepIssues({
    name: stepName,
    description: stepDescription,
    category: "market-data",
    priceUsdc: stepPrice,
    accessSeconds: stepDuration,
    payoutAddress: `0x${"1".repeat(40)}`,
    ensName: "",
    operations: exampleOperations,
    privateFile: stepFile,
  });
  const [exampleChecksReady, setExampleChecksReady] = useState(false);
  const [exampleClientChecks, setExampleClientChecks] = useState(false);
  const exampleChecks = buildChecks({
    view: exampleClientChecks ? "client" : "provider",
    wallet: { status: "ready", balances: { avax: "0.3", usdc: exampleChecksReady ? "10" : "0" } },
    writer: { funded: true, balance: "0.099" },
    drive: { mode: "user-stamp", ttlSeconds: (exampleChecksReady ? 30 : 3) * 86_400, usable: true, manageUrl: "#states" },
    faucets: { avax: "#states", usdc: "#states", glm: "#states" },
  });

  return (
    <div>
      <SectionTitle title="UI library" description="Shared styles. Interactive examples." />
      <div className="mt-10 grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-16">
        <aside>
          <nav aria-label="UI library sections" className="flex flex-wrap gap-x-5 lg:sticky lg:top-28 lg:flex-col">
            {SECTIONS.map(([id, , name]) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex min-h-11 items-center py-2 text-sm text-subtle underline decoration-transparent underline-offset-4 hover:text-content hover:decoration-content"
              >
                {name}
              </a>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 space-y-16">
          <section id="foundations" aria-labelledby="foundations-title">
            <h2 id="foundations-title" className="text-2xl font-medium">
              Typography and color
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">Orange for actions. Warm white or charcoal surfaces. Borders only where useful.</p>
            <p className="mt-3 text-xs text-subtle">
              <span className="theme-dark-only">Dark palette</span>
              <span className="theme-light-only">Light palette</span>
            </p>
            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {PALETTE.map((color) => (
                <div key={color.name}>
                  <div className={`h-20 rounded-control border border-line ${color.style}`} />
                  <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs">
                    <span>{color.name}</span>
                    <span className="font-mono text-subtle">
                      <span className="theme-dark-only">{color.dark}</span>
                      <span className="theme-light-only">{color.light}</span>
                    </span>
                  </div>
                  <code className="mt-1 block text-[10px] text-subtle">{color.token}</code>
                </div>
              ))}
            </div>
            <div className="mt-8 border-y border-line py-7">
              <BrandLogo />
              <p className="hero-title mt-6 font-heading">Built for the next connection.</p>
              <p className="mt-4 text-sm text-muted">Inter for body text. Manrope for headings. Source Code Pro for code and addresses.</p>
              <p className="mt-4 font-mono text-xs text-accent-text">getQuote(&#123; symbol: &quot;BTC&quot; &#125;)</p>
              <p className="mt-5 text-xs text-subtle">6px controls · 12px panels · 4px spacing base · visible keyboard focus · reduced motion support</p>
            </div>
          </section>

          <section id="controls" aria-labelledby="controls-title">
            <h2 id="controls-title" className="text-2xl font-medium">
              Buttons and inputs
            </h2>
            <nav aria-label="Navigation style example" className="mt-5 flex gap-2">
              <a href="#controls" className="app-nav-link" aria-current="page">
                Active link
              </a>
              <a href="#data" className="app-nav-link">
                Default link
              </a>
            </nav>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button href="#states">View states ↗</Button>
              <Button variant="ghost" href="#data">
                API preview
              </Button>
              <Button variant="subtle" href="#foundations">
                Back to foundations
              </Button>
              <Button disabled>Connecting…</Button>
            </div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="block text-xs text-muted">
                <span className="mb-2 block">Example service name</span>
                <input className="field-control" value={exampleName} onChange={(event) => setExampleName(event.target.value)} placeholder="Your next API" />
              </label>
              <label className="block text-xs text-muted">
                <span className="mb-2 block">Example category</span>
                <select className="field-control" value={exampleCategory} onChange={(event) => setExampleCategory(event.target.value)}>
                  <option value="market-data">Market data</option>
                  <option value="ai-text">AI text</option>
                  <option value="storage">Storage</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 break-words text-xs text-subtle">
                Local preview: {exampleName || "Untitled service"} · {exampleCategory}
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setExampleName("");
                  setExampleCategory("market-data");
                }}
              >
                Reset example
              </Button>
            </div>
            <div className="mt-8 border-t border-line pt-6">
              <h3 className="mb-2 text-lg font-medium">Publishing steps example</h3>
              <p className="mb-5 text-xs text-subtle">Local preview. Files and form data stay in this page.</p>
              <FormSteps
                id="example-publish"
                onSubmit={() => setExampleSubmitted(true)}
                steps={[
                  {
                    id: "details",
                    title: "API details",
                    summary: stepName || "Name and description",
                    issues: stepIssues.details,
                    children: (
                      <>
                        <label className="block text-xs text-muted">
                          <span className="mb-2 block">Example API name</span>
                          <input className="field-control" value={stepName} onChange={(event) => setStepName(event.target.value)} />
                        </label>
                        <label className="block text-xs text-muted">
                          <span className="mb-2 block">Example description</span>
                          <textarea className="field-control" value={stepDescription} onChange={(event) => setStepDescription(event.target.value)} />
                        </label>
                      </>
                    ),
                  },
                  {
                    id: "pricing",
                    title: "Price and duration",
                    issues: stepIssues.pricing,
                    children: (
                      <>
                        <label className="block text-xs text-muted">
                          <span className="mb-2 block">Example price</span>
                          <input className="field-control" value={stepPrice} onChange={(event) => setStepPrice(event.target.value)} />
                        </label>
                        <label className="block text-xs text-muted">
                          <span className="mb-2 block">Example duration</span>
                          <select className="field-control" value={stepDuration} onChange={(event) => setStepDuration(Number(event.target.value))}>
                            {ACCESS_DURATIONS.map((duration) => (
                              <option key={duration.seconds} value={duration.seconds}>
                                {duration.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    ),
                  },
                  {
                    id: "operations",
                    title: "Operations",
                    issues: stepIssues.operations,
                    children: <OperationsBuilder operations={exampleOperations} onChange={setExampleOperations} />,
                  },
                  {
                    id: "file",
                    title: "Private file",
                    optional: true,
                    hasValue: Boolean(stepFile),
                    issues: stepIssues.file,
                    children: (
                      <label className="block text-xs text-muted">
                        <span className="mb-2 block">Example private file</span>
                        <input type="file" className="field-control" onChange={(event) => setStepFile(event.target.files?.[0] ?? null)} />
                      </label>
                    ),
                  },
                  {
                    id: "review",
                    title: "Review and publish",
                    issues: Object.values(stepIssues).flat(),
                    children: (
                      <>
                        <Button type="submit" disabled={Object.values(stepIssues).some((issues) => issues.length > 0)}>
                          Finish example
                        </Button>
                        {exampleSubmitted ? (
                          <p role="status" className="text-sm text-success">
                            Example complete. Nothing was published.
                          </p>
                        ) : null}
                      </>
                    ),
                  },
                ]}
              />
            </div>
          </section>

          <section id="data" aria-labelledby="data-title">
            <h2 id="data-title" className="text-2xl font-medium">
              API and identity
            </h2>
            <section className="mt-6 flex flex-wrap items-center gap-5" aria-label="Profile avatar examples">
              <ProfileAvatar name="APIritivo-swarm" size={34} />
              <ProfileAvatar name="Example provider" size={48} />
              <ProfileAvatar name="Example client" size={64} />
            </section>
            <section aria-label="Client account examples" className="mt-8">
              <p className="mb-4 text-xs text-subtle">Example account and balances. No wallet connection or network request.</p>
              <div className="grid items-start gap-6 sm:grid-cols-2">
                <div className="w-72 max-w-full">
                  <AccountPanel name="Wallet" address={`0x${"1".repeat(40)}`}>
                    <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <span className="text-muted">Network</span>
                      <span className="inline-flex items-center gap-1.5 text-success">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                        Avalanche Fuji
                      </span>
                    </div>
                  </AccountPanel>
                </div>
                <div className="min-w-0 rounded-panel bg-surface p-5">
                  <WalletFunding
                    label="Example wallet"
                    address={`0x${"1".repeat(40)}`}
                    balances={{ usdc: "10", avax: "0.3" }}
                    onRefresh={async () => {
                      await new Promise((resolve) => setTimeout(resolve, 1200));
                    }}
                  />
                </div>
              </div>
            </section>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Avatar name="Example provider" seed="ui-library" />
              <CategoryPill slug="market-data" />
              <CategoryPill slug="ai-text" />
              <Badge tone="accent">Provider</Badge>
              <Badge tone="warn">Pending</Badge>
            </div>
            <p className="mb-3 mt-6 text-xs text-subtle">Verified and unverified references.</p>
            <div className="mb-8 flex flex-wrap gap-2">
              <ProofChip label="Arkiv" />
              <ProofChip label="Swarm" ok={false} />
            </div>
            <ApiExample />
            <div className="mt-8">
              <p className="mb-3 text-xs text-subtle">Example connection. Sample values and local links.</p>
              <ConnectionDetails
                identity={{ id: "0123456789abcdef0123456789abcdef", name: "Example provider" }}
                canUpload
                uploadMode="user-stamp"
                drive={{ batchId: "abcdef0123456789abcdef0123456789", label: "", usedPercent: 0, ttlSeconds: 3 * 86_400, usable: true }}
                writer={{
                  writerConfigured: true,
                  address: `0x${"1".repeat(40)}`,
                  balance: "0.097760807995521616",
                  funded: true,
                  explorerUrl: "#data",
                  dataExplorerUrl: "#data",
                  faucetUrl: "#data",
                }}
                manageUrl="#data"
              />
            </div>
          </section>

          <section id="states" aria-labelledby="states-title">
            <h2 id="states-title" className="text-2xl font-medium">
              Loading, empty, and error
            </h2>
            <PassRefreshExample />
            <div className="mt-6 space-y-5">
              <div className="max-w-80">
                <p className="mb-3 text-xs text-subtle">Example checks. Refresh changes the example balance and drive status.</p>
                <label className="mb-3 flex min-h-11 items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={exampleClientChecks} onChange={(event) => setExampleClientChecks(event.target.checked)} />
                  Client checks
                </label>
                <ReadinessPanel
                  title={exampleClientChecks ? "Example client checks" : "Example provider checks"}
                  checks={exampleChecks}
                  onRefresh={() => setExampleChecksReady((value) => !value)}
                />
              </div>
              <section aria-label="Loading state example" className="space-y-3 border-t border-line py-5">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </section>
              <EmptyState title="No APIs yet" description="Published APIs will appear here." action={<Button href="#controls">Create example</Button>} />
              <ErrorNotice message="Manifest unavailable. Retry." announce={false} />
            </div>
          </section>

          <section id="usage" aria-labelledby="usage-title">
            <h2 id="usage-title" className="mb-6 text-2xl font-medium">
              Use a component
            </h2>
            <CodePanel
              title="example.tsx"
              language="TSX"
              code={
                'import { Button } from "@/components/ui";\n\nexport function ProviderIntro() {\n  return (\n    <section className="space-y-5">\n      <h2 className="text-2xl font-medium">Publish your API.</h2>\n      <div className="mt-6">\n        <Button href="/provider/new">Publish API</Button>\n      </div>\n    </section>\n  );\n}'
              }
            />
            <p className="mt-5 text-xs leading-relaxed text-subtle">
              Style reference:{" "}
              <a className="underline underline-offset-4 hover:text-content" href="https://supabase.com/" target="_blank" rel="noreferrer">
                Supabase
              </a>
              . Fonts, compact controls, and fine borders with APIritivo’s orange palette.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
