import { describe, expect, test } from "bun:test";
import { parseServiceEntity } from "../src/entity";

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
    });
  });

  test("ignores entities from other apps", () => {
    expect(parseServiceEntity({ attributes: attrs({ app: "other" }), toJson: () => ({ name: "x" }) })).toBeNull();
  });

  test("ignores entities without a name payload", () => {
    expect(parseServiceEntity({ attributes: attrs(), toJson: () => ({}) })).toBeNull();
  });
});
