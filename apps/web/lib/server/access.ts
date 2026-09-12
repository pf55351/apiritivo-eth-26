import { type AccessCheck, verifyAccessPass } from "@apiritivo/arkiv";
import type { BotVerification } from "@apiritivo/shared";
import type { NextResponse } from "next/server";
import { jsonError } from "./http";

/** Shared by /api/bot and /api/gateway: check the bearer pass against Arkiv. */
export async function requireAccessPass(request: Request, serviceId: string): Promise<{ check: AccessCheck & { ok: true }; verification: BotVerification } | NextResponse> {
  const check = await verifyAccessPass(request.headers.get("authorization"), serviceId);
  if (!check.ok) return jsonError(check.status, check.error, undefined, { ok: false });
  return {
    check,
    verification: {
      passKey: check.pass.passKey,
      serviceId,
      expiresAtBlock: check.expiresAtBlock,
      currentBlock: check.currentBlock,
      secondsRemaining: check.secondsRemaining,
    },
  };
}

export { runDemoOperation } from "./demo-bot";
