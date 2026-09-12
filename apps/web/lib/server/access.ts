import { type AccessCheck, verifyAccessPass } from "@apiritivo/arkiv";
import type { BotVerification } from "@apiritivo/shared";
import { NextResponse } from "next/server";

/** Shared by /api/bot and /api/gateway: check the bearer pass against Arkiv. */
export async function requireAccessPass(request: Request, serviceId: string): Promise<{ check: AccessCheck & { ok: true }; verification: BotVerification } | NextResponse> {
  const check = await verifyAccessPass(request.headers.get("authorization"), serviceId);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
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

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  AVAX: "avalanche-2",
  USDC: "usd-coin",
  GLM: "golem",
  BZZ: "swarm-bzz",
  SOL: "solana",
  MATIC: "matic-network",
};

/** Demo bot brain: real prices for getQuote, echo for anything else. */
export async function runDemoOperation(operation: string, input: Record<string, unknown>): Promise<unknown> {
  if (operation === "getQuote" && typeof input.symbol === "string") {
    const symbol = input.symbol.trim().toUpperCase();
    const id = COINGECKO_IDS[symbol];
    if (!id) return { symbol, error: `Unknown symbol. Try one of: ${Object.keys(COINGECKO_IDS).join(", ")}` };
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`, { cache: "no-store" });
    if (!res.ok) return { symbol, error: `Price source responded ${res.status}` };
    const json = (await res.json()) as Record<string, { usd?: number }>;
    return { symbol, priceUsd: json[id]?.usd ?? null, source: "coingecko", at: new Date().toISOString() };
  }
  return { operation, input, answer: `Hello from the APIritivo demo bot. You called "${operation}".`, at: new Date().toISOString() };
}
