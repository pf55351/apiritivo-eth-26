import { describe, expect, test, afterEach } from "bun:test";
import { EXPLORER_URL, PAYMENT_CHAIN, PAYMENT_CHAIN_ID, USDC_ADDRESS, explorerAddressUrl, explorerTokenUrl, explorerTxUrl } from "../src";
import { isContractMode, paymentsContractAddress } from "../src/contract";

describe("Avalanche Fuji is the payment network", () => {
  test("chain is Fuji (43113), a testnet", () => {
    expect(PAYMENT_CHAIN_ID).toBe(43113);
    expect(PAYMENT_CHAIN.id).toBe(43113);
    expect(PAYMENT_CHAIN.testnet).toBe(true);
    expect(PAYMENT_CHAIN.nativeCurrency.symbol).toBe("AVAX");
  });
  test("explorer is the Fuji (testnet) view, never mainnet", () => {
    expect(EXPLORER_URL).toMatch(/^https:\/\/testnet\./);
    expect(PAYMENT_CHAIN.blockExplorers?.default.url).toBe(EXPLORER_URL);
  });
  test("USDC is Circle's Fuji test token", () => {
    expect(USDC_ADDRESS).toBe("0x5425890298aed601595a70AB815c96711a31Bc65");
  });
});

describe("explorer links", () => {
  const tx = "0x39122be542379825ac8e14e3cbc759230ae094822125927b9da219f70ae14307";
  const addr = "0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3";
  test("transaction, address and token pages", () => {
    expect(explorerTxUrl(tx)).toBe(`${EXPLORER_URL}/tx/${tx}`);
    expect(explorerAddressUrl(addr)).toBe(`${EXPLORER_URL}/address/${addr}`);
    expect(explorerTokenUrl()).toBe(`${EXPLORER_URL}/token/${USDC_ADDRESS}`);
  });
  test("links are absolute https URLs", () => {
    for (const u of [explorerTxUrl(tx), explorerAddressUrl(addr), explorerTokenUrl()]) expect(() => new URL(u)).not.toThrow();
  });
});

describe("contract mode switch (NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS)", () => {
  const original = process.env.NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS;
    else process.env.NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS = original;
  });
  test("empty → direct transfers", () => {
    process.env.NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS = "";
    expect(paymentsContractAddress()).toBeUndefined();
    expect(isContractMode()).toBe(false);
  });
  test("valid address (with surrounding whitespace) → contract mode", () => {
    process.env.NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS = "  0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3\n";
    expect(paymentsContractAddress()).toBe("0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3");
    expect(isContractMode()).toBe(true);
  });
  test("garbage never enables contract mode", () => {
    for (const bad of ["0x123", "4e98f464dc8c667e3b0fd3092e0f2d4585702fa3", "0xZZ98f464dc8c667e3b0fd3092e0f2d4585702fa3", "https://testnet.snowtrace.io"]) {
      process.env.NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS = bad;
      expect(paymentsContractAddress()).toBeUndefined();
    }
  });
});
