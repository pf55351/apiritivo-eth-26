import { describe, expect, test } from "bun:test";
import { type Address, encodeAbiParameters, encodeEventTopics, erc20Abi, type Hex, type Log } from "viem";
import { USDC_ADDRESS, usdcToUnits } from "../src";
import { paymentsAbi, serviceKey } from "../src/contract";
import { type ReceiptLike, verifyContractReceipt, verifyUsdcReceipt } from "../src/server";

const contract = "0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3" as const;
const provider = "0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C" as const;
const buyer = "0x2222222222222222222222222222222222222222" as const;
const other = "0x3333333333333333333333333333333333333333" as const;
const tx = "0x39122be542379825ac8e14e3cbc759230ae094822125927b9da219f70ae14307" as const;

function log(address: Address, topics: Hex[], data: Hex): Log {
  return { address, topics: topics as [Hex, ...Hex[]], data, blockNumber: 100n, transactionHash: tx, transactionIndex: 0, blockHash: "0x00", logIndex: 0, removed: false };
}
function transferLog(token: Address, from: Address, to: Address, value: bigint): Log {
  const topics = encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from, to } }) as Hex[];
  return log(token, topics, encodeAbiParameters([{ type: "uint256" }], [value]));
}
function purchasedLog(
  emitter: Address,
  args: { purchaseId: bigint; buyer: Address; provider: Address; serviceId: string; amount: bigint; fee?: bigint; accessSeconds?: bigint },
): Log {
  const topics = encodeEventTopics({ abi: paymentsAbi, eventName: "Purchased", args: { purchaseId: args.purchaseId, buyer: args.buyer, provider: args.provider } }) as Hex[];
  const data = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "uint256" }, { type: "uint256" }, { type: "uint64" }],
    [serviceKey(args.serviceId), args.amount, args.fee ?? 0n, args.accessSeconds ?? 3600n],
  );
  return log(emitter, topics, data);
}
const receipt = (logs: Log[], status: "success" | "reverted" = "success"): ReceiptLike => ({ status, blockNumber: 100n, logs });

describe("direct mode · verifyUsdcReceipt", () => {
  test("accepts a USDC transfer to the provider of at least the price", () => {
    const r = verifyUsdcReceipt(receipt([transferLog(USDC_ADDRESS, buyer, provider, usdcToUnits("1.5"))]), { to: provider, minUsdc: "1.5" });
    expect(r).toEqual({ ok: true, mode: "direct", from: buyer, to: provider, amountUsdc: "1.5", blockNumber: 100n });
  });
  test("sums several transfers in one tx", () => {
    const r = verifyUsdcReceipt(receipt([transferLog(USDC_ADDRESS, buyer, provider, 600_000n), transferLog(USDC_ADDRESS, buyer, provider, 400_000n)]), {
      to: provider,
      minUsdc: "1",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amountUsdc).toBe("1");
  });
  test("is case-insensitive on the payout address", () => {
    const r = verifyUsdcReceipt(receipt([transferLog(USDC_ADDRESS, buyer, provider, 1n)]), { to: provider.toLowerCase() as Address, minUsdc: "0.000001" });
    expect(r.ok).toBe(true);
  });
  test("rejects underpayment with the amounts in the reason", () => {
    const r = verifyUsdcReceipt(receipt([transferLog(USDC_ADDRESS, buyer, provider, usdcToUnits("0.4"))]), { to: provider, minUsdc: "0.5" });
    expect(r).toEqual({ ok: false, reason: "Paid 0.4 USDC, but the service costs 0.5 USDC." });
  });
  test("rejects a transfer of another token, even with the right recipient", () => {
    const r = verifyUsdcReceipt(receipt([transferLog(other, buyer, provider, usdcToUnits("9"))]), { to: provider, minUsdc: "1" });
    expect(r.ok).toBe(false);
  });
  test("rejects a transfer to someone else", () => {
    const r = verifyUsdcReceipt(receipt([transferLog(USDC_ADDRESS, buyer, other, usdcToUnits("9"))]), { to: provider, minUsdc: "1" });
    expect(r.ok).toBe(false);
  });
  test("rejects reverted and missing transactions", () => {
    expect(verifyUsdcReceipt(receipt([transferLog(USDC_ADDRESS, buyer, provider, 1n)], "reverted"), { to: provider, minUsdc: "0" }).ok).toBe(false);
    expect(verifyUsdcReceipt(null, { to: provider, minUsdc: "0" })).toMatchObject({ ok: false, reason: expect.stringContaining("not found") });
  });
});

describe("contract mode · verifyContractReceipt", () => {
  const params = { provider, serviceId: "market-data-a81f", minUsdc: "1.5" };
  test("accepts a Purchased event from our contract for this provider and service", () => {
    const r = verifyContractReceipt(
      receipt([purchasedLog(contract, { purchaseId: 3n, buyer, provider, serviceId: "market-data-a81f", amount: usdcToUnits("1.5") })]),
      contract,
      params,
    );
    expect(r).toEqual({ ok: true, mode: "contract", from: buyer, to: contract, amountUsdc: "1.5", blockNumber: 100n, purchaseId: 3 });
  });
  test("rejects the same event emitted by a look-alike contract", () => {
    const r = verifyContractReceipt(
      receipt([purchasedLog(other, { purchaseId: 3n, buyer, provider, serviceId: "market-data-a81f", amount: usdcToUnits("1.5") })]),
      contract,
      params,
    );
    expect(r.ok).toBe(false);
  });
  test("rejects a purchase of a different service or for a different provider", () => {
    expect(
      verifyContractReceipt(receipt([purchasedLog(contract, { purchaseId: 1n, buyer, provider, serviceId: "other-service", amount: usdcToUnits("9") })]), contract, params).ok,
    ).toBe(false);
    expect(
      verifyContractReceipt(
        receipt([purchasedLog(contract, { purchaseId: 1n, buyer, provider: other, serviceId: "market-data-a81f", amount: usdcToUnits("9") })]),
        contract,
        params,
      ).ok,
    ).toBe(false);
  });
  test("rejects underpayment", () => {
    const r = verifyContractReceipt(
      receipt([purchasedLog(contract, { purchaseId: 1n, buyer, provider, serviceId: "market-data-a81f", amount: usdcToUnits("1.49") })]),
      contract,
      params,
    );
    expect(r).toEqual({ ok: false, reason: "Paid 1.49 USDC, but the service costs 1.5 USDC." });
  });
  test("ignores plain USDC transfers in contract mode (must go through buy())", () => {
    const r = verifyContractReceipt(receipt([transferLog(USDC_ADDRESS, buyer, provider, usdcToUnits("9"))]), contract, params);
    expect(r.ok).toBe(false);
  });
});
