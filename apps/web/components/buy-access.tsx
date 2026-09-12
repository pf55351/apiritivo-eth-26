"use client";

import { arkivEntityUrl, arkivTxUrl, type BlockTiming, secondsUntilBlock } from "@apiritivo/arkiv";
import { explorerTxUrl, isContractMode, PAYMENT_CHAIN_NAME, paymentsContractAddress } from "@apiritivo/payments";
import type { AccessPass, ArkivService, IssueAccessPassResult } from "@apiritivo/shared";
import { formatAccessDuration, formatPriceUsdc, formatRemaining } from "@apiritivo/shared";
import { useState } from "react";
import { useActiveAccount } from "@/lib/identity";
import { useInjectedWallet } from "@/lib/injected-wallet";
import { useSession } from "@/lib/session";
import { type CheckoutStep, checkoutStepState, useCheckout } from "@/lib/use-checkout";
import { ApiKeyBox } from "./api-key-box";
import { Button, Disclosure, ErrorNotice } from "./ui";
import { WalletFunding } from "./wallet-funding";

function StepRow({ number, label, state }: { number: number; label: string; state: "todo" | "active" | "done" }) {
  const tone = state === "done" ? "text-success" : state === "active" ? "text-accent-text" : "text-subtle";
  return (
    <li aria-current={state === "active" ? "step" : undefined} className={`flex items-center gap-3 text-sm ${tone}`}>
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums ${state === "done" ? "border-success/30 bg-success/10" : "border-current"}`}
      >
        {state === "done" ? (
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 4 4L19 6" />
          </svg>
        ) : state === "active" ? (
          <svg
            aria-hidden="true"
            className="motion-safe:animate-spin"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M12 3a9 9 0 1 1-9 9" />
          </svg>
        ) : (
          String(number).padStart(2, "0")
        )}
      </span>
      {label}
      <span className="sr-only">{state === "done" ? "Complete" : state === "active" ? "In progress" : "Pending"}</span>
    </li>
  );
}

const BUTTON_LABEL: Record<CheckoutStep, string> = {
  idle: "",
  approving: "Approving…",
  paying: "Paying…",
  confirming: "Confirming…",
  issuing: "Creating pass…",
  done: "",
};

/**
 * Checkout for the signed-in Swarm ID. The connected browser wallet (MetaMask,
 * Rabby, Core) pays; the pass secret is sealed with the Swarm ID's key, so the
 * API key opens wherever that identity is signed in, and its sharing key goes
 * on the sale so the provider can grant private files.
 */
export function BuyAccess({
  service,
  passes,
  timing,
  onIssued,
}: {
  service: ArkivService;
  passes: AccessPass[];
  timing: BlockTiming | null;
  onIssued: (result: IssueAccessPassResult) => void;
}) {
  const session = useSession();
  const account = useActiveAccount();
  const wallet = useInjectedWallet();
  const [repurchase, setRepurchase] = useState(false);
  const checkout = useCheckout(service, account, (issued) => {
    setRepurchase(false);
    onIssued(issued);
  });
  const { step, busy, txHash, result, resultBearer, error } = checkout;

  const purchasable = Boolean(service.payoutAddress && service.priceUsdc && service.accessSeconds);
  const activePass = passes.find((p) => (timing ? secondsUntilBlock(p.expiresAtBlock, timing) > 0 : true));
  const resultExpired = result && timing ? secondsUntilBlock(result.expiresAtBlock, timing) <= 0 : false;
  const contract = paymentsContractAddress();
  const walletKind = account.kind === "wallet";
  const checkoutVisible = !activePass || repurchase || busy;
  const signInDisabled = session.status !== "ready" || session.connecting;
  const walletMissing = walletKind && !account.address;
  const contractSteps = isContractMode();

  return (
    <section className="min-w-0 rounded-panel bg-surface p-5 sm:p-6">
      <p className="text-xs text-subtle">{PAYMENT_CHAIN_NAME}</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <span className="text-3xl font-medium">{service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}</span>
        <span className="text-sm font-medium text-accent-heading">{service.accessSeconds ? `/ ${formatAccessDuration(service.accessSeconds)}` : "Open access"}</span>
      </div>

      {activePass ? (
        <div className="mt-5">
          <p className="text-sm text-success">{timing ? `Unlocked · ${formatRemaining(secondsUntilBlock(activePass.expiresAtBlock, timing))} left` : "Checking expiry…"}</p>
          {!checkoutVisible ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button href="/passes">Open My passes</Button>
              <Button variant="subtle" size="sm" onClick={() => setRepurchase(true)}>
                Buy again
              </Button>
            </div>
          ) : null}
          <a href={arkivEntityUrl(activePass.passKey)} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center text-xs text-subtle hover:text-content">
            View pass ↗
          </a>
        </div>
      ) : null}

      {!purchasable ? (
        <p className="mt-4 text-sm text-subtle">Purchasing is unavailable for this API.</p>
      ) : !account.identity ? (
        <div className="mt-5">
          <Button onClick={session.connect} disabled={signInDisabled}>
            {session.connecting ? "Complete sign in" : "Sign in to buy"}
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-subtle">Your Swarm ID owns the pass and the API key.</p>
        </div>
      ) : walletMissing ? (
        <div className="mt-5">
          <Button onClick={account.connect} disabled={wallet.available === false || account.status === "deriving"}>
            {wallet.status === "connecting" ? "Confirm in wallet" : "Connect wallet to pay"}
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-subtle">
            {wallet.available === false ? (
              <>
                No wallet found.{" "}
                <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="underline hover:text-content">
                  MetaMask
                </a>{" "}
                ·{" "}
                <a href="https://rabby.io/" target="_blank" rel="noreferrer" className="underline hover:text-content">
                  Rabby
                </a>
              </>
            ) : (
              `MetaMask, Rabby or Core on ${PAYMENT_CHAIN_NAME} pays the USDC. The pass stays with ${account.identity.name}.`
            )}
          </p>
          {account.error ? (
            <div className="mt-3">
              <ErrorNotice message={account.error.message} detail={account.error.detail} />
            </div>
          ) : null}
        </div>
      ) : checkoutVisible ? (
        <div className="mt-5 space-y-4">
          {account.address ? (
            <WalletFunding label={walletKind ? "Payment wallet" : "Swarm wallet"} address={account.address} balances={account.balances} onRefresh={account.refreshBalances} />
          ) : (
            <p className="text-xs text-subtle">{account.status === "deriving" ? "Preparing wallet…" : (account.error?.message ?? "Wallet unavailable.")}</p>
          )}

          {busy ? (
            <ul aria-label="Purchase progress" aria-live="polite" className="space-y-2 py-2">
              {contractSteps ? <StepRow number={1} label="Approve USDC" state={checkoutStepState(step, "approving")} /> : null}
              <StepRow number={contractSteps ? 2 : 1} label={`Pay ${formatPriceUsdc(service.priceUsdc!)}`} state={checkoutStepState(step, "paying")} />
              <StepRow number={contractSteps ? 3 : 2} label="Confirm payment" state={checkoutStepState(step, "confirming")} />
              <StepRow number={contractSteps ? 4 : 3} label="Create pass" state={checkoutStepState(step, "issuing")} />
            </ul>
          ) : null}
          <Button size="lg" className="w-full" onClick={() => void checkout.buy()} disabled={busy || account.status !== "ready" || !account.signer}>
            {busy ? (
              BUTTON_LABEL[step]
            ) : (
              <span>
                Buy access · <strong className="font-bold">{formatPriceUsdc(service.priceUsdc!)}</strong>
              </span>
            )}
          </Button>
          {activePass && !busy ? (
            <Button variant="subtle" size="sm" onClick={() => setRepurchase(false)}>
              Cancel
            </Button>
          ) : null}
          <p className="text-xs leading-relaxed text-subtle">
            {contract ? "Allow the contract to spend this USDC amount, then pay for access." : "Pay the provider in USDC for access."}
            <span className="mt-1 block">AVAX pays the network fees separately.</span>
          </p>
          {walletKind ? (
            <p className="text-xs leading-relaxed text-subtle">Confirm each payment step in your wallet, then sign once to claim the pass for {account.identity.name}.</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <ErrorNotice message={error.message} detail={error.detail} />
        </div>
      ) : null}
      {txHash || result ? (
        <div className="mt-4">
          {result ? (
            <p role="status" className={`mb-3 text-xs ${resultExpired ? "text-subtle" : "text-success"}`}>
              {resultExpired ? "Access expired. Buy again to continue." : `Access ready until ${new Date(result.expiresAt).toLocaleString()}.`}
            </p>
          ) : null}
          <Disclosure title="Payment receipt">
            <div className="flex flex-wrap gap-3 text-xs text-muted">
              {txHash ? (
                <a href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer" className="py-2 hover:text-content">
                  Payment ↗
                </a>
              ) : null}
              {result ? (
                <>
                  <a href={arkivEntityUrl(result.passKey)} target="_blank" rel="noreferrer" className="py-2 hover:text-content">
                    Pass ↗
                  </a>
                  <a href={arkivEntityUrl(result.saleKey)} target="_blank" rel="noreferrer" className="py-2 hover:text-content">
                    Receipt ↗
                  </a>
                  {result.arkivTxHashes.map((hash) => (
                    <a key={hash} href={arkivTxUrl(hash)} target="_blank" rel="noreferrer" className="py-2 hover:text-content">
                      Arkiv {hash.slice(0, 8)}… ↗
                    </a>
                  ))}
                </>
              ) : null}
            </div>
            {resultBearer ? (
              <div className="mt-3">
                <ApiKeyBox serviceId={service.serviceId} bearer={{ status: "ready", bearer: resultBearer }} />
              </div>
            ) : null}
          </Disclosure>
        </div>
      ) : null}
    </section>
  );
}
