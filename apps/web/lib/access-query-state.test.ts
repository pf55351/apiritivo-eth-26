import { describe, expect, test } from "bun:test";
import type { BlockTiming } from "@apiritivo/arkiv";
import { accessQueryState, emptyAccessQuery, newerBlockTiming } from "./access-query-state";

const timing: BlockTiming = { currentBlock: 100n, currentBlockTime: 200, blockDuration: 2 };
const data = [{ passKey: "pass-a" }];
const loaded = () => accessQueryState(emptyAccessQuery<typeof data>("buyer-a"), { type: "success", key: "buyer-a", data, timing });

describe("access query refresh", () => {
  test("keeps the loaded rows and clock while refreshing the same account", () => {
    const current = loaded();
    const refresh = accessQueryState(current, { type: "start", key: "buyer-a" });
    expect(refresh.loading).toBe(true);
    expect(refresh.data).toBe(current.data);
    expect(refresh.timing).toBe(current.timing);
    expect(current.loading).toBe(false);
  });

  test("a failed refresh retains the last successful snapshot and exposes the error", () => {
    const error = { message: "RPC unavailable" };
    const failed = accessQueryState(accessQueryState(loaded(), { type: "start", key: "buyer-a" }), { type: "failure", key: "buyer-a", error });
    expect(failed.data).toBe(data);
    expect(failed.timing).toBe(timing);
    expect(failed.loading).toBe(false);
    expect(failed.error).toBe(error);
    expect(accessQueryState(failed, { type: "start", key: "buyer-a" }).error).toBeNull();
  });

  test("a successful empty result replaces expired passes and remains a loaded snapshot", () => {
    const empty = accessQueryState(loaded(), { type: "success", key: "buyer-a", data: [], timing });
    expect(empty.data).toEqual([]);
    const refreshingEmpty = accessQueryState(empty, { type: "start", key: "buyer-a" });
    expect(refreshingEmpty.loading && refreshingEmpty.data === null).toBe(false);
  });

  test("switching account or signing out clears data and clock", () => {
    const other = accessQueryState(loaded(), { type: "start", key: "buyer-b" });
    expect(other).toEqual(emptyAccessQuery("buyer-b"));
    const signedOut = accessQueryState(loaded(), { type: "start", key: null });
    expect(signedOut).toEqual(emptyAccessQuery(null));
    expect(signedOut.loading).toBe(false);
  });

  test("ignores late responses for an earlier account", () => {
    const other = accessQueryState(loaded(), { type: "start", key: "buyer-b" });
    expect(accessQueryState(other, { type: "success", key: "buyer-a", data, timing })).toBe(other);
    expect(accessQueryState(other, { type: "failure", key: "buyer-a", error: { message: "old error" } })).toBe(other);
  });

  test("a missing or older clock response does not reset the countdown", () => {
    expect(accessQueryState(loaded(), { type: "success", key: "buyer-a", data, timing: null }).timing).toBe(timing);
    expect(newerBlockTiming(timing, { ...timing, currentBlock: 99n })).toBe(timing);
    const live = { ...timing, currentBlock: 114n };
    expect(newerBlockTiming(timing, live)).toBe(live);
    expect(newerBlockTiming(null, live)).toBe(live);
  });

  test("an initial request failure has no stale data to display", () => {
    const failed = accessQueryState(emptyAccessQuery("buyer-a"), { type: "failure", key: "buyer-a", error: { message: "RPC unavailable" } });
    expect(failed.loading).toBe(false);
    expect(failed.data).toBeNull();
    expect(failed.timing).toBeNull();
  });
});
