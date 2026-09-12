import { botRequestSchema } from "@apiritivo/shared";
import { NextResponse } from "next/server";
import { requireAccessPass, runDemoOperation } from "@/lib/server/access";
import { jsonError, readJsonBody, shortMessage, withJsonErrors } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel: the Arkiv pass check plus the price lookup can exceed the 10 s default. */
export const maxDuration = 60;

/**
 * Demo bot behind an access pass. Before answering it verifies the bearer
 * token on Arkiv (`verifyAccessPass`): the pass entity must exist (Arkiv
 * deletes expired ones), match this service and still be in the future.
 */
export const POST = withJsonErrors("api/bot", async (request: Request, context: { params: Promise<{ serviceId: string }> }) => {
  const { serviceId } = await context.params;
  const gate = await requireAccessPass(request, serviceId);
  if (gate instanceof NextResponse) return gate;

  const body = await readJsonBody(request, botRequestSchema, "bot");
  if (!body.ok) return body.response;

  try {
    const result = await runDemoOperation(body.data.operation, body.data.input);
    return NextResponse.json({ ok: true, operation: body.data.operation, result, verification: gate.verification });
  } catch (err) {
    return jsonError(500, "Demo operation failed.", shortMessage(err), { ok: false, verification: gate.verification });
  }
});
