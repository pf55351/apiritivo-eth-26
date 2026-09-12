"use client";

import { useState } from "react";
import { ApiExample } from "@/components/api-example";
import { CodePanel } from "@/components/code-panel";
import { Avatar, Badge, BrandMark, Button, CategoryPill, EmptyState, ErrorNotice, Eyebrow, ProofChip, SectionTitle, Skeleton } from "@/components/ui";

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
      <SectionTitle
        eyebrow="APIritivo / UI library"
        title="A shared language for the open web."
        description="The foundations and components used throughout APIritivo. These examples are local UI previews."
        right={<Badge tone="accent">Orange edition · v1</Badge>}
      />
      <div className="mt-10 grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-16">
        <aside>
          <nav aria-label="UI library sections" className="flex flex-wrap gap-1 lg:sticky lg:top-28 lg:flex-col">
            {SECTIONS.map(([id, index, name]) => (
              <a key={id} href={`#${id}`} className="flex min-h-10 items-center gap-3 rounded-control px-3 text-xs text-muted hover:bg-surface hover:text-content">
                <span className="font-mono text-[10px] text-subtle">{index}</span>{name}
              </a>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 space-y-16">
          <section id="foundations" aria-labelledby="foundations-title">
            <Eyebrow>01 / Foundations</Eyebrow>
            <h2 id="foundations-title" className="mt-3 text-2xl font-medium tracking-tight">Quiet surfaces. A clear signal.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">Warm charcoal makes room for the content. Orange marks the next action. Fine borders separate information without competing with it.</p>
            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {PALETTE.map((color) => (
                <div key={color.name}>
                  <div className={`h-20 rounded-control border border-line ${color.style}`} />
                  <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs"><span>{color.name}</span><span className="font-mono text-subtle">{color.hex}</span></div>
                  <code className="mt-1 block text-[10px] text-subtle">{color.token}</code>
                </div>
              ))}
            </div>
            <div className="mt-8 border-y border-line py-7">
              <div className="flex items-center gap-3"><BrandMark className="text-accent" /><span className="text-xl font-semibold tracking-tight">APIritivo</span></div>
              <p className="mt-6 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">Built for the next connection.</p>
              <p className="mt-4 text-sm text-muted">Manrope for the interface. JetBrains Mono for addresses, code, and precise data.</p>
              <p className="mt-4 font-mono text-xs text-accent-text">getQuote(&#123; symbol: &quot;BTC&quot; &#125;)</p>
              <p className="mt-5 text-xs text-subtle">8px controls · 14px panels · 4px spacing base · visible keyboard focus · reduced motion support</p>
            </div>
          </section>

          <section id="controls" aria-labelledby="controls-title">
            <Eyebrow>02 / Controls</Eyebrow>
            <h2 id="controls-title" className="mt-3 text-2xl font-medium tracking-tight">One primary action at a time.</h2>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button href="/marketplace">Explore marketplace ↗</Button>
              <Button variant="ghost" href="/provider">Provider dashboard</Button>
              <Button variant="subtle" href="#foundations">Back to foundations</Button>
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
              <p className="min-w-0 break-words text-xs text-subtle">Local preview: {exampleName || "Untitled service"} · {exampleCategory}</p>
              <Button variant="danger" size="sm" onClick={() => { setExampleName(""); setExampleCategory("market-data"); }}>Reset example</Button>
            </div>
          </section>

          <section id="data" aria-labelledby="data-title">
            <Eyebrow>03 / API & identity</Eyebrow>
            <h2 id="data-title" className="mt-3 text-2xl font-medium tracking-tight">Make technical details readable.</h2>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Avatar name="Example provider" seed="ui-library" />
              <CategoryPill slug="market-data" /><CategoryPill slug="ai-text" /><Badge tone="accent">Provider</Badge>
            </div>
            <p className="mb-3 mt-6 text-xs text-subtle">Proof chip examples: available and unavailable.</p>
            <div className="mb-8 flex flex-wrap gap-2"><ProofChip label="Arkiv" /><ProofChip label="Swarm" ok={false} /></div>
            <ApiExample />
          </section>

          <section id="states" aria-labelledby="states-title">
            <Eyebrow>04 / Interface states</Eyebrow>
            <h2 id="states-title" className="mt-3 text-2xl font-medium tracking-tight">Be clear about what happens next.</h2>
            <p className="mb-6 mt-3 text-sm text-muted">Examples of loading, an empty collection, and a recoverable error.</p>
            <div className="space-y-5">
              <div aria-label="Loading state example" className="card space-y-3 p-6"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
              <EmptyState title="No services published yet." description="Your services will appear here once published." action={<Button href="/provider/new">Publish a service</Button>} />
              <ErrorNotice message="Manifest could not be downloaded." announce={false} />
            </div>
          </section>

          <section id="usage" aria-labelledby="usage-title">
            <Eyebrow>05 / Use in a page</Eyebrow>
            <h2 id="usage-title" className="mb-6 mt-3 text-2xl font-medium tracking-tight">Build with the existing pieces.</h2>
            <CodePanel title="example.tsx" language="TSX" code={'import { Button, Eyebrow } from "@/components/ui";\n\nexport function ProviderIntro() {\n  return (\n    <section className="card p-6">\n      <Eyebrow>For providers</Eyebrow>\n      <h2 className="mt-4 text-2xl">Publish your API.</h2>\n      <div className="mt-6">\n        <Button href="/provider/new">Get started</Button>\n      </div>\n    </section>\n  );\n}'} />
            <p className="mt-5 text-xs leading-relaxed text-subtle">Reference direction: <a className="underline underline-offset-4 hover:text-content" href="https://arkiv.network/" target="_blank" rel="noreferrer">Arkiv</a>, <a className="underline underline-offset-4 hover:text-content" href="https://docs.arkiv.network/" target="_blank" rel="noreferrer">Arkiv docs</a>, and <a className="underline underline-offset-4 hover:text-content" href="https://supabase.com/" target="_blank" rel="noreferrer">Supabase</a>. Adapted for APIritivo with original components and copy.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
