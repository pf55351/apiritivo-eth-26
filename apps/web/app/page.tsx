"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@apiperitivo/shared";
import { useSession } from "@/lib/session";
import { Button, ErrorNotice } from "@/components/ui";
import { RoleChooser } from "@/components/role-chooser";

const PILLARS = [
  { name: "Swarm ID", text: "Your identity. No wallet, no seed phrase in the app." },
  { name: "Swarm", text: "Immutable technical manifests: how a machine calls you." },
  { name: "Arkiv", text: "Live, queryable registry of every published service." },
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
    <div className="relative overflow-hidden">
      <div className="grid-lines pointer-events-none absolute inset-x-0 -top-8 h-[520px]" />
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-spritz-500/20 blur-3xl animate-float" />
      <div className="pointer-events-none absolute -left-20 top-64 h-64 w-64 rounded-full bg-rose-400/15 blur-3xl animate-float" style={{ animationDelay: "-3s" }} />

      <section className="relative flex flex-col items-center px-2 pt-10 text-center sm:pt-20">
        <div className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-300 animate-fade-up">
          <span className="h-1.5 w-1.5 rounded-full bg-olive-400" /> Phase 1 · live on Swarm & Arkiv testnet
        </div>
        <h1 className="wordmark mt-6 max-w-full break-words text-5xl font-black tracking-tighter sm:text-7xl lg:text-8xl animate-fade-up" style={{ animationDelay: "60ms" }}>
          APIperitivo
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-200 sm:text-2xl animate-fade-up" style={{ animationDelay: "120ms" }}>
          Discover APIs that machines can understand.
        </p>
        <p className="mt-3 max-w-xl text-sm text-ink-400 sm:text-base animate-fade-up" style={{ animationDelay: "160ms" }}>
          A decentralised service marketplace. Identity by Swarm ID, manifests on Swarm, registry on Arkiv.
        </p>

        <div className="mt-10 w-full max-w-3xl animate-fade-up" style={{ animationDelay: "220ms" }}>
          {session.status === "error" ? (
            <ErrorNotice message={session.error ?? "Swarm ID login failed."} detail={session.errorDetail} onRetry={session.retry} />
          ) : !loggedIn ? (
            <div className="flex flex-col items-center gap-4">
              <Button size="lg" onClick={session.connect} disabled={session.status !== "ready" || session.connecting}>
                {session.status !== "ready" ? "Connecting to Swarm ID…" : session.connecting ? "Waiting for Swarm ID…" : "Enter with Swarm ID"}
              </Button>
              <p className="text-xs text-ink-400">A Swarm ID popup will open. No wallet required.</p>
              {session.error ? <ErrorNotice message={session.error} detail={session.errorDetail} /> : null}
            </div>
          ) : (
            <div className="glass rounded-3xl p-6 text-left sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Welcome {session.identity?.name}</p>
              <h2 className="mt-1 text-2xl font-semibold">How do you want to use APIperitivo?</h2>
              <div className="mt-6">
                <RoleChooser />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="relative mt-24 grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p, i) => (
          <div key={p.name} className="card rounded-2xl p-6 animate-fade-up" style={{ animationDelay: `${300 + i * 60}ms` }}>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-spritz-300">{p.name}</p>
            <p className="mt-2 text-sm text-ink-200">{p.text}</p>
          </div>
        ))}
      </section>

      <section className="relative mt-16 grid gap-6 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:grid-cols-2 sm:p-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">Clients</p>
          <h3 className="mt-1 text-xl font-semibold">Browse. Inspect. Integrate.</h3>
          <p className="mt-2 text-sm text-ink-300">Search the live registry, open any service and read its manifest straight from Swarm.</p>
          <div className="mt-4">
            <Button variant="ghost" href="/marketplace">Open marketplace</Button>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">Providers</p>
          <h3 className="mt-1 text-xl font-semibold">Describe. Upload. Publish.</h3>
          <p className="mt-2 text-sm text-ink-300">A friendly form builds your manifest, uploads it to Swarm and registers the service on Arkiv.</p>
          <div className="mt-4">
            <Button variant="ghost" href="/provider">Provider dashboard</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
