import { findSaleForBuyer, getService } from "@apiritivo/arkiv";
import { isWriterConfigured, publishGrant } from "@apiritivo/arkiv/server";
import { publishGrantInputSchema } from "@apiritivo/shared";
import { NextResponse } from "next/server";
import { clientIp, jsonError, readJsonBody, shortMessage, withJsonErrors } from "@/lib/server/http";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel: Arkiv reads and a write can exceed the 10 s default. */
export const maxDuration = 60;

/**
 * POST /api/grants — record that a provider granted a buyer access to the
 * service's private file (Swarm ACT). The grant itself happened in the
 * provider's browser (`actAddGrantees`, only the publisher can); this entity
 * publishes the new history reference so the buyer can decrypt.
 * `providerId` is trusted from the caller's Swarm ID session (hackathon
 * boundary). What is verified: the service has this file, and the buyer
 * really bought it with the public key being granted.
 */
export const POST = withJsonErrors("api/grants", async (request: Request) => {
  const limited = checkRateLimit("grant", clientIp(request), RATE_LIMITS.grant);
  if (!limited.ok) return jsonError(429, "Too many requests. Try again shortly.", undefined, { retryAfterSeconds: limited.retryAfterSeconds });

  const body = await readJsonBody(request, publishGrantInputSchema, "grant");
  if (!body.ok) return body.response;
  const input = body.data;
  if (!isWriterConfigured()) return jsonError(503, "Grant could not be recorded.", "Arkiv writer not configured.");

  const service = await getService(input.serviceId);
  if (!service) return jsonError(404, "Service not found on Arkiv.");
  if (!service.privateAttachment) return jsonError(409, "This service has no private file.");
  if (service.providerId !== input.providerId) return jsonError(403, "Only the provider of this service can grant access.");
  if (service.privateAttachment.encryptedRef.toLowerCase() !== input.encryptedRef.toLowerCase()) {
    return jsonError(409, "Encrypted reference does not match the service's private file.");
  }
  // A grant is only meaningful for a buyer who paid and registered this key at purchase.
  const sale = await findSaleForBuyer(input.serviceId, input.buyerId);
  if (!sale) return jsonError(409, "No purchase from this buyer for this service.");
  if (!sale.buyerPublicKey || sale.buyerPublicKey.toLowerCase() !== input.buyerPublicKey.toLowerCase()) {
    return jsonError(409, "The public key does not match the one the buyer registered at purchase.");
  }

  try {
    const result = await publishGrant(input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[api/grants] failed:", err);
    return jsonError(502, "Grant could not be recorded.", shortMessage(err));
  }
});
