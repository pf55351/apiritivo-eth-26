"use client";

import { arkivEntityUrl, arkivTxUrl, type BlockTiming, formatPassBearer, generatePassSecret, hashPassSecret, secondsUntilBlock } from "@apiritivo/arkiv";
import { explorerTxUrl, isContractMode, PAYMENT_CHAIN_NAME, paymentsContractAddress } from "@apiritivo/payments";
import { payForAccess, signPassClaim, waitForPayment } from "@apiritivo/payments/browser";
import type { AccessPass, ArkivService, IssueAccessPassResult } from "@apiritivo/shared";
import { formatAccessDuration, formatPriceUsdc, formatRemaining } from "@apiritivo/shared";
import { getGranteeKey } from "@apiritivo/swarm";
import { useState } from "react";
import { type FriendlyError, toFriendlyError } from "@/lib/errors";
import { useActiveAccount } from "@/lib/identity";
import { useSession } from "@/lib/session";
import { ApiKeyBox } from "./api-key-box";
import { Button, Disclosure, ErrorNotice } from "./ui";
import { WalletFunding } from "./wallet-funding";

type Step = "idle" | "approving" | "paying" | "confirming" | "issuing" | "done";

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

const ORDER: Step[] = ["approving", "paying", "confirming", "issuing", "done"];
const stateOf = (current: Step, step: Step): "todo" | "active" | "done" => (current === step ? "active" : ORDER.indexOf(current) > ORDER.indexOf(step) ? "done" : "todo");

/**
 * Checkout for the active account: the connected wallet in the Client view
 * (MetaMask, Rabby, Core) or the Swarm-derived wallet in the Provider view.
 * The pass secret is sealed with that account's key, so only it can reveal
 * the API key later. Swarm ID, if signed in, is attached for private files.
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
  const [repurchase, setRepurchase] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [result, setResult] = useState<IssueAccessPassResult | null>(null);
  const [resultBearer, setResultBearer] = useState<string | null>(null);

  const purchasable = Boolean(service.payoutAddress && service.priceUsdc && service.accessSeconds);
  const activePass = passes.find((p) => (timing ? secondsUntilBlock(p.expiresAtBlock, timing) > 0 : true));
  const resultExpired = result && timing ? secondsUntilBlock(result.expiresAtBlock, timing) <= 0 : false;
  const busy = step !== "idle" && step !== "done";
  const contract = paymentsContractAddress();
  const walletKind = account.kind === "wallet";

  async function buy() {
    const identity = account.identity;
    if (!identity || !service.payoutAddress || !service.priceUsdc || !service.accessSeconds) return;
    setError(null);
    setResult(null);
    setResultBearer(null);
    setTxHash(null);
    try {
      const signer = account.signer;
      if (!signer) throw new Error(walletKind ? "Connect a wallet first." : "Your Swarm wallet is not ready yet.");
      await account.ensureReady();

      setStep("paying");
      const sent = await payForAccess({
        signer,
        provider: service.payoutAddress as `0x${string}`,
        serviceId: service.serviceId,
        priceUsdc: service.priceUsdc,
        accessSeconds: service.accessSeconds,
        onStep: (s) => setStep(s),
      });
      setTxHash(sent.txHash);
      setStep("confirming");
      const mined = await waitForPayment(sent.txHash);
      if (!mined.success) throw new Error("Payment transaction reverted.");
      setStep("issuing");
      // Proof of ownership: a fresh secret, hashed for Arkiv and encrypted for this account.
      // The server stores both and never sees the secret.
      const secret = generatePassSecret();
      const secretHash = hashPassSecret(secret);
      const encryptedSecret = await account.sealPassSecret(secret);
      // Claim: the paying wallet signs (tx hash, secret hash) so only it can mint the pass for this payment.
      const buyerSignature = await signPassClaim(signer, sent.txHash, secretHash);
      const res = await fetch("/api/access-passes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: service.serviceId,
          buyerId: identity.id,
          buyerAddress: sent.from,
          txHash: sent.txHash,
          secretHash,
          encryptedSecret,
          buyerSignature,
          // Swarm ID key, when signed in: lets the provider grant the private file to this buyer.
          buyerPublicKey: session.identity ? getGranteeKey() : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<IssueAccessPassResult> & { error?: string; reason?: string };
      if (!res.ok || !json.passKey) throw new Error(json.reason ?? json.error ?? "Access pass could not be issued.");
      const issued = json as IssueAccessPassResult;
      setResult(issued);
      setResultBearer(formatPassBearer(issued.passKey, secret));
      setStep("done");
      setRepurchase(false);
      onIssued(issued);
      void account.refreshBalances();
    } catch (err) {
      setStep("idle");
      const e = err as Error;
      setError({ message: e?.message || "Purchase failed.", detail: toFriendlyError(err, "").detail });
    }
  }

  const checkoutVisible = !activePass || repurchase || busy;
  const connectDisabled = walletKind ? account.status === "deriving" : session.status !== "ready" || session.connecting;

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
              <Button href="#try-api">Use API</Button>
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
          <Button onClick={account.connect} disabled={connectDisabled}>
            {walletKind ? "Connect wallet to buy" : "Sign in to buy"}
          </Button>
          {account.error ? (
            <div className="mt-3">
              <ErrorNotice message={account.error.message} detail={account.error.detail} />
            </div>
          ) : null}
        </div>
      ) : checkoutVisible ? (
        <div className="mt-5 space-y-4">
          {account.address ? (
            <WalletFunding label={walletKind ? "Connected wallet" : "Swarm wallet"} address={account.address} balances={account.balances} onRefresh={account.refreshBalances} />
          ) : (
            <p className="text-xs text-subtle">{account.status === "deriving" ? "Preparing wallet…" : (account.error?.message ?? "Wallet unavailable.")}</p>
          )}

          {busy ? (
            <ul aria-label="Purchase progress" aria-live="polite" className="space-y-2 py-2">
              {isContractMode() ? <StepRow number={1} label="Approve USDC" state={stateOf(step, "approving")} /> : null}
              <StepRow number={isContractMode() ? 2 : 1} label={`Pay ${formatPriceUsdc(service.priceUsdc!)}`} state={stateOf(step, "paying")} />
              <StepRow number={isContractMode() ? 3 : 2} label="Confirm payment" state={stateOf(step, "confirming")} />
              <StepRow number={isContractMode() ? 4 : 3} label="Create pass" state={stateOf(step, "issuing")} />
            </ul>
          ) : null}
          <Button size="lg" className="w-full" onClick={buy} disabled={busy || account.status !== "ready" || !account.signer}>
            {step === "approving" ? (
              "Approving…"
            ) : step === "paying" ? (
              "Paying…"
            ) : step === "confirming" ? (
              "Confirming…"
            ) : step === "issuing" ? (
              "Creating pass…"
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
          {walletKind ? <p className="text-xs leading-relaxed text-subtle">Confirm each payment step in your wallet, then sign once to secure your API key.</p> : null}
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
