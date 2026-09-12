import { describe, expect, test } from "bun:test";
import { AVAX_LOW_BELOW, buildChecks, driveCheck, type ReadinessInput, stateLabel, summarize } from "./readiness";

const faucets = { avax: "https://avax", usdc: "https://usdc", glm: "https://glm" };

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    view: "client",
    wallet: { status: "ready", balances: { avax: "0.5", usdc: "10" } },
    writer: { funded: true, balance: "0.0988", faucetUrl: "https://hub" },
    drive: { mode: "subsidised", manageUrl: "https://swarm-id" },
    faucets,
    ...over,
  };
}

describe("client checks", () => {
  test("funded client is ready", () => {
    const checks = buildChecks(input());
    expect(checks.map((c) => c.id)).toEqual(["usdc", "avax", "glm"]);
    expect(checks.map((c) => c.state)).toEqual(["ok", "ok", "ok"]);
    expect(summarize(checks)).toEqual({ tone: "ok", label: "Ready", missing: 0, low: 0 });
  });

  test("usdc present, avax missing", () => {
    const checks = buildChecks(input({ wallet: { status: "ready", balances: { avax: "0", usdc: "10" } } }));
    expect(checks.find((c) => c.id === "usdc")).toMatchObject({ state: "ok", value: "10.00", href: faucets.usdc });
    expect(checks.find((c) => c.id === "avax")).toMatchObject({ state: "missing", value: "0.0000", href: faucets.avax });
    expect(summarize(checks)).toMatchObject({ tone: "block", label: "1 missing" });
  });

  test("dust avax is low, not missing", () => {
    const checks = buildChecks(input({ wallet: { status: "ready", balances: { avax: String(AVAX_LOW_BELOW / 2), usdc: "1" } } }));
    expect(checks.find((c) => c.id === "avax")?.state).toBe("low");
    expect(summarize(checks)).toMatchObject({ tone: "warn", label: "1 low" });
  });

  test("missing beats low in the summary", () => {
    const checks = buildChecks(input({ wallet: { status: "ready", balances: { avax: "0.001", usdc: "0" } } }));
    expect(summarize(checks)).toMatchObject({ tone: "block", label: "1 missing", low: 1 });
  });

  test("confirmed missing resources stay visible while another check loads", () => {
    const checks = buildChecks(input({ wallet: { status: "ready", balances: { avax: "0", usdc: "0" } }, writer: undefined }));
    expect(summarize(checks)).toMatchObject({ tone: "block", label: "2 missing", missing: 2 });
  });

  test("the missing count clears when resources are funded, even with a low balance warning", () => {
    const missing = input({ wallet: { status: "ready", balances: { avax: "0", usdc: "0" } } });
    expect(summarize(buildChecks(missing)).missing).toBe(2);
    expect(summarize(buildChecks(input({ wallet: { status: "ready", balances: { avax: "0.001", usdc: "1" } } })))).toMatchObject({ missing: 0, low: 1 });
    expect(summarize(buildChecks(input())).missing).toBe(0);
  });

  test("unfunded writer blocks the client too", () => {
    const checks = buildChecks(input({ writer: { funded: false, balance: "0", faucetUrl: "https://hub" } }));
    expect(checks.find((c) => c.id === "glm")).toMatchObject({ state: "missing", href: "https://hub", value: "0.000" });
  });

  test("writer unreachable is unknown, not missing", () => {
    expect(buildChecks(input({ writer: null })).find((c) => c.id === "glm")?.state).toBe("unknown");
    expect(buildChecks(input({ writer: { funded: undefined } })).find((c) => c.id === "glm")?.state).toBe("unknown");
    expect(summarize(buildChecks(input({ writer: null }))).tone).toBe("ok");
  });

  test("wallet still deriving reports checking", () => {
    const checks = buildChecks(input({ wallet: { status: "deriving", balances: null }, writer: undefined }));
    expect(checks.every((c) => c.state === "loading")).toBe(true);
    expect(summarize(checks)).toMatchObject({ tone: "loading", label: "Checking" });
  });

  test("wallet error reports unknown", () => {
    const checks = buildChecks(input({ wallet: { status: "error", balances: null } }));
    expect(checks.find((c) => c.id === "usdc")?.state).toBe("unknown");
  });
});

describe("provider checks", () => {
  test("provider order and usdc as information", () => {
    const checks = buildChecks(input({ view: "provider", wallet: { status: "ready", balances: { avax: "0", usdc: "0" } } }));
    expect(checks.map((c) => c.id)).toEqual(["drive", "glm", "avax", "usdc"]);
    expect(checks.find((c) => c.id === "usdc")).toMatchObject({ state: "info", href: undefined });
    expect(checks.find((c) => c.id === "avax")?.state).toBe("missing");
    expect(summarize(checks)).toMatchObject({ tone: "block", label: "1 missing" });
  });

  test("subsidised gateway counts as present", () => {
    expect(driveCheck(input({ view: "provider" }))).toMatchObject({ state: "ok", value: "shared gateway", href: undefined });
  });

  test("own drive expiring soon is low", () => {
    const check = driveCheck(input({ view: "provider", drive: { mode: "user-stamp", ttlSeconds: 4 * 86_400, label: "gift", usable: true, manageUrl: "https://swarm-id" } }));
    expect(check).toMatchObject({ state: "low", value: "gift · 4 days left", href: "https://swarm-id" });
  });

  test("healthy own drive is present", () => {
    const check = driveCheck(input({ view: "provider", drive: { mode: "user-stamp", ttlSeconds: 30 * 86_400, label: "", usable: true, manageUrl: "https://swarm-id" } }));
    expect(check).toMatchObject({ state: "ok", value: "own drive · 30 days left" });
  });

  test("no drive and no subsidy is missing", () => {
    const check = driveCheck(input({ view: "provider", drive: { mode: "unavailable", manageUrl: "https://swarm-id" } }));
    expect(check).toMatchObject({ state: "missing", value: "no drive", hrefLabel: "Swarm ID" });
  });

  test("unusable drive is missing", () => {
    const check = driveCheck(input({ view: "provider", drive: { mode: "user-stamp", usable: false, label: "gift", manageUrl: "https://swarm-id" } }));
    expect(check).toMatchObject({ state: "missing", value: "gift · not usable" });
  });
});

test("state labels are short words", () => {
  expect(["ok", "low", "missing", "info", "loading", "unknown"].map((s) => stateLabel(s as never))).toEqual(["present", "low", "missing", "balance", "checking", "unknown"]);
});

test("a writer key that does not match the trusted owner blocks, even when funded", () => {
  const checks = buildChecks(input({ writer: { funded: true, balance: "1", faucetUrl: "https://hub", ownerMismatch: true } }));
  const glm = checks.find((c) => c.id === "glm");
  expect(glm?.state).toBe("missing");
  expect(glm?.hint).toContain("trusted writer address");
});
