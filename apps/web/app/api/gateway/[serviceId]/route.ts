import { NextResponse } from "next/server";
import { botRequestSchema, manifestFromBytes } from "@apiritivo/shared";
import { getService } from "@apiritivo/arkiv";
import { requireAccessPass, runDemoOperation } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATEWAY = (process.env.NEXT_PUBLIC_SWARM_GATEWAY_URL || "https://api.gateway.ethswarm.org").replace(/\/+$/, "");

/**
 * Zero-code layer for providers: APIritivo verifies the access pass on
 * Arkiv, then forwards the call to the `endpoint` declared in the provider's
 * Swarm manifest. Providers only need to trust the forwarded headers
 * (`x-apiritivo-*`) from this gateway. Without an endpoint the demo bot answers.
 */
export async function POST(request: Request, context: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await context.params;
  const gate = await requireAccessPass(request, serviceId);
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = botRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request: expected { operation, input }." }, { status: 400 });

  const service = await getService(serviceId);
  if (!service) return NextResponse.json({ ok: false, error: "Service not found on Arkiv." }, { status: 404 });

  // Resolve the technical manifest from Swarm to find the provider's endpoint.
  let endpoint: string | undefined;
  try {
    const res = await fetch(`${GATEWAY}/bytes/${service.manifestRef}`, { cache: "no-store" });
    if (res.ok) {
      const manifest = manifestFromBytes(new Uint8Array(await res.arrayBuffer()));
      if (manifest.ok) endpoint = manifest.manifest.endpoint;
    }
  } catch {
    /* fall through to demo bot */
  }

  if (!endpoint) {
    const result = await runDemoOperation(parsed.data.operation, parsed.data.input);
    return NextResponse.json({ ok: true, operation: parsed.data.operation, result, verification: gate.verification, upstream: "demo-bot" });
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-apiritivo-service": serviceId,
        "x-apiritivo-pass": gate.check.pass.passKey,
        "x-apiritivo-buyer": gate.check.pass.buyerId,
        "x-apiritivo-expires-block": gate.check.expiresAtBlock,
      },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await upstream.text();
    let result: unknown = text;
    try {
      result = JSON.parse(text);
    } catch {
      /* plain text upstream */
    }
    return NextResponse.json({ ok: upstream.ok, operation: parsed.data.operation, result, verification: gate.verification, upstream: endpoint }, { status: upstream.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Upstream call failed: ${(err as Error).message}`, verification: gate.verification, upstream: endpoint }, { status: 502 });
  }
}
