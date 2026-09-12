"use client";

import type { ReactNode } from "react";
import { useSession } from "@/lib/session";
import { Button, ErrorNotice, Skeleton } from "./ui";

/**
 * Soft gate: shows a sign-in card when there is no Swarm identity. Swarm ID
 * is the account in both workspaces. Workspace selection is handled by AppShell.
 */
export function AuthGate({ children, title = "Sign in to continue" }: { children: ReactNode; title?: string }) {
  const session = useSession();

  if (session.status === "initializing") {
    return (
      <div className="mx-auto max-w-md py-12">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
        <p className="mt-6 text-center text-xs text-subtle">Connecting to Swarm ID…</p>
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
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="text-xs font-normal text-accent-text">Swarm ID</p>
        <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">Continue with Swarm ID: the same account publishes, buys and opens your API keys.</p>
        <div className="mt-6">
          <Button size="lg" onClick={session.connect} disabled={session.connecting}>
            {session.connecting ? "Complete sign in" : "Enter with Swarm ID"}
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
