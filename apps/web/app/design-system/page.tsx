"use client";

import { useState } from "react";
import { ApiExample } from "@/components/api-example";
import { CodePanel } from "@/components/code-panel";
import { Avatar, Badge, BrandLogo, Button, CategoryPill, EmptyState, ErrorNotice, ProfileAvatar, ProofChip, SectionTitle, Skeleton } from "@/components/ui";

const PALETTE = [
  { name: "Canvas", token: "bg-canvas", hex: "#121311", style: "bg-canvas" },
  { name: "Surface", token: "bg-surface", hex: "#191a17", style: "bg-surface" },
  { name: "Raised", token: "bg-surface-raised", hex: "#20211d", style: "bg-surface-raised" },
  { name: "Orange", token: "bg-accent", hex: "#FF7847", style: "bg-accent" },
  { name: "Text", token: "text-content", hex: "#F4F3EB", style: "bg-content" },
  { name: "Muted", token: "text-muted", hex: "#BFC0B5", style: "bg-muted" },
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
                className="flex min-h-11 items-center py-2 text-sm text-subtle underline decoration-transparent underline-offset-4 hover:text-content hover:decoration-white"
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
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">Orange for actions. Charcoal surfaces. Borders only where useful.</p>
            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {PALETTE.map((color) => (
                <div key={color.name}>
                  <div className={`h-20 rounded-control border border-line ${color.style}`} />
                  <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs">
                    <span>{color.name}</span>
                    <span className="font-mono text-subtle">{color.hex}</span>
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
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Avatar name="Example provider" seed="ui-library" />
              <CategoryPill slug="market-data" />
              <CategoryPill slug="ai-text" />
              <Badge tone="accent">Provider</Badge>
            </div>
            <p className="mb-3 mt-6 text-xs text-subtle">Verified and unverified references.</p>
            <div className="mb-8 flex flex-wrap gap-2">
              <ProofChip label="Arkiv" />
              <ProofChip label="Swarm" ok={false} />
            </div>
            <ApiExample />
          </section>

          <section id="states" aria-labelledby="states-title">
            <h2 id="states-title" className="text-2xl font-medium">
              Loading, empty, and error
            </h2>
            <div className="mt-6 space-y-5">
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
