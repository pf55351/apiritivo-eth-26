import { getService } from "@apiritivo/arkiv";
import { botRequestSchema } from "@apiritivo/shared";
import { fetchManifestFromGateway, readCapped } from "@apiritivo/swarm/gateway";
import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";
import { requireAccessPass, runDemoOperation } from "@/lib/server/access";
import { jsonError, readJsonBody, shortMessage, withJsonErrors } from "@/lib/server/http";
import { checkEndpoint } from "@/lib/server/safe-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel: the Arkiv pass check, a Swarm fetch and the upstream call can exceed the 10 s default. */
export const maxDuration = 60;

/** Upstream answers are relayed to the caller; anything bigger than this is not an API response. */
const UPSTREAM_MAX_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 20_000;

/**
 * Zero-code layer for providers: APIritivo verifies the access pass on
 * Arkiv, then forwards the call to the `endpoint` declared in the provider's
 * Swarm manifest. Providers only need to trust the forwarded headers
 * (`x-apiritivo-*`) from this gateway. Without an endpoint the demo bot answers.
 */
export const POST = withJsonErrors("api/gateway", async (request: Request, context: { params: Promise<{ serviceId: string }> }) => {
  const { serviceId } = await context.params;
  const gate = await requireAccessPass(request, serviceId);
  if (gate instanceof NextResponse) return gate;

  const body = await readJsonBody(request, botRequestSchema, "gateway");
  if (!body.ok) return body.response;
  const call = body.data;

  const service = await getService(serviceId);
  if (!service) return jsonError(404, "Service not found on Arkiv.", undefined, { ok: false });

  // Resolve the technical manifest from Swarm to find the provider's endpoint.
  let endpoint: string | undefined;
  try {
    const manifest = await fetchManifestFromGateway(service.manifestRef, { gatewayUrl: publicEnv.swarmGatewayUrl });
    if (manifest.ok) endpoint = manifest.manifest.endpoint;
  } catch {
    /* fall through to demo bot */
  }

  if (!endpoint) {
    const result = await runDemoOperation(call.operation, call.input);
    return NextResponse.json({ ok: true, operation: call.operation, result, verification: gate.verification, upstream: "demo-bot" });
  }

  // The endpoint is provider-controlled: only public https origins are called from the server.
  const target = await checkEndpoint(endpoint);
  if (!target.ok) return jsonError(502, "Upstream endpoint refused.", target.reason, { ok: false, verification: gate.verification, upstream: endpoint });

  try {
    const upstream = await fetch(target.url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        "x-apiritivo-service": serviceId,
        "x-apiritivo-pass": gate.check.pass.passKey,
        "x-apiritivo-buyer": gate.check.pass.buyerId,
        "x-apiritivo-expires-block": gate.check.expiresAtBlock,
      },
      body: JSON.stringify(call),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return jsonError(502, "Upstream endpoint redirected.", "Redirects are not followed; point the manifest endpoint at the final URL.", {
        ok: false,
        verification: gate.verification,
        upstream: endpoint,
      });
    }
    const text = new TextDecoder().decode(await readCapped(upstream, UPSTREAM_MAX_BYTES));
    let result: unknown = text;
    try {
      result = JSON.parse(text);
    } catch {
      /* plain text upstream */
    }
    if (!upstream.ok) {
      return jsonError(502, `Upstream endpoint responded ${upstream.status}.`, undefined, { ok: false, verification: gate.verification, upstream: endpoint });
    }
    return NextResponse.json({ ok: true, operation: call.operation, result, verification: gate.verification, upstream: endpoint });
  } catch (err) {
    return jsonError(502, "Upstream call failed.", shortMessage(err), { ok: false, verification: gate.verification, upstream: endpoint });
  }
});
