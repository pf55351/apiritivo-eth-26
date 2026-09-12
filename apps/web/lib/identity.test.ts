import { describe, expect, test } from "bun:test";
import { passOwner, shortAddress, walletIdentity } from "./identity";

const ADDR = "0xAbCdEf0123456789aBcDeF0123456789ABCDef01" as const;

describe("walletIdentity", () => {
  test("id is the lowercase address, name is short", () => {
    const id = walletIdentity(ADDR);
    expect(id.kind).toBe("wallet");
    expect(id.id).toBe(ADDR.toLowerCase());
    expect(id.name).toBe("0xAbCd…ef01");
    expect(shortAddress(ADDR)).toBe(id.name);
  });
});

describe("passOwner", () => {
  test("wallet pass matches regardless of casing", () => {
    expect(passOwner({ buyerId: ADDR.toLowerCase() }, ADDR, "swarm-1")).toBe("wallet");
    expect(passOwner({ buyerId: ADDR }, ADDR.toLowerCase(), null)).toBe("wallet");
  });

  test("swarm pass matches the identity id exactly", () => {
    expect(passOwner({ buyerId: "swarm-1" }, ADDR, "swarm-1")).toBe("swarm");
    expect(passOwner({ buyerId: "SWARM-1" }, ADDR, "swarm-1")).toBeNull();
  });

  test("someone else's pass", () => {
    expect(passOwner({ buyerId: "0x0000000000000000000000000000000000000001" }, ADDR, "swarm-1")).toBeNull();
    expect(passOwner({ buyerId: "swarm-2" }, null, null)).toBeNull();
  });
});
