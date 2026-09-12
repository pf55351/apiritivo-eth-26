import { botRequestSchema } from "@apiritivo/shared";
import { NextResponse } from "next/server";
import { requireAccessPass, runDemoOperation } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel: on-chain verification plus Arkiv writes can exceed the 10 s default. */
export const maxDuration = 60;

/**
 * Demo bot behind an access pass. Before answering it verifies the bearer
 * token on Arkiv (`verifyAccessPass`): the pass entity must exist (Arkiv
 * deletes expired ones), match this service and still be in the future.
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

  try {
    const result = await runDemoOperation(parsed.data.operation, parsed.data.input);
    return NextResponse.json({ ok: true, operation: parsed.data.operation, result, verification: gate.verification });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message, verification: gate.verification }, { status: 500 });
  }
}
