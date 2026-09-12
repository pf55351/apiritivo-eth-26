/**
 * Demo bot: what answers when a manifest has no `endpoint`. Real prices for
 * `getQuote`, an echo for anything else.
 */

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

export async function runDemoOperation(operation: string, input: Record<string, unknown>): Promise<unknown> {
  if (operation === "getQuote" && typeof input.symbol === "string") {
    const symbol = input.symbol.trim().toUpperCase();
    const id = COINGECKO_IDS[symbol];
    if (!id) return { symbol, error: `Unknown symbol. Try one of: ${Object.keys(COINGECKO_IDS).join(", ")}` };
    let res: Response;
    try {
      res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    } catch {
      return { symbol, error: "Price source did not answer in time." };
    }
    if (!res.ok) return { symbol, error: `Price source responded ${res.status}` };
    const json = (await res.json()) as Record<string, { usd?: number }>;
    return { symbol, priceUsd: json[id]?.usd ?? null, source: "coingecko", at: new Date().toISOString() };
  }
  return { operation, input, answer: `Hello from the APIritivo demo bot. You called "${operation}".`, at: new Date().toISOString() };
}
