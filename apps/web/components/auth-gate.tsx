"use client";

import type { ReactNode } from "react";
import { useSession } from "@/lib/session";
import { Button, ErrorNotice, Skeleton } from "./ui";

/**
 * Soft gate: shows a sign-in card when there is no Swarm identity.
 * Never blocks navigation between Client and Provider sections.
 */
export function AuthGate({ children, title = "Sign in to continue" }: { children: ReactNode; title?: string }) {
  const session = useSession();

  if (session.status === "initializing") {
    return (
      <div className="glass mx-auto max-w-lg rounded-3xl p-8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
        <p className="mt-6 text-center text-xs text-ink-400">Connecting to Swarm ID…</p>
      </div>
    );
  }

  if (session.status === "error") {
    return (
      <div className="mx-auto max-w-lg">
        <ErrorNotice message={session.error ?? "Swarm ID login failed."} detail={session.errorDetail} onRetry={session.retry} />
      </div>
    );
  }

  if (!session.identity) {
    return (
      <div className="glass mx-auto max-w-lg rounded-3xl p-8 text-center animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Swarm ID</p>
        <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-ink-300">
          APIperitivo uses your Swarm ID as identity. No wallet, no payment. A popup will open.
        </p>
        <div className="mt-6">
          <Button size="lg" onClick={session.connect} disabled={session.connecting}>
            {session.connecting ? "Waiting for Swarm ID…" : "Enter with Swarm ID"}
          </Button>
        </div>
        {session.error ? (
          <div className="mt-4 text-left">
            <ErrorNotice message={session.error} detail={session.errorDetail} />
          </div>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
