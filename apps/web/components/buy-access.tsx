"use client";

import { arkivEntityUrl, arkivTxUrl, type BlockTiming, formatPassBearer, generatePassSecret, hashPassSecret, secondsUntilBlock } from "@apiritivo/arkiv";
import { AVAX_FAUCET_URL, explorerAddressUrl, explorerTxUrl, isContractMode, PAYMENT_CHAIN_NAME, paymentsContractAddress, USDC_FAUCET_URL } from "@apiritivo/payments";
import { hasInjectedWallet, injectedSigner, payForAccess, type Signer, waitForPayment } from "@apiritivo/payments/browser";
import type { AccessPass, ArkivService, IssueAccessPassResult } from "@apiritivo/shared";
import { formatAccessDuration, formatPriceUsdc, formatRemaining } from "@apiritivo/shared";
import { getGranteeKey } from "@apiritivo/swarm";
import { useState } from "react";
import { type FriendlyError, toFriendlyError } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { ApiKeyBox } from "./api-key-box";
import { Button, Disclosure, ErrorNotice } from "./ui";

type Step = "idle" | "approving" | "paying" | "confirming" | "issuing" | "done";

function StepRow({ label, state }: { label: string; state: "todo" | "active" | "done" }) {
  const tone = state === "done" ? "text-olive-400" : state === "active" ? "text-spritz-300" : "text-ink-400";
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
  const swarmWallet = useSwarmWallet();
  const [useInjected, setUseInjected] = useState(false);
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

  async function buy() {
    if (!session.identity || !service.payoutAddress || !service.priceUsdc || !service.accessSeconds) return;
    setError(null);
    setResult(null);
    setResultBearer(null);
    setTxHash(null);
    try {
      let signer: Signer | null = null;
      if (useInjected) signer = await injectedSigner();
      else signer = swarmWallet.signer;
      if (!signer) throw new Error("Your Swarm wallet is not ready yet.");

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
      // Proof of ownership: a fresh secret, hashed for Arkiv and encrypted for this identity.
      // The server stores both and never sees the secret.
      const secret = generatePassSecret();
      const [secretHash, encryptedSecret] = [hashPassSecret(secret), await swarmWallet.sealPassSecret(secret)];
      const res = await fetch("/api/access-passes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: service.serviceId,
          buyerId: session.identity.id,
          buyerAddress: sent.from,
          txHash: sent.txHash,
          secretHash,
          encryptedSecret,
          buyerPublicKey: getGranteeKey(),
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
      void swarmWallet.refreshBalances();
    } catch (err) {
      setStep("idle");
      const e = err as Error;
      setError({ message: e?.message || "Purchase failed.", detail: toFriendlyError(err, "").detail });
    }
  }

  const checkoutVisible = !activePass || repurchase || busy;

  return (
    <section className="min-w-0 rounded-panel bg-surface p-5 sm:p-6">
      <p className="text-xs text-subtle">{PAYMENT_CHAIN_NAME}</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <span className="text-3xl font-medium">{service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}</span>
        <span className="text-sm text-subtle">{service.accessSeconds ? `/ ${formatAccessDuration(service.accessSeconds)}` : "Open access"}</span>
      </div>

      {activePass ? (
        <div className="mt-5">
          <p className="text-sm text-olive-400">{timing ? `Unlocked · ${formatRemaining(secondsUntilBlock(activePass.expiresAtBlock, timing))} left` : "Checking expiry…"}</p>
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
      ) : !session.identity ? (
        <div className="mt-5">
          <Button onClick={session.connect} disabled={session.status !== "ready" || session.connecting}>
            Sign in to buy
          </Button>
        </div>
      ) : checkoutVisible ? (
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs text-subtle">Pay with</span>
            <select className="field-control" value={useInjected ? "injected" : "swarm"} disabled={busy} onChange={(event) => setUseInjected(event.target.value === "injected")}>
              <option value="swarm">Swarm wallet</option>
              <option value="injected" disabled={!hasInjectedWallet()}>
                Browser wallet{!hasInjectedWallet() ? " unavailable" : ""}
              </option>
            </select>
          </label>
          {!useInjected ? (
            <div className="text-xs text-subtle">
              {swarmWallet.address ? (
                <>
                  <p>
                    {swarmWallet.balances?.usdc ?? "…"} USDC · {swarmWallet.balances ? Number(swarmWallet.balances.avax).toFixed(4) : "…"} AVAX
                  </p>
                  <div className="mt-3">
                    <Disclosure title="Fund wallet">
                      <a href={explorerAddressUrl(swarmWallet.address)} target="_blank" rel="noreferrer" className="break-all font-mono text-xs hover:text-content">
                        {swarmWallet.address} ↗
                      </a>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <a className="py-2 hover:text-content" href={USDC_FAUCET_URL} target="_blank" rel="noreferrer">
                          USDC faucet ↗
                        </a>
                        <a className="py-2 hover:text-content" href={AVAX_FAUCET_URL} target="_blank" rel="noreferrer">
                          AVAX faucet ↗
                        </a>
                        <Button variant="subtle" size="sm" onClick={() => void swarmWallet.refreshBalances()}>
                          Refresh
                        </Button>
                      </div>
                    </Disclosure>
                  </div>
                </>
              ) : (
                <p>{swarmWallet.status === "deriving" ? "Preparing wallet…" : (swarmWallet.error?.message ?? "Wallet unavailable.")}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-subtle">Confirm the payment in your browser wallet on {PAYMENT_CHAIN_NAME}.</p>
          )}

          {busy ? (
            <ul aria-label="Purchase progress" className="space-y-2 py-2">
              {isContractMode() ? <StepRow label="Approve USDC" state={stateOf(step, "approving")} /> : null}
              <StepRow label={`Pay ${formatPriceUsdc(service.priceUsdc!)}`} state={stateOf(step, "paying")} />
              <StepRow label="Confirm payment" state={stateOf(step, "confirming")} />
              <StepRow label="Create pass" state={stateOf(step, "issuing")} />
            </ul>
          ) : null}
          <Button size="lg" className="w-full" onClick={buy} disabled={busy || swarmWallet.status !== "ready" || (!useInjected && !swarmWallet.signer)}>
            {step === "approving"
              ? "Approving…"
              : step === "paying"
                ? "Paying…"
                : step === "confirming"
                  ? "Confirming…"
                  : step === "issuing"
                    ? "Creating pass…"
                    : `Buy access · ${formatPriceUsdc(service.priceUsdc!)}`}
          </Button>
          {activePass && !busy ? (
            <Button variant="subtle" size="sm" onClick={() => setRepurchase(false)}>
              Cancel
            </Button>
          ) : null}
          <p className="text-xs text-subtle">{contract ? "USDC approval and purchase." : "USDC transfer to the provider."} AVAX covers gas.</p>
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
            <p role="status" className="mb-3 text-xs text-olive-400">
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
