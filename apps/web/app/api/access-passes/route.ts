import { findSaleByTxHash, getService } from "@apiritivo/arkiv";
import { issueAccessPass, isWriterConfigured } from "@apiritivo/arkiv/server";
import { PAYMENT_CHAIN_ID } from "@apiritivo/payments";
import { verifyPassClaim, verifyPayment } from "@apiritivo/payments/server";
import { type IssueAccessPassResult, issueAccessPassInputSchema } from "@apiritivo/shared";
import { NextResponse } from "next/server";
import { clientIp, jsonError, readJsonBody, shortMessage, withJsonErrors } from "@/lib/server/http";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel: on-chain verification plus Arkiv writes can exceed the 10 s default. */
export const maxDuration = 60;

/** Mints in progress by tx hash: two concurrent claims for one payment share one write. */
const inFlight = new Map<string, Promise<NextResponse>>();

/**
 * POST /api/access-passes — mint an access pass after a verified USDC payment.
 *
 * Trust model: the payment is verified on Avalanche Fuji. Contract mode: a
 * `Purchased(provider, serviceId)` event of APIritivoPayments with amount >=
 * price and the listing's duration. Direct mode: a USDC Transfer to the
 * provider's payout address. The tx must not have been used before (sale
 * receipt on Arkiv), and the paying wallet must have signed the claim for this
 * tx and secret hash, so only the payer can mint the pass for its payment.
 * The client sends keccak256(secret) and the secret encrypted for itself: the
 * server stores both and never learns the secret (packages/arkiv pass-secret.ts).
 */
export const POST = withJsonErrors("api/access-passes", async (request: Request) => {
  const limited = checkRateLimit("mint", clientIp(request), RATE_LIMITS.mint);
  if (!limited.ok) return jsonError(429, "Too many requests. Try again shortly.", undefined, { retryAfterSeconds: limited.retryAfterSeconds });

  const body = await readJsonBody(request, issueAccessPassInputSchema, "purchase");
  if (!body.ok) return body.response;
  const input = body.data;
  if (!isWriterConfigured()) return jsonError(503, "Access pass could not be issued.", "Arkiv writer not configured.");

  const txHash = input.txHash.toLowerCase();
  const pending = inFlight.get(txHash);
  if (pending) return pending;
  const work = mint(input, txHash).finally(() => inFlight.delete(txHash));
  inFlight.set(txHash, work);
  return work;
});

async function mint(input: typeof issueAccessPassInputSchema._output, txHash: string): Promise<NextResponse> {
  const buyerAddress = input.buyerAddress.toLowerCase();
  // A wallet buyer's id is its address. A Swarm ID buyer keeps its identity id.
  if (/^0x[0-9a-fA-F]{40}$/.test(input.buyerId) && input.buyerId.toLowerCase() !== buyerAddress) {
    return jsonError(400, "Buyer id does not match the paying wallet.");
  }

  const service = await getService(input.serviceId);
  if (!service) return jsonError(404, "Service not found on Arkiv.");
  if (!service.payoutAddress || !service.priceUsdc || !service.accessSeconds) {
    return jsonError(409, "This service cannot be purchased (missing payout wallet, price or duration).");
  }

  const existing = await findSaleByTxHash(txHash);
  if (existing) return jsonError(409, "This payment was already used for an access pass.", undefined, { passKey: existing.passKey });

  // Only the wallet that paid can claim the pass: it signed this tx hash together with its secret hash.
  const claimed = await verifyPassClaim({
    buyerAddress: input.buyerAddress as `0x${string}`,
    txHash: txHash as `0x${string}`,
    secretHash: input.secretHash as `0x${string}`,
    signature: input.buyerSignature as `0x${string}`,
  });
  if (!claimed) return jsonError(403, "Claim signature is not from the paying wallet.", "Sign the pass claim with the wallet that paid.");

  const verification = await verifyPayment({
    txHash: txHash as `0x${string}`,
    provider: service.payoutAddress as `0x${string}`,
    serviceId: service.serviceId,
    minUsdc: service.priceUsdc,
    accessSeconds: service.accessSeconds,
  });
  if (!verification.ok) {
    if (verification.transient) return jsonError(503, "Payment could not be verified right now.", verification.reason);
    return jsonError(402, "Payment could not be verified.", verification.reason);
  }
  if (verification.from.toLowerCase() !== buyerAddress) return jsonError(402, "Payment could not be verified.", "The transfer was sent from a different wallet.");

  try {
    const result: IssueAccessPassResult = await issueAccessPass({
      service,
      buyerId: input.buyerId,
      buyerAddress: input.buyerAddress,
      txHash,
      paidUsdc: verification.amountUsdc,
      chainId: PAYMENT_CHAIN_ID,
      secretHash: input.secretHash,
      encryptedSecret: input.encryptedSecret,
      buyerPublicKey: input.buyerPublicKey,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[api/access-passes] failed:", err);
    return jsonError(502, "Access pass could not be issued.", shortMessage(err));
  }
}
