import { describe, expect, test } from "bun:test";
import { ownsPass, shortAddress } from "./identity";

const ADDR = "0xAbCdEf0123456789aBcDeF0123456789ABCDef01" as const;

describe("shortAddress", () => {
  test("keeps the first and last characters", () => {
    expect(shortAddress(ADDR)).toBe("0xAbCd…ef01");
  });
});

describe("ownsPass", () => {
  test("matches the Swarm ID exactly", () => {
    expect(ownsPass({ buyerId: "swarm-1" }, "swarm-1")).toBe(true);
    expect(ownsPass({ buyerId: "SWARM-1" }, "swarm-1")).toBe(false);
  });

  test("someone else's pass, or nobody signed in", () => {
    expect(ownsPass({ buyerId: "swarm-2" }, "swarm-1")).toBe(false);
    expect(ownsPass({ buyerId: ADDR.toLowerCase() }, "swarm-1")).toBe(false);
    expect(ownsPass({ buyerId: "swarm-1" }, null)).toBe(false);
  });
});
