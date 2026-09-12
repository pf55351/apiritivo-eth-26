import { describe, expect, test } from "bun:test";
import { normalizeEnsName, recordsForService, swarmContenthash, swarmRefFromContenthash, verifyServiceRecords } from "../src/index";

const REF = "d1de9994b4d039f6548d191eb26786769f580809256b4685ef316805265ea162";

describe("swarm contenthash (EIP-1577)", () => {
  test("encodes the spec example", () => {
    expect(swarmContenthash(REF)).toBe(`0xe40101fa011b20${REF}`);
  });
  test("round trips", () => {
    expect(swarmRefFromContenthash(swarmContenthash(REF))).toBe(REF);
  });
  test("rejects ipfs and empty", () => {
    expect(swarmRefFromContenthash("0xe3010170122029f2d17be6139079dc48696d1f582a8530eb9805b561eda517e22a892c7e3f1f")).toBeNull();
    expect(swarmRefFromContenthash("0x")).toBeNull();
    expect(swarmRefFromContenthash(null)).toBeNull();
  });
  test("refuses short references", () => {
    expect(() => swarmContenthash("abc")).toThrow();
  });
});

describe("normalizeEnsName", () => {
  test("lowercases and accepts subnames", () => {
    expect(normalizeEnsName("  Prova-API.APIritivo.eth ")).toBe("prova-api.apiritivo.eth");
  });
  test("rejects non .eth and garbage", () => {
    expect(normalizeEnsName("apiritivo.com")).toBeNull();
    expect(normalizeEnsName("eth")).toBeNull();
    expect(normalizeEnsName("")).toBeNull();
    expect(normalizeEnsName("a b.eth")).toBeNull();
  });
});

describe("verifyServiceRecords", () => {
  const service = { serviceId: "prova-api-65ee", manifestRef: REF, payoutAddress: "0xE20a31dc98d98c982B4d5760bc1595a9e53F21f8" };
  test("complete when all three match", () => {
    const v = verifyServiceRecords(
      { name: "x.eth", address: "0xe20a31dc98d98c982b4d5760bc1595a9e53f21f8", serviceId: "prova-api-65ee", manifestRef: REF, contenthash: swarmContenthash(REF) },
      service,
    );
    expect(v).toEqual({ addressOk: true, serviceOk: true, manifestOk: true, complete: true });
  });
  test("address only", () => {
    const v = verifyServiceRecords({ name: "x.eth", address: service.payoutAddress as `0x${string}`, serviceId: null, manifestRef: null, contenthash: null }, service);
    expect(v.addressOk).toBe(true);
    expect(v.complete).toBe(false);
  });
  test("records recipe lists the three records", () => {
    const r = recordsForService(service);
    expect(r.map((x) => x.kind)).toEqual(["addr", "text", "contenthash"]);
    expect(r[2].value).toBe(`bzz://${REF}`);
  });
});
