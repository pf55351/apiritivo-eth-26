import { describe, expect, test } from "bun:test";
import { ARKIV_STR_MAX_BYTES, arkivStringSchema, issueAccessPassInputSchema, publishServiceInputSchema, swarmReferenceSchema, utf8ByteLength } from "../src";

const baseService = {
  serviceId: "market-data-a81f",
  category: "market-data",
  providerId: "swarm-1",
  manifestRef: "a".repeat(64),
  name: "Market Data",
  description: "Prices for everything",
  priceUsdc: "0.50",
  accessSeconds: 604800,
  payoutAddress: "0xCc65929305910A90bb54dd2d33a3dee63E156bE5",
};

describe("arkivStringSchema", () => {
  test("counts UTF-8 bytes, not characters", () => {
    expect(utf8ByteLength("é")).toBe(2);
    const schema = arkivStringSchema(200);
    expect(schema.safeParse("a".repeat(128)).success).toBe(true);
    expect(schema.safeParse("a".repeat(129)).success).toBe(false);
    // 65 two-byte characters = 130 bytes, under the character limit but over the byte limit.
    expect(schema.safeParse("é".repeat(65)).success).toBe(false);
    expect(ARKIV_STR_MAX_BYTES).toBe(128);
  });
});

describe("publishServiceInputSchema", () => {
  test("accepts the durations the form offers", () => {
    for (const s of [30, 3600, 86400, 604800]) expect(publishServiceInputSchema.safeParse({ ...baseService, accessSeconds: s }).success).toBe(true);
  });
  test("refuses an odd duration, which Arkiv could never mint", () => {
    const r = publishServiceInputSchema.safeParse({ ...baseService, accessSeconds: 3601 });
    expect(r.success).toBe(false);
  });
  test("refuses a provider name that exceeds the Arkiv byte cap", () => {
    expect(publishServiceInputSchema.safeParse({ ...baseService, providerName: "ü".repeat(70) }).success).toBe(false);
  });
  test("manifest references are plain 64-hex Swarm references", () => {
    expect(swarmReferenceSchema.safeParse("b".repeat(64)).success).toBe(true);
    expect(swarmReferenceSchema.safeParse("b".repeat(128)).success).toBe(false);
  });
});

describe("issueAccessPassInputSchema", () => {
  const body = {
    serviceId: "market-data-a81f",
    buyerId: "swarm-identity-1",
    buyerAddress: "0xCc65929305910A90bb54dd2d33a3dee63E156bE5",
    txHash: `0x${"1".repeat(64)}`,
    secretHash: `0x${"2".repeat(64)}`,
    encryptedSecret: "0x0102",
    buyerPublicKey: `03${"ab".repeat(32)}`,
    buyerSignature: `0x${"ab".repeat(65)}`,
  };
  test("accepts a complete purchase", () => {
    expect(issueAccessPassInputSchema.safeParse(body).success).toBe(true);
  });
  test("requires the buyer's claim signature", () => {
    const { buyerSignature: _, ...rest } = body;
    expect(issueAccessPassInputSchema.safeParse(rest).success).toBe(false);
  });
  test("requires the buying Swarm ID's sharing key", () => {
    const { buyerPublicKey: _, ...rest } = body;
    expect(issueAccessPassInputSchema.safeParse(rest).success).toBe(false);
  });
});
