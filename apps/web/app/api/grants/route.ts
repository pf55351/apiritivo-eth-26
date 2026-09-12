import { NextResponse } from "next/server";
import { publishGrantInputSchema } from "@apiritivo/shared";
import { getService } from "@apiritivo/arkiv";
import { isWriterConfigured, publishGrant } from "@apiritivo/arkiv/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/grants — record that a provider granted a buyer access to the
 * service's private file (Swarm ACT). The grant itself happened in the
 * provider's browser (`actAddGrantees`, only the publisher can); this entity
 * publishes the new history reference so the buyer can decrypt.
 * `providerId` is trusted from the caller's Swarm ID session (hackathon boundary).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = publishGrantInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid grant data.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  }
  if (!isWriterConfigured()) return NextResponse.json({ error: "Grant could not be recorded.", reason: "Arkiv writer not configured." }, { status: 503 });

  const input = parsed.data;
  const service = await getService(input.serviceId);
  if (!service) return NextResponse.json({ error: "Service not found on Arkiv." }, { status: 404 });
  if (!service.privateAttachment) return NextResponse.json({ error: "This service has no private file." }, { status: 409 });
  if (service.providerId !== input.providerId) return NextResponse.json({ error: "Only the provider of this service can grant access." }, { status: 403 });
  if (service.privateAttachment.encryptedRef.toLowerCase() !== input.encryptedRef.toLowerCase()) {
    return NextResponse.json({ error: "Encrypted reference does not match the service's private file." }, { status: 409 });
  }

  try {
    const result = await publishGrant(input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const e = err as Error & { shortMessage?: string };
    console.error("[api/grants] failed:", err);
    return NextResponse.json({ error: "Grant could not be recorded.", reason: (e.shortMessage ?? e.message ?? String(err)).split("\n")[0] }, { status: 502 });
  }
}
