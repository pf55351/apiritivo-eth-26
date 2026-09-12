"use client";

import { arkivEntityUrl, arkivTxUrl, type BlockTiming, formatPassBearer, generatePassSecret, hashPassSecret, secondsUntilBlock } from "@apiritivo/arkiv";
import { AVAX_FAUCET_URL, explorerAddressUrl, explorerTxUrl, isContractMode, PAYMENT_CHAIN_NAME, paymentsContractAddress, USDC_FAUCET_URL } from "@apiritivo/payments";
import { payForAccess, waitForPayment } from "@apiritivo/payments/browser";
import type { AccessPass, ArkivService, IssueAccessPassResult } from "@apiritivo/shared";
import { formatAccessDuration, formatPriceUsdc, formatRemaining } from "@apiritivo/shared";
import { getGranteeKey } from "@apiritivo/swarm";
import { useState } from "react";
import { type FriendlyError, toFriendlyError } from "@/lib/errors";
import { useActiveAccount } from "@/lib/identity";
import { useSession } from "@/lib/session";
import { ApiKeyBox } from "./api-key-box";
import { Button, Disclosure, ErrorNotice } from "./ui";

type Step = "idle" | "approving" | "paying" | "confirming" | "issuing" | "done";

function StepRow({ label, state }: { label: string; state: "todo" | "active" | "done" }) {
  const tone = state === "done" ? "text-success" : state === "active" ? "text-accent-text" : "text-subtle";
  return (
    <li className={`flex items-center gap-3 text-sm ${tone}`}>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full border border-current font-mono text-xs ${state === "active" ? "animate-pulse" : ""}`}>
        {state === "done" ? "✓" : state === "active" ? "…" : "○"}
      </span>
      {label}
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
      const [secretHash, encryptedSecret] = [hashPassSecret(secret), await account.sealPassSecret(secret)];
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
          <div className="text-xs text-subtle">
            <p className="mb-2 text-muted">{walletKind ? "Connected wallet" : "Swarm wallet"}</p>
            {account.address ? (
              <>
                <p>
                  <span className="font-mono">{account.identity.name}</span> · {account.balances?.usdc ?? "…"} USDC ·{" "}
                  {account.balances ? Number(account.balances.avax).toFixed(4) : "…"} AVAX
                </p>
                <div className="mt-3">
                  <Disclosure title="Fund wallet">
                    <a href={explorerAddressUrl(account.address)} target="_blank" rel="noreferrer" className="break-all font-mono text-xs hover:text-content">
                      {account.address} ↗
                    </a>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <a className="py-2 hover:text-content" href={USDC_FAUCET_URL} target="_blank" rel="noreferrer">
                        USDC faucet ↗
                      </a>
                      <a className="py-2 hover:text-content" href={AVAX_FAUCET_URL} target="_blank" rel="noreferrer">
                        AVAX faucet ↗
                      </a>
                      <Button variant="subtle" size="sm" onClick={() => void account.refreshBalances()}>
                        Refresh
                      </Button>
                    </div>
                  </Disclosure>
                </div>
              </>
            ) : (
              <p>{account.status === "deriving" ? "Preparing wallet…" : (account.error?.message ?? "Wallet unavailable.")}</p>
            )}
          </div>

          {busy ? (
            <ul aria-label="Purchase progress" className="space-y-2 py-2">
              {isContractMode() ? <StepRow label="Approve USDC" state={stateOf(step, "approving")} /> : null}
              <StepRow label={`Pay ${formatPriceUsdc(service.priceUsdc!)}`} state={stateOf(step, "paying")} />
              <StepRow label="Confirm payment" state={stateOf(step, "confirming")} />
              <StepRow label="Create pass" state={stateOf(step, "issuing")} />
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
            <span className="mt-1 block">AVAX pays the network fees separately.{walletKind ? " Your wallet signs each step; one extra signature seals the API key." : ""}</span>
          </p>
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
            <p role="status" className="mb-3 text-xs text-success">
              Access ready until {new Date(result.expiresAt).toLocaleString()}.
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
