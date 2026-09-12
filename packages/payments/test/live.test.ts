import { describe, expect, test } from "bun:test";
import { liveSaleKey, saleFromPurchasedLog, saleFromTransferLog } from "../src/live";
import { serviceKey } from "../src/contract";

const tx = "0x39122be542379825ac8e14e3cbc759230ae094822125927b9da219f70ae14307" as const;
const buyer = "0x1111111111111111111111111111111111111111" as const;
const provider = "0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C" as const;

describe("live sales · Purchased event → row", () => {
  test("maps a full event, USDC in decimals", () => {
    const sale = saleFromPurchasedLog({
      transactionHash: tx,
      blockNumber: 45_000_000n,
      args: { purchaseId: 7n, buyer, provider, serviceId: serviceKey("market-data-a81f"), amount: 1_500_000n, fee: 0n, accessSeconds: 3600n },
    });
    expect(sale).toEqual({
      txHash: tx,
      buyer,
      provider,
      amountUsdc: "1.5",
      mode: "contract",
      purchaseId: 7,
      serviceKey: serviceKey("market-data-a81f"),
      accessSeconds: 3600,
      blockNumber: 45_000_000n,
    });
  });
  test("drops incomplete logs (pending / removed) instead of showing a bogus sale", () => {
    expect(saleFromPurchasedLog({ transactionHash: tx, blockNumber: 1n, args: { buyer, provider } })).toBeNull();
    expect(saleFromPurchasedLog({ transactionHash: tx, blockNumber: 1n, args: { amount: 1n, provider } })).toBeNull();
  });
});

describe("live sales · USDC Transfer → row", () => {
  test("maps sender as buyer and recipient as provider", () => {
    const sale = saleFromTransferLog({ transactionHash: tx, blockNumber: 2n, args: { from: buyer, to: provider, value: 250_000n } });
    expect(sale).toEqual({ txHash: tx, buyer, provider, amountUsdc: "0.25", mode: "direct", blockNumber: 2n });
  });
  test("drops incomplete logs", () => {
    expect(saleFromTransferLog({ transactionHash: tx, blockNumber: 2n, args: { from: buyer } })).toBeNull();
  });
});

describe("live sales · dedup key", () => {
  test("same tx seen twice by the poller is one sale", () => {
    const a = saleFromTransferLog({ transactionHash: tx, blockNumber: 2n, args: { from: buyer, to: provider, value: 1n } })!;
    const b = saleFromTransferLog({ transactionHash: tx.toUpperCase().replace("0X", "0x") as typeof tx, blockNumber: 3n, args: { from: buyer, to: provider, value: 1n } })!;
    expect(liveSaleKey(a)).toBe(liveSaleKey(b));
  });
  test("two purchases in one tx stay distinct", () => {
    const mk = (id: bigint) => saleFromPurchasedLog({ transactionHash: tx, blockNumber: 1n, args: { purchaseId: id, buyer, provider, amount: 1n, serviceId: serviceKey("x"), accessSeconds: 1n } })!;
    expect(liveSaleKey(mk(1n))).not.toBe(liveSaleKey(mk(2n)));
  });
});
