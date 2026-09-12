import { findSaleByTxHash, getService } from "@apiritivo/arkiv";
import { issueAccessPass, isWriterConfigured } from "@apiritivo/arkiv/server";
import { PAYMENT_CHAIN_ID } from "@apiritivo/payments";
import { verifyPayment } from "@apiritivo/payments/server";
import { issueAccessPassInputSchema } from "@apiritivo/shared";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel: on-chain verification plus Arkiv writes can exceed the 10 s default. */
export const maxDuration = 60;

/**
 * POST /api/access-passes — mint an access pass after a verified USDC payment.
 *
 * Trust model: the payment is verified on Avalanche Fuji. Contract mode: a
 * `Purchased(provider, serviceId)` event of APIritivoPayments with amount >=
 * price. Direct mode: a USDC Transfer to the provider's payout address. In
 * both cases the tx must not have been used before (sale receipt on Arkiv).
 * `buyerId` (Swarm ID) is taken from the client as in Phase 1. The client also
 * sends keccak256(secret) and the secret encrypted for itself: the server
 * stores both and never learns the secret (see packages/arkiv pass-secret.ts).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = issueAccessPassInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid purchase data.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  }
  if (!isWriterConfigured()) {
    return NextResponse.json({ error: "Access pass could not be issued.", reason: "Arkiv writer not configured." }, { status: 503 });
  }

  const input = parsed.data;
  const service = await getService(input.serviceId);
  if (!service) return NextResponse.json({ error: "Service not found on Arkiv." }, { status: 404 });
  if (!service.payoutAddress || !service.priceUsdc || !service.accessSeconds) {
    return NextResponse.json({ error: "This service cannot be purchased (missing payout wallet, price or duration)." }, { status: 409 });
  }

  const existing = await findSaleByTxHash(input.txHash);
  if (existing) {
    return NextResponse.json({ error: "This payment was already used for an access pass.", passKey: existing.passKey }, { status: 409 });
  }

  const verification = await verifyPayment({
    txHash: input.txHash as `0x${string}`,
    provider: service.payoutAddress as `0x${string}`,
    serviceId: service.serviceId,
    minUsdc: service.priceUsdc,
  });
  if (!verification.ok) {
    return NextResponse.json({ error: "Payment could not be verified.", reason: verification.reason }, { status: 402 });
  }
  if (verification.from.toLowerCase() !== input.buyerAddress.toLowerCase()) {
    return NextResponse.json({ error: "Payment could not be verified.", reason: "The transfer was sent from a different wallet." }, { status: 402 });
  }

  try {
    const result = await issueAccessPass({
      service,
      buyerId: input.buyerId,
      buyerAddress: input.buyerAddress,
      txHash: input.txHash,
      paidUsdc: verification.amountUsdc,
      chainId: PAYMENT_CHAIN_ID,
      secretHash: input.secretHash,
      encryptedSecret: input.encryptedSecret,
      buyerPublicKey: input.buyerPublicKey,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const e = err as Error & { shortMessage?: string };
    console.error("[api/access-passes] failed:", err);
    return NextResponse.json({ error: "Access pass could not be issued.", reason: (e.shortMessage ?? e.message ?? String(err)).split("\n")[0] }, { status: 502 });
  }
}
