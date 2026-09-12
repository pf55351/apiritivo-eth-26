import { beforeEach, describe, expect, test } from "bun:test";
import { checkRateLimit, resetRateLimits } from "./rate-limit";

const rule = { limit: 3, windowMs: 1_000 };

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  test("allows `limit` calls in a window, then refuses with a retry hint", () => {
    const t0 = 1_000_000;
    expect(checkRateLimit("publish", "1.2.3.4", rule, t0).ok).toBe(true);
    expect(checkRateLimit("publish", "1.2.3.4", rule, t0 + 10).ok).toBe(true);
    expect(checkRateLimit("publish", "1.2.3.4", rule, t0 + 20).ok).toBe(true);
    const refused = checkRateLimit("publish", "1.2.3.4", rule, t0 + 30);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.retryAfterSeconds).toBe(1);
  });

  test("windows are per bucket and per key", () => {
    const t0 = 5_000;
    for (let i = 0; i < 3; i++) checkRateLimit("publish", "a", rule, t0);
    expect(checkRateLimit("publish", "a", rule, t0).ok).toBe(false);
    expect(checkRateLimit("publish", "b", rule, t0).ok).toBe(true);
    expect(checkRateLimit("mint", "a", rule, t0).ok).toBe(true);
  });

  test("a new window opens after windowMs", () => {
    const t0 = 9_000;
    for (let i = 0; i < 3; i++) checkRateLimit("grant", "a", rule, t0);
    expect(checkRateLimit("grant", "a", rule, t0 + 999).ok).toBe(false);
    expect(checkRateLimit("grant", "a", rule, t0 + 1_000).ok).toBe(true);
  });
});
