import { getService } from "@apiritivo/arkiv";
import { getWriterStatus, isWriterConfigured, publishService } from "@apiritivo/arkiv/server";
import { ensChainLabel, resolveEnsAddress } from "@apiritivo/ens";
import { publishServiceInputSchema } from "@apiritivo/shared";
import { fetchManifestFromGateway, GatewayError } from "@apiritivo/swarm/gateway";
import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";
import { clientIp, jsonError, readJsonBody, shortMessage, withJsonErrors } from "@/lib/server/http";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel: ENS resolution, a Swarm fetch and an Arkiv write can exceed the 10 s default. */
export const maxDuration = 60;

/**
 * POST /api/services — create the Arkiv service entity.
 *
 * TRUST ASSUMPTION (hackathon boundary): `providerId` and `providerName` come
 * from the caller's Swarm ID session and are NOT verified server-side. The
 * entity is signed by the app-owned Arkiv writer key. What IS verified: the
 * manifest exists on Swarm and validates, the service id is free, and an ENS
 * name resolves to the payout wallet.
 */
export const POST = withJsonErrors("api/services", async (request: Request) => {
  const limited = checkRateLimit("publish", clientIp(request), RATE_LIMITS.publish);
  if (!limited.ok) return jsonError(429, "Too many publications from this address. Try again shortly.", undefined, { retryAfterSeconds: limited.retryAfterSeconds });

  const body = await readJsonBody(request, publishServiceInputSchema, "service");
  if (!body.ok) return body.response;
  const input = body.data;

  if (!isWriterConfigured()) return jsonError(503, "Arkiv publication failed.", "Arkiv writer not configured. Set ARKIV_WRITER_PRIVATE_KEY on the server.");
  const writer = await getWriterStatus();
  if (writer.funded === false) {
    return jsonError(503, "Arkiv publication failed.", `Arkiv writer ${writer.address} has 0 GLM on Tiramisu. Fund it at ${writer.faucetUrl} and retry.`);
  }
  if (writer.ownerMismatch) {
    return jsonError(
      503,
      "Arkiv publication failed.",
      `The writer key signs as ${writer.address} but the app trusts ${writer.trustedOwner}. Set NEXT_PUBLIC_ARKIV_WRITER_ADDRESS to match.`,
    );
  }

  // Publish order is manifest → Arkiv: the reference must already resolve to a valid manifest.
  // This also keeps the writer from paying for listings that point at nothing.
  try {
    const manifest = await fetchManifestFromGateway(input.manifestRef, { gatewayUrl: publicEnv.swarmGatewayUrl, timeoutMs: 15_000 });
    if (!manifest.ok) return jsonError(400, "Manifest on Swarm is not valid.", manifest.errors.join("; "));
  } catch (err) {
    if (err instanceof GatewayError && err.code === "not-found")
      return jsonError(400, "Manifest not found on Swarm.", "Upload the manifest first, then publish with its reference.");
    return jsonError(502, "Manifest could not be read from Swarm.", shortMessage(err));
  }

  // A service id names a listing forever: republishing it would swap price and payout under buyers.
  const existing = await getService(input.serviceId);
  if (existing) return jsonError(409, "This service id is already published.", `Service ${input.serviceId} exists; publish under a new id.`);

  // ENS: the name must resolve (addr record) to the payout wallet, otherwise anyone could claim any name.
  if (input.ensName) {
    let resolved: string | null = null;
    try {
      resolved = await resolveEnsAddress(input.ensName);
    } catch (err) {
      return jsonError(502, "ENS name could not be verified.", `ENS resolution failed on ${ensChainLabel()}: ${shortMessage(err)}`);
    }
    if (!resolved || resolved.toLowerCase() !== input.payoutAddress.toLowerCase()) {
      return jsonError(
        400,
        "ENS name does not resolve to your payout wallet.",
        resolved
          ? `${input.ensName} resolves to ${resolved} on ${ensChainLabel()}, expected ${input.payoutAddress}. Set its ETH address record to your Swarm wallet.`
          : `${input.ensName} has no ETH address record on ${ensChainLabel()} (or is not registered). Set it to your Swarm wallet in the ENS app.`,
      );
    }
  }

  try {
    const result = await publishService(input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[api/services] Arkiv publication failed:", err);
    return jsonError(502, "Arkiv publication failed.", shortMessage(err));
  }
});

/** GET /api/services — writer health for the provider dashboard (no secrets). */
export const GET = withJsonErrors("api/services", async () => {
  const status = await getWriterStatus();
  return NextResponse.json({ writerConfigured: status.configured, ...status });
});
