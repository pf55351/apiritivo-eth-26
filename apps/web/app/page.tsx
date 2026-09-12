"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@apiritivo/shared";
import { useSession } from "@/lib/session";
import { Button, ErrorNotice, Eyebrow } from "@/components/ui";
import { ApiExample } from "@/components/api-example";
import { RoleChooser } from "@/components/role-chooser";
import { arkivDataExplorerUrl } from "@apiritivo/arkiv";
import { explorerAddressUrl, explorerTokenUrl, paymentsContractAddress } from "@apiritivo/payments";
import { publicEnv } from "@/lib/env";

const contractAddress = paymentsContractAddress();
const PILLARS = [
  { name: "Swarm ID", text: "One identity for discovery, publishing, and access.", href: publicEnv.swarmIframeOrigin, link: "swarm-id.snaha.net" },
  { name: "Swarm", text: "Immutable technical manifests: how a machine calls you.", href: publicEnv.swarmGatewayUrl, link: "public gateway" },
  { name: "Arkiv", text: "Live, queryable registry of every published service.", href: arkivDataExplorerUrl(), link: "Arkiv Data Explorer · Tiramisu" },
  {
    name: "Avalanche",
    text: contractAddress ? "USDC access passes settled by the APIritivoPayments contract on Fuji." : "USDC access passes paid on Fuji, straight to the provider wallet.",
    href: contractAddress ? explorerAddressUrl(contractAddress) : explorerTokenUrl(),
    link: contractAddress ? "contract on SnowTrace" : "USDC on SnowTrace",
  },
];

export default function HomePage() {
  const session = useSession();
  const router = useRouter();
  const hadIdentity = useRef<boolean>(false);
  const wasConnecting = useRef<boolean>(false);

  // Only right after a login started on this page (not on a restored session):
  // jump straight into the saved role. Declared before the ref-sync effect so
  // it still sees the previous commit's `connecting` value.
  useEffect(() => {
    const has = Boolean(session.identity);
    if (has && !hadIdentity.current && wasConnecting.current && session.roleLoaded && session.role) {
      router.push(ROLE_HOME[session.role]);
    }
    hadIdentity.current = has;
  }, [session.identity, session.role, session.roleLoaded, router]);

  useEffect(() => {
    wasConnecting.current = session.connecting;
  }, [session.connecting]);

  const loggedIn = Boolean(session.identity);

  return (
    <div>
      <section className="grid items-center gap-12 pb-14 pt-6 sm:pb-20 sm:pt-12 lg:grid-cols-[1.12fr_1fr] lg:gap-14 lg:pt-16">
        <div className="min-w-0 animate-fade-up">
          <Eyebrow>Open infrastructure. Real connections.</Eyebrow>
          <h1 className="hero-title mt-7">
            APIs for the<br /><span className="text-accent">agent era.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            Discover services. Read their manifests. Get access with USDC.
            An open marketplace for people and the agents they build.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" href="/marketplace">Explore the marketplace <span aria-hidden="true">↗</span></Button>
            {!loggedIn ? (
              <Button size="lg" variant="ghost" onClick={session.connect} disabled={session.status !== "ready" || session.connecting}>
                {session.status !== "ready" ? "Connecting to Swarm ID…" : session.connecting ? "Complete sign-in" : "Enter with Swarm ID"}
              </Button>
            ) : (
              <Button size="lg" variant="ghost" href="/provider">Provider dashboard</Button>
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-subtle">
            {loggedIn ? "Your identity is connected. Choose your workspace below." : "Browse freely. Connect with Swarm ID when you’re ready."}
          </p>
          {session.status === "error" || session.error ? (
            <div className="mt-5">
              <ErrorNotice message={session.error ?? "Swarm ID login failed."} detail={session.errorDetail} onRetry={session.retry} />
            </div>
          ) : null}
          <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-xs text-subtle">
            <span>Machine-readable manifests</span>
            <span>Inspectable on-chain</span>
            <span>Testnet edition</span>
          </div>
        </div>
        <div className="min-w-0 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <ApiExample />
        </div>
      </section>

      {loggedIn ? (
        <section className="mb-14 border-t border-line pt-8">
          <Eyebrow>Your workspace</Eyebrow>
          <h2 className="mt-3 text-2xl font-medium tracking-tight">Welcome back, {session.identity?.name}.</h2>
          <div className="mt-6"><RoleChooser /></div>
        </section>
      ) : null}

      <section aria-labelledby="infrastructure-title" className="border-y border-line py-7">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="infrastructure-title" className="text-xs font-medium text-subtle">Built on open infrastructure</h2>
          <span className="font-mono text-[10px] text-subtle">IDENTITY / STORAGE / REGISTRY / PAYMENTS</span>
        </div>
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar) => (
            <div key={pillar.name}>
              <a href={pillar.href} title={pillar.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 text-lg font-semibold tracking-tight hover:text-accent-text">
                {pillar.name} <span aria-hidden="true" className="text-sm text-subtle">↗</span>
              </a>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-subtle">{pillar.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-10 py-16 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <Eyebrow>From discovery to your first call</Eyebrow>
          <h2 className="section-heading mt-5">Understand an API.<br />Then put it to work.</h2>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">The service, its specification, and your access pass. Everything you need to make the next connection.</p>
          <div className="mt-6"><Button variant="ghost" href="/marketplace">Find your next API <span aria-hidden="true">→</span></Button></div>
        </div>
        <ol className="divide-y divide-line border-y border-line">
          {[
            { title: "Discover a service", text: "Search the marketplace by category, provider, or the problem you’re solving." },
            { title: "Inspect the manifest", text: "Read the operations and input types before you integrate. Follow the Swarm reference to inspect the source." },
            { title: "Get access. Make the call.", text: "Connect your identity, purchase access with USDC on Fuji, and call the API with your pass." },
          ].map((step, index) => (
            <li key={step.title} className="flex gap-6 py-6">
              <span className="pt-1 font-mono text-xs text-accent-text">0{index + 1}</span>
              <div>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-subtle">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col items-start justify-between gap-8 rounded-panel border border-line bg-surface px-6 py-9 sm:px-10 md:flex-row md:items-center">
        <div>
          <Eyebrow>For providers</Eyebrow>
          <h2 className="mt-4 text-2xl font-medium tracking-tight sm:text-3xl">Bring your API to the table.</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">Define your operations, set your price, and publish. Give people and agents a clear way to discover what you’ve built.</p>
        </div>
        <Button size="lg" href="/provider/new" className="shrink-0">Publish a service <span aria-hidden="true">↗</span></Button>
      </section>
    </div>
  );
}
