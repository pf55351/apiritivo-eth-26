import { describe, expect, test } from "bun:test";
import { keyFromSignature, PASS_KEY_MESSAGE } from "../src/index";

const sigA = `0x${"ab".repeat(65)}` as const;
const sigB = `0x${"cd".repeat(65)}` as const;

describe("keyFromSignature", () => {
  test("32 bytes, deterministic for the same signature", () => {
    const a1 = keyFromSignature(sigA);
    const a2 = keyFromSignature(sigA);
    expect(a1.byteLength).toBe(32);
    expect(Buffer.from(a1).equals(Buffer.from(a2))).toBe(true);
  });

  test("different signatures give different keys", () => {
    expect(Buffer.from(keyFromSignature(sigA)).equals(Buffer.from(keyFromSignature(sigB)))).toBe(false);
  });

  test("is not the signature itself", () => {
    expect(Buffer.from(keyFromSignature(sigA)).toString("hex")).not.toContain("abababab");
  });
});

test("the signed message says what it is for and never changes by accident", () => {
  expect(PASS_KEY_MESSAGE.startsWith("APIritivo pass key v1")).toBe(true);
  expect(PASS_KEY_MESSAGE).toContain("does not send a transaction");
});
