"use client";

import { PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import type { ReactNode } from "react";
import { useInjectedWallet } from "@/lib/injected-wallet";
import { useSession } from "@/lib/session";
import { Button, ErrorNotice, Skeleton } from "./ui";

/**
 * Soft gate: shows a sign-in card when there is no Swarm identity.
 * Workspace selection is handled separately by AppShell.
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
        <p className="mt-2 text-sm text-muted">Continue with Swarm ID. No wallet required.</p>
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

/**
 * Client gate: the marketplace and passes need a connected wallet (MetaMask,
 * Rabby, Core). Swarm ID is not required here; it only unlocks private files.
 */
export function WalletGate({ children, title = "Connect a wallet to continue" }: { children: ReactNode; title?: string }) {
  const wallet = useInjectedWallet();

  if (wallet.address && wallet.status === "ready") return <>{children}</>;

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <p className="text-xs font-normal text-accent-text">Wallet</p>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">MetaMask, Rabby or Core on {PAYMENT_CHAIN_NAME}. Payments and API keys stay with your wallet.</p>
      <div className="mt-6">
        <Button size="lg" onClick={() => void wallet.connect()} disabled={wallet.available === false || wallet.status === "connecting"}>
          {wallet.status === "connecting" ? "Confirm in wallet" : "Connect wallet"}
        </Button>
      </div>
      {wallet.available === false ? (
        <p className="mt-4 text-xs text-subtle">
          No wallet found.{" "}
          <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="underline hover:text-content">
            MetaMask
          </a>{" "}
          ·{" "}
          <a href="https://rabby.io/" target="_blank" rel="noreferrer" className="underline hover:text-content">
            Rabby
          </a>
        </p>
      ) : null}
      {wallet.error ? (
        <div className="mt-4 text-left">
          <ErrorNotice message={wallet.error.message} detail={wallet.error.detail} />
        </div>
      ) : null}
    </div>
  );
}
