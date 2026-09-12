import { describe, expect, test } from "bun:test";
import {
  ACCESS_DURATIONS,
  buildManifest,
  DEMO_ACCESS_SECONDS,
  formatAccessDuration,
  formatPriceUsdc,
  formatRemaining,
  generateServiceId,
  manifestFromBytes,
  manifestToBytes,
  priceUsdcSchema,
  publishServiceInputSchema,
  slugify,
  sumUsdc,
  validateManifest,
} from "../src";

describe("manifest", () => {
  test("builds the reduced manifest from form drafts", () => {
    const manifest = buildManifest([
      { id: "1", name: "getQuote", inputs: [{ id: "a", name: "symbol", type: "string" }] },
      { id: "2", name: "", inputs: [] },
    ]);
    expect(manifest).toEqual({ v: 1, operations: { getQuote: { input: { symbol: "string" } } } });
  });

  test("rejects manifests without operations", () => {
    const result = validateManifest({ v: 1, operations: {} });
    expect(result.ok).toBe(false);
  });

  test("rejects invalid identifiers and types", () => {
    const result = validateManifest({ v: 1, operations: { "get quote": { input: { symbol: "date" } } } });
    expect(result.ok).toBe(false);
  });

  test("round-trips through bytes", () => {
    const manifest = { v: 1 as const, operations: { translate: { input: { text: "string" as const, count: "number" as const } } } };
    const back = manifestFromBytes(manifestToBytes(manifest));
    expect(back.ok && back.manifest).toEqual(manifest);
  });
});

describe("service id", () => {
  test("slugifies names", () => {
    expect(slugify("Market Data API!")).toBe("market-data-api");
    expect(slugify("  Città  ")).toBe("citta");
  });

  test("generates slug + short random suffix", () => {
    const id = generateServiceId("Market Data API");
    expect(id).toMatch(/^market-data-api-[0-9a-f]{4}$/);
    expect(generateServiceId("Market Data API")).not.toBe(id);
  });
});

describe("commercial terms", () => {
  test("supports the 30-second demo duration through publishing and display", () => {
    expect(ACCESS_DURATIONS.some((duration) => duration.seconds === DEMO_ACCESS_SECONDS)).toBe(true);
    expect(publishServiceInputSchema.shape.accessSeconds.parse(DEMO_ACCESS_SECONDS)).toBe(30);
    expect(formatAccessDuration(DEMO_ACCESS_SECONDS)).toBe("30 seconds");
  });

  test("formats price and duration", () => {
    expect(formatPriceUsdc("0.5")).toBe("0.50 USDC");
    expect(formatPriceUsdc("12")).toBe("12.00 USDC");
    expect(formatPriceUsdc("0.000001")).toBe("0.000001 USDC");
    expect(formatAccessDuration(604800)).toBe("7 days");
    expect(formatAccessDuration(2 * 86400)).toBe("2 days");
  });

  test("validates USDC decimals", () => {
    expect(priceUsdcSchema.safeParse("0.50").success).toBe(true);
    expect(priceUsdcSchema.safeParse("1.1234567").success).toBe(false);
    expect(priceUsdcSchema.safeParse("-1").success).toBe(false);
  });
});

describe("access helpers", () => {
  test("sums USDC exactly", () => {
    expect(sumUsdc(["0.50", "0.25", "1"])).toBe("1.75");
    expect(sumUsdc([])).toBe("0");
    expect(sumUsdc(["0.000001", "0.000001"])).toBe("0.000002");
  });
  test("formats remaining time", () => {
    expect(formatRemaining(0)).toBe("expired");
    expect(formatRemaining(-2)).toBe("expired");
    expect(formatRemaining(0.2)).toBe("1s");
    expect(formatRemaining(1)).toBe("1s");
    expect(formatRemaining(30)).toBe("30s");
    expect(formatRemaining(59)).toBe("59s");
    expect(formatRemaining(60)).toBe("1m");
    expect(formatRemaining(90000)).toBe("1d 1h");
    expect(formatRemaining(3660)).toBe("1h 1m");
  });
  test("manifest carries an optional endpoint", () => {
    const m = buildManifest([{ id: "1", name: "ping", inputs: [] }], "https://bot.example/api");
    expect(m.endpoint).toBe("https://bot.example/api");
    expect(buildManifest([{ id: "1", name: "ping", inputs: [] }]).endpoint).toBeUndefined();
  });
});
