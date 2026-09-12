import { describe, expect, test } from "bun:test";
import { formatTtl, hueFor, initials, shortRef } from "./format";

describe("formatTtl (Swarm drive time left)", () => {
  test("under an hour", () => expect(formatTtl(59 * 60)).toBe("under 1 hour"));
  test("hours", () => expect(formatTtl(5 * 3600 + 10)).toBe("5 h"));
  test("one day, singular", () => expect(formatTtl(86_400)).toBe("1 day"));
  test("days, floor", () => expect(formatTtl(4 * 86_400 + 3600)).toBe("4 days"));
});

describe("shortRef", () => {
  test("shortens long hex like the drive chip and sales list do", () => {
    expect(shortRef("0xbc1753099be0619c637f5c6af150c41332e80da7bc3f3b997304961ddd95df10")).toBe("0xbc17…df10");
  });
  test("leaves short values alone", () => expect(shortRef("abc")).toBe("abc"));
});

describe("initials", () => {
  test("two words take first letters, one word takes two letters", () => {
    expect(initials("Objective Euclid")).toBe("OE");
    expect(initials("Wallet")).toBe("WA");
    expect(initials("   ")).toBe("?");
    expect(initials("a b c")).toBe("AC");
  });
});

describe("hueFor", () => {
  test("is deterministic and within a colour wheel", () => {
    expect(hueFor("swarm-1")).toBe(hueFor("swarm-1"));
    for (const v of ["", "a", "provider-42"]) {
      const h = hueFor(v);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});
