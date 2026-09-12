import { describe, expect, test } from "bun:test";
import { formatTtl, shortRef } from "./format";

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
