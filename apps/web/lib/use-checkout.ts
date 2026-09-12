"use client";

import { formatPassBearer, generatePassSecret, hashPassSecret } from "@apiritivo/arkiv";
import { payForAccess, signPassClaim, waitForPayment } from "@apiritivo/payments/browser";
import type { ArkivService, IssueAccessPassResult } from "@apiritivo/shared";
import { getGranteeKey } from "@apiritivo/swarm";
import { useCallback, useState } from "react";
import { type FriendlyError, toFriendlyError } from "./errors";
import type { ActiveAccount } from "./identity";

export type CheckoutStep = "idle" | "approving" | "paying" | "confirming" | "issuing" | "done";

export type Checkout = {
  step: CheckoutStep;
  busy: boolean;
  txHash: string | null;
  result: IssueAccessPassResult | null;
  /** `<passKey>.<secret>` of the pass just issued: the only time the secret exists in clear. */
  resultBearer: string | null;
  error: FriendlyError | null;
  buy: () => Promise<void>;
  reset: () => void;
};

const ORDER: CheckoutStep[] = ["approving", "paying", "confirming", "issuing", "done"];

export function checkoutStepState(current: CheckoutStep, step: CheckoutStep): "todo" | "active" | "done" {
  return current === step ? "active" : ORDER.indexOf(current) > ORDER.indexOf(step) ? "done" : "todo";
}

/**
 * The purchase flow for the active account: pay (approve + buy, or a direct
 * transfer), wait for the receipt, generate the pass secret, seal it with the
 * Swarm ID's key, sign the claim and ask the server to mint the pass. The
 * Swarm ID's sharing key goes with it, so the provider can grant private files.
 */
export function useCheckout(service: ArkivService, account: ActiveAccount, onIssued: (result: IssueAccessPassResult) => void): Checkout {
  const [step, setStep] = useState<CheckoutStep>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [result, setResult] = useState<IssueAccessPassResult | null>(null);
  const [resultBearer, setResultBearer] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setResultBearer(null);
    setTxHash(null);
  }, []);

  const buy = useCallback(async () => {
    const identity = account.identity;
    if (!identity || !service.payoutAddress || !service.priceUsdc || !service.accessSeconds) return;
    reset();
    try {
      const signer = account.signer;
      if (!signer) throw new Error(account.kind === "wallet" ? "Connect a wallet first." : "Your Swarm wallet is not ready yet.");
      // The only key the provider may grant the private file to: the buying Swarm ID's.
      const buyerPublicKey = getGranteeKey();
      if (!buyerPublicKey) throw new Error("Sign in with Swarm ID first.");
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
      // Proof of ownership: a fresh secret, hashed for Arkiv and encrypted for the Swarm ID.
      // The server stores both and never sees the secret.
      const secret = generatePassSecret();
      const secretHash = hashPassSecret(secret);
      const encryptedSecret = await account.sealPassSecret(secret);
      // Claim: the paying wallet signs (tx hash, secret hash, file key) so only it can mint the pass
      // for this payment, and the file can only be granted to the key it named.
      const buyerSignature = await signPassClaim(signer, sent.txHash, secretHash, buyerPublicKey);
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
          buyerPublicKey,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<IssueAccessPassResult> & { error?: string; reason?: string };
      if (!res.ok || !json.passKey) throw new Error(json.reason ?? json.error ?? "Access pass could not be issued.");
      const issued = json as IssueAccessPassResult;
      setResult(issued);
      setResultBearer(formatPassBearer(issued.passKey, secret));
      setStep("done");
      onIssued(issued);
      void account.refreshBalances();
    } catch (err) {
      setStep("idle");
      // Wallet and Swarm errors, and the messages thrown above, are written for the user.
      const friendly = toFriendlyError(err, "Purchase failed.");
      setError(err instanceof Error && friendly.message === "Purchase failed." && err.message ? { ...friendly, message: err.message } : friendly);
    }
  }, [account, service, onIssued, reset]);

  return { step, busy: step !== "idle" && step !== "done", txHash, result, resultBearer, error, buy, reset };
}
