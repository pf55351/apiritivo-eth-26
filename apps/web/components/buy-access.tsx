"use client";

import { useState } from "react";
import type { AccessPass, ArkivService, IssueAccessPassResult } from "@apiperitivo/shared";
import { formatAccessDuration, formatPriceUsdc, formatRemaining } from "@apiperitivo/shared";
import { PAYMENT_CHAIN_NAME, USDC_FAUCET_URL, AVAX_FAUCET_URL, explorerTxUrl, explorerAddressUrl, isContractMode, paymentsContractAddress } from "@apiperitivo/payments";
import { hasInjectedWallet, injectedSigner, payForAccess, waitForPayment, type Signer } from "@apiperitivo/payments/browser";
import { arkivEntityUrl, type BlockTiming, secondsUntilBlock } from "@apiperitivo/arkiv";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { toFriendlyError, type FriendlyError } from "@/lib/errors";
import { Button, ErrorNotice } from "./ui";

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
const stateOf = (current: Step, step: Step): "todo" | "active" | "done" =>
  current === step ? "active" : ORDER.indexOf(current) > ORDER.indexOf(step) ? "done" : "todo";

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
  const [step, setStep] = useState<Step>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [result, setResult] = useState<IssueAccessPassResult | null>(null);

  const purchasable = Boolean(service.payoutAddress && service.priceUsdc && service.accessSeconds);
  const activePass = passes.find((p) => (timing ? secondsUntilBlock(p.expiresAtBlock, timing) > 0 : true));
  const busy = step !== "idle" && step !== "done";
  const contract = paymentsContractAddress();

  async function buy() {
    if (!session.identity || !service.payoutAddress || !service.priceUsdc || !service.accessSeconds) return;
    setError(null);
    setResult(null);
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
      const res = await fetch("/api/access-passes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId: service.serviceId, buyerId: session.identity.id, buyerAddress: sent.from, txHash: sent.txHash }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<IssueAccessPassResult> & { error?: string; reason?: string };
      if (!res.ok || !json.passKey) throw new Error(json.reason ?? json.error ?? "Access pass could not be issued.");
      const issued = json as IssueAccessPassResult;
      setResult(issued);
      setStep("done");
      onIssued(issued);
      void swarmWallet.refreshBalances();
    } catch (err) {
      setStep("idle");
      const e = err as Error;
      setError({ message: e?.message || "Purchase failed.", detail: toFriendlyError(err, "").detail });
    }
  }

  const payerLabel = useInjected ? "MetaMask / Core" : "your Swarm wallet";

  return (
    <section className="card rounded-3xl p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Access</p>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-3xl font-semibold tracking-tight text-ink-100">{service.priceUsdc ? formatPriceUsdc(service.priceUsdc) : "Free"}</span>
        <span className="text-sm text-ink-300">{service.accessSeconds ? `per ${formatAccessDuration(service.accessSeconds)}` : "open access"}</span>
      </div>

      {activePass && timing ? (
        <div className="mt-4 rounded-2xl border border-olive-400/30 bg-olive-400/10 p-3 text-sm text-olive-400">
          <p className="font-semibold">Unlocked · {formatRemaining(secondsUntilBlock(activePass.expiresAtBlock, timing))} left</p>
          <p className="mt-1 break-all font-mono text-[11px] text-ink-200">{activePass.passKey}</p>
          <a href={arkivEntityUrl(activePass.passKey)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-ink-300 hover:text-ink-100">
            pass on Arkiv explorer ↗
          </a>
        </div>
      ) : null}

      {!purchasable ? (
        <p className="mt-4 text-sm text-amber-200">This provider has not set a payout wallet yet, so access cannot be bought.</p>
      ) : !session.identity ? (
        <p className="mt-4 text-sm text-ink-300">Sign in with Swarm ID to buy access.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-ink-400">
            {contract ? (
              <>
                Paid in USDC on {PAYMENT_CHAIN_NAME} through the{" "}
                <a href={explorerAddressUrl(contract)} target="_blank" rel="noreferrer" className="font-mono text-ink-300 hover:text-ink-100">APIperitivoPayments ↗</a> contract, credited to the provider.
              </>
            ) : (
              <>
                Paid in USDC on {PAYMENT_CHAIN_NAME}, straight to the provider&apos;s wallet{" "}
                <a href={explorerAddressUrl(service.payoutAddress!)} target="_blank" rel="noreferrer" className="font-mono text-ink-300 hover:text-ink-100">
                  {service.payoutAddress!.slice(0, 6)}…{service.payoutAddress!.slice(-4)} ↗
                </a>
                .
              </>
            )}{" "}
            The server verifies the {contract ? "Purchased event" : "transfer"} and mints your access pass on Arkiv.
          </p>

          <div className="rounded-2xl border border-white/15 bg-ink-900/60 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-ink-300">Pay with</span>
              <div className="flex gap-1 rounded-full border border-white/15 p-0.5">
                <button type="button" onClick={() => setUseInjected(false)} className={`rounded-full px-2.5 py-0.5 ${!useInjected ? "bg-spritz-500 text-ink-950" : "text-ink-300"}`}>Swarm wallet</button>
                <button type="button" onClick={() => setUseInjected(true)} className={`rounded-full px-2.5 py-0.5 ${useInjected ? "bg-spritz-500 text-ink-950" : "text-ink-300"}`} disabled={!hasInjectedWallet()} title={hasInjectedWallet() ? "" : "No wallet extension detected"}>MetaMask</button>
              </div>
            </div>
            {!useInjected ? (
              <div className="mt-2 text-ink-400">
                {swarmWallet.address ? (
                  <>
                    <span className="break-all font-mono text-ink-300">{swarmWallet.address}</span>
                    <div className="mt-1">
                      USDC <span className="text-ink-200">{swarmWallet.balances?.usdc ?? "…"}</span> · AVAX <span className="text-ink-200">{swarmWallet.balances ? Number(swarmWallet.balances.avax).toFixed(4) : "…"}</span>
                      <button type="button" onClick={() => void swarmWallet.refreshBalances()} className="ml-2 underline hover:text-ink-200">refresh</button>
                    </div>
                    <div className="mt-1">
                      Top up: <a className="underline hover:text-ink-200" href={USDC_FAUCET_URL} target="_blank" rel="noreferrer">USDC faucet</a> ·{" "}
                      <a className="underline hover:text-ink-200" href={AVAX_FAUCET_URL} target="_blank" rel="noreferrer">AVAX faucet</a> (gas)
                    </div>
                  </>
                ) : (
                  <span>{swarmWallet.status === "deriving" ? "Deriving your wallet from Swarm ID…" : swarmWallet.error?.message ?? "Wallet unavailable."}</span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-ink-400">Your browser wallet will be asked to switch to {PAYMENT_CHAIN_NAME}{contract ? " and to approve USDC, then to buy" : " and to send USDC"}.</p>
            )}
          </div>

          {busy ? (
            <ul className="space-y-2 rounded-2xl border border-white/15 bg-ink-900/60 p-4">
              {isContractMode() ? <StepRow label="Approving USDC for the contract" state={stateOf(step, "approving")} /> : null}
              <StepRow label={`Paying ${formatPriceUsdc(service.priceUsdc!)} from ${payerLabel}`} state={stateOf(step, "paying")} />
              <StepRow label="Waiting for Avalanche confirmation" state={stateOf(step, "confirming")} />
              <StepRow label="Minting access pass on Arkiv" state={stateOf(step, "issuing")} />
            </ul>
          ) : null}

          <Button size="lg" className="w-full" onClick={buy} disabled={busy || (!useInjected && !swarmWallet.signer)}>
            {step === "approving" ? "Approving…" : step === "paying" ? "Paying…" : step === "confirming" ? "Confirming…" : step === "issuing" ? "Minting pass…" : activePass ? `Buy again · ${formatPriceUsdc(service.priceUsdc!)}` : `Buy access · ${formatPriceUsdc(service.priceUsdc!)}`}
          </Button>
          {txHash ? (
            <a href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer" className="block break-all font-mono text-[11px] text-ink-400 hover:text-ink-100">
              payment tx {txHash} ↗
            </a>
          ) : null}
          {error ? <ErrorNotice message={error.message} detail={error.detail} /> : null}
          {result ? (
            <div className="rounded-2xl border border-olive-400/30 bg-olive-400/10 p-3 text-sm text-olive-400">
              <p className="font-semibold">Access pass minted ✓ · valid until {new Date(result.expiresAt).toLocaleString()}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-ink-200">{result.passKey}</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
