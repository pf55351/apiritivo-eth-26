import { describe, expect, test } from "bun:test";
import { privateKeyToAccount } from "viem/accounts";
import { passClaimMessage } from "../src/index";
import { verifyPassClaim } from "../src/server";

const buyer = privateKeyToAccount(`0x${"7".repeat(64)}`);
const stranger = privateKeyToAccount(`0x${"8".repeat(64)}`);
const txHash = `0x${"a1".repeat(32)}` as const;
const secretHash = `0x${"b2".repeat(32)}` as const;

describe("pass claim", () => {
  test("the message binds the tx and the secret hash, lowercased", () => {
    const m = passClaimMessage(txHash.toUpperCase(), secretHash);
    expect(m).toContain(`Payment: ${txHash}`);
    expect(m).toContain(`Secret hash: ${secretHash}`);
  });

  test("a claim signed by the paying wallet verifies", async () => {
    const signature = await buyer.signMessage({ message: passClaimMessage(txHash, secretHash) });
    expect(await verifyPassClaim({ buyerAddress: buyer.address, txHash, secretHash, signature })).toBe(true);
  });

  test("a claim signed by another wallet, or for another tx or secret, is refused", async () => {
    const foreign = await stranger.signMessage({ message: passClaimMessage(txHash, secretHash) });
    expect(await verifyPassClaim({ buyerAddress: buyer.address, txHash, secretHash, signature: foreign })).toBe(false);
    const own = await buyer.signMessage({ message: passClaimMessage(txHash, secretHash) });
    expect(await verifyPassClaim({ buyerAddress: buyer.address, txHash: `0x${"c3".repeat(32)}`, secretHash, signature: own })).toBe(false);
    expect(await verifyPassClaim({ buyerAddress: buyer.address, txHash, secretHash: `0x${"d4".repeat(32)}`, signature: own })).toBe(false);
  });

  test("garbage signatures do not throw", async () => {
    expect(await verifyPassClaim({ buyerAddress: buyer.address, txHash, secretHash, signature: "0x1234" })).toBe(false);
  });
});
