import { NextResponse } from "next/server";
import { publishServiceInputSchema } from "@apiperitivo/shared";
import { ArkivWriterNotConfiguredError, getWriterStatus, isWriterConfigured, publishService } from "@apiperitivo/arkiv/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/services — create the Arkiv service entity.
 *
 * TRUST ASSUMPTION (Phase 1, hackathon boundary): the `providerId` and
 * `providerName` in the body come from the caller's Swarm ID session and are
 * NOT verified server-side. The entity is signed by the app-owned Arkiv writer
 * key. This is explicitly not trustless; see README "Arkiv writer model".
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = publishServiceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid service data.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }

  if (!isWriterConfigured()) {
    return NextResponse.json(
      { error: "Arkiv publication failed.", reason: "Arkiv writer not configured. Set ARKIV_WRITER_PRIVATE_KEY on the server." },
      { status: 503 },
    );
  }
  const writer = await getWriterStatus();
  if (writer.funded === false) {
    return NextResponse.json(
      {
        error: "Arkiv publication failed.",
        reason: `Arkiv writer ${writer.address} has 0 GLM on Tiramisu. Fund it at ${writer.faucetUrl} and retry.`,
      },
      { status: 503 },
    );
  }

  try {
    const result = await publishService(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ArkivWriterNotConfiguredError) {
      return NextResponse.json({ error: "Arkiv publication failed.", reason: err.message }, { status: 503 });
    }
    const e = err as Error & { shortMessage?: string };
    const short = (e.shortMessage ?? e.message ?? String(err)).split("\n")[0];
    console.error("[api/services] Arkiv publication failed:", err);
    return NextResponse.json(
      {
        error: "Arkiv publication failed.",
        reason: short,
        detail: process.env.NODE_ENV !== "production" ? (e.stack ?? e.message) : undefined,
      },
      { status: 502 },
    );
  }
}

/** GET /api/services — writer health for the provider dashboard (no secrets). */
export async function GET() {
  const status = await getWriterStatus();
  return NextResponse.json({ writerConfigured: status.configured, ...status });
}
