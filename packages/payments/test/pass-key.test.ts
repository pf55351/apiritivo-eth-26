import { describe, expect, test } from "bun:test";
import { keyFromSignature, PASS_KEY_MESSAGE, passClaimMessage } from "../src/index";

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

describe("passClaimMessage", () => {
  const tx = `0x${"AB".repeat(32)}`;
  const hash = `0x${"CD".repeat(32)}`;
  const key = "02ABCDEF";

  test("names the payment and the secret hash, lowercased", () => {
    const msg = passClaimMessage(tx, hash);
    expect(msg.startsWith("APIritivo pass claim v1")).toBe(true);
    expect(msg).toContain(`Payment: ${tx.toLowerCase()}`);
    expect(msg).toContain(`Secret hash: ${hash.toLowerCase()}`);
    expect(msg).not.toContain("File key");
  });

  test("binds the Swarm ID file key when the buyer wants the private file", () => {
    const msg = passClaimMessage(tx, hash, key);
    expect(msg).toContain(`File key: ${key.toLowerCase()}`);
    // A different key is a different message: the server cannot be handed someone else's key.
    expect(passClaimMessage(tx, hash, "03000000")).not.toBe(msg);
  });

  test("without a file key the v1 text is unchanged", () => {
    expect(passClaimMessage(tx, hash)).toBe(passClaimMessage(tx, hash, undefined));
    expect(passClaimMessage(tx, hash)).toBe(passClaimMessage(tx, hash, ""));
  });
});

describe("keyFromSignature determinism", () => {
  test("the same account signs PASS_KEY_MESSAGE to the same key, another account to a different one", async () => {
    const { privateKeyToAccount } = await import("viem/accounts");
    const { PASS_KEY_MESSAGE } = await import("../src/index");
    const a = privateKeyToAccount(`0x${"5".repeat(64)}`);
    const b = privateKeyToAccount(`0x${"6".repeat(64)}`);
    const k1 = keyFromSignature(await a.signMessage({ message: PASS_KEY_MESSAGE }));
    const k2 = keyFromSignature(await a.signMessage({ message: PASS_KEY_MESSAGE }));
    const k3 = keyFromSignature(await b.signMessage({ message: PASS_KEY_MESSAGE }));
    expect(k1).toEqual(k2);
    expect(k1.length).toBe(32);
    expect(Buffer.from(k1).equals(Buffer.from(k3))).toBe(false);
  });
});
