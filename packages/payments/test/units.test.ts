import { describe, expect, test } from "bun:test";
import { toEvmAddress, unitsToUsdc, usdcToUnits } from "../src";

describe("payments units", () => {
  test("USDC has 6 decimals", () => {
    expect(usdcToUnits("0.50")).toBe(500000n);
    expect(unitsToUsdc(1234567n)).toBe("1.234567");
  });
  test("normalises Swarm ID addresses", () => {
    expect(toEvmAddress("cc65929305910a90bb54dd2d33a3dee63e156be5")).toBe("0xcc65929305910a90bb54dd2d33a3dee63e156be5");
    expect(toEvmAddress("0xCc65929305910A90bb54dd2d33a3dee63E156bE5")).toBe("0xCc65929305910A90bb54dd2d33a3dee63E156bE5");
    expect(toEvmAddress("nope")).toBeUndefined();
  });
});

import { serviceKey, paymentsContractAddress } from "../src/contract";
describe("contract helpers", () => {
  test("serviceKey is keccak256 of the utf-8 id (matches Solidity serviceKey)", () => {
    // keccak256("market-data-a81f") computed with forge: cast keccak "market-data-a81f"
    expect(serviceKey("market-data-a81f")).toBe("0x85b892dbfc8ab1bfc02424074ce86340bf0efce99a1a26b20c490a64ebfb6037");
    expect(serviceKey("a")).not.toBe(serviceKey("b"));
  });
  test("contract address is optional", () => {
    expect(paymentsContractAddress()).toBeUndefined();
  });
});
