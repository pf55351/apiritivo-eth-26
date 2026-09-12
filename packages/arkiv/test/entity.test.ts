import { describe, expect, test } from "bun:test";
import { parseAccessPassEntity, parseSaleEntity, parseServiceEntity } from "../src/entity";

type Attr = { type: string; value: unknown };

const attrs = (over: Record<string, unknown> = {}): Record<string, Attr> => {
  const base: Record<string, unknown> = {
    app: "apiperitivo",
    entity_type: "service",
    service_id: "market-data-a81f",
    category: "market-data",
    provider_id: "swarm-1",
    provider_name: "Francesco",
    available: true,
    version: 1,
    manifest_ref: "a".repeat(64),
    price_usdc: { type: "dec", value: "0.5" },
    access_seconds: { type: "u64", value: 604800n },
    payout_address: { type: "addr", value: "0xCc65929305910A90bb54dd2d33a3dee63E156bE5" },
    ...over,
  };
  const out: Record<string, Attr> = {};
  for (const [k, v] of Object.entries(base)) {
    out[k] =
      v && typeof v === "object" && "type" in v && "value" in v
        ? (v as Attr)
        : { type: typeof v === "boolean" ? "bool" : typeof v === "number" ? "i32" : "str", value: v };
  }
  return out;
};

describe("parseServiceEntity", () => {
  test("maps attributes + payload to ArkivService", () => {
    const service = parseServiceEntity({
      key: "0xabc",
      owner: "0xdef",
      createdAt: 42n,
      attributes: attrs(),
      toJson: () => ({ name: "Market Data API", description: "Prices" }),
    });
    expect(service).toMatchObject({
      serviceId: "market-data-a81f",
      name: "Market Data API",
      description: "Prices",
      providerName: "Francesco",
      available: true,
      version: 1,
      entityKey: "0xabc",
      createdAtBlock: "42",
      priceUsdc: "0.5",
      accessSeconds: 604800,
      payoutAddress: "0xCc65929305910A90bb54dd2d33a3dee63E156bE5",
    });
  });

  test("ignores entities from other apps", () => {
    expect(parseServiceEntity({ attributes: attrs({ app: "other" }), toJson: () => ({ name: "x" }) })).toBeNull();
  });

  test("ignores entities without a name payload", () => {
    expect(parseServiceEntity({ attributes: attrs(), toJson: () => ({}) })).toBeNull();
  });
});

describe("access pass + sale parsing", () => {
  const key = "0x" + "1".repeat(64);
  const passAttrs = attrs({
    entity_type: "access_pass",
    buyer_id: "buyer-1",
    tx_hash: "0x" + "2".repeat(64),
    paid_usdc: { type: "dec", value: "0.5" },
    chain_id: 43113,
  });
  test("parses a pass with its expiry block", () => {
    const pass = parseAccessPassEntity({ key: key as `0x${string}`, expiresAt: 999n, createdAt: 10n, attributes: passAttrs, toJson: () => ({ serviceName: "Market Data" }) });
    expect(pass).toMatchObject({ passKey: key, serviceId: "market-data-a81f", buyerId: "buyer-1", chainId: 43113, expiresAtBlock: "999", serviceName: "Market Data" });
  });
  test("rejects a service entity as a pass", () => {
    expect(parseAccessPassEntity({ key: key as `0x${string}`, expiresAt: 1n, attributes: attrs(), toJson: () => ({}) })).toBeNull();
  });
  test("parses a sale", () => {
    const sale = parseSaleEntity({ key: key as `0x${string}`, attributes: attrs({ entity_type: "sale", buyer_id: "b", tx_hash: "0x" + "3".repeat(64), paid_usdc: { type: "dec", value: "1" }, chain_id: 43113, pass_key: key }), toJson: () => ({}) });
    expect(sale).toMatchObject({ saleKey: key, paidUsdc: "1", passKey: key });
  });
});
