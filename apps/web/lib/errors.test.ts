import { describe, expect, test } from "bun:test";
import { friendlyMessage, isUserFacingError, toFriendlyError } from "./errors";

class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletError";
  }
}

describe("toFriendlyError", () => {
  test("shows our own errors' messages and keeps the raw error as detail", () => {
    const err = new WalletError("Switch your wallet to Avalanche Fuji.");
    const f = toFriendlyError(err, "Purchase failed.");
    expect(f.message).toBe("Switch your wallet to Avalanche Fuji.");
    expect(f.detail).toContain("WalletError");
    expect(isUserFacingError(err)).toBe(true);
  });
  test("hides library and unknown errors behind the fallback", () => {
    expect(toFriendlyError(new TypeError("fetch failed"), "Could not load.").message).toBe("Could not load.");
    expect(toFriendlyError("boom", "Could not load.").message).toBe("Could not load.");
    expect(toFriendlyError({ code: 4001 }, "Could not load.").detail).toContain("4001");
  });
  test("includes the cause chain in the detail", () => {
    const err = new Error("outer", { cause: new Error("inner") });
    expect(toFriendlyError(err, "x").detail).toContain("Caused by");
    expect(friendlyMessage(err, "fallback")).toBe("fallback");
  });
});
