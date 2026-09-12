import { beforeEach, describe, expect, test } from "bun:test";
import { invalidateRequest, resetSharedRequests, sharedRequest } from "./shared-request";

describe("sharedRequest", () => {
  beforeEach(() => resetSharedRequests());

  test("callers inside the window share one in-flight request", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return calls;
    };
    const [a, b] = await Promise.all([sharedRequest("k", fn, 1000, 10), sharedRequest("k", fn, 1000, 20)]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(calls).toBe(1);
  });

  test("a value older than the ttl is fetched again, and invalidation forces it", async () => {
    let calls = 0;
    const fn = async () => ++calls;
    await sharedRequest("k", fn, 1000, 0);
    expect(await sharedRequest("k", fn, 1000, 2000)).toBe(2);
    invalidateRequest("k");
    expect(await sharedRequest("k", fn, 1000, 2001)).toBe(3);
  });

  test("invalidation by prefix clears every key under it", async () => {
    await sharedRequest("provider-stats:0xa", async () => 1);
    await sharedRequest("provider-stats:0xb", async () => 1);
    await sharedRequest("writer-status", async () => 1);
    invalidateRequest("provider-stats");
    let calls = 0;
    await sharedRequest("provider-stats:0xa", async () => ++calls);
    await sharedRequest("provider-stats:0xb", async () => ++calls);
    await sharedRequest("writer-status", async () => ++calls);
    expect(calls).toBe(2);
  });

  test("a failed request is not cached", async () => {
    let calls = 0;
    const failing = async () => {
      calls += 1;
      throw new Error("rpc down");
    };
    await expect(sharedRequest("k", failing)).rejects.toThrow("rpc down");
    await expect(sharedRequest("k", failing)).rejects.toThrow("rpc down");
    expect(calls).toBe(2);
  });
});
