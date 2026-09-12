import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createPublicClient, http } from "viem";
import { PAYMENT_CHAIN, USDC_ADDRESS } from "../src";
import { paymentsAbi } from "../src/contract";

const envExample = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
const configured = envExample.match(/^NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS=(.*)$/m)?.[1]?.trim() ?? "";

describe("deployed APIritivoPayments (config)", () => {
  test(".env.example points at a real address on Fuji", () => {
    expect(configured).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
  test("README, contracts/README and CLAUDE.md agree on the address", () => {
    for (const f of ["../../../README.md", "../../../contracts/README.md", "../../../CLAUDE.md"]) {
      expect(readFileSync(new URL(f, import.meta.url), "utf8").toLowerCase()).toContain(configured.toLowerCase());
    }
  });
});

// Network test: only when explicitly requested (bun test needs no RPC by default).
const live = process.env.LIVE_CHAIN_TESTS === "1";
describe.skipIf(!live)("deployed APIritivoPayments (on Fuji, LIVE_CHAIN_TESTS=1)", () => {
  const client = createPublicClient({ chain: PAYMENT_CHAIN, transport: http(process.env.AVALANCHE_FUJI_RPC_URL) });
  const address = configured as `0x${string}`;
  test("has code and settles in Circle's USDC with fee ≤ 10%", async () => {
    expect((await client.getCode({ address }))?.length ?? 0).toBeGreaterThan(2);
    expect((await client.readContract({ address, abi: paymentsAbi, functionName: "token" })).toLowerCase()).toBe(USDC_ADDRESS.toLowerCase());
    expect(Number(await client.readContract({ address, abi: paymentsAbi, functionName: "feeBps" }))).toBeLessThanOrEqual(1000);
  });
  test("owner is the Arkiv writer from .env.example", async () => {
    const owner = envExample.match(/Current writer: (0x[0-9a-fA-F]{40})/)?.[1];
    expect(owner).toBeDefined();
    expect((await client.readContract({ address, abi: paymentsAbi, functionName: "owner" })).toLowerCase()).toBe(owner!.toLowerCase());
  });
});
