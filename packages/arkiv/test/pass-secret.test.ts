import { describe, expect, test } from "bun:test";
import { checkPassSecret, decryptPassSecret, encryptPassSecret, formatPassBearer, generatePassSecret, hashPassSecret, isPassSecret, parsePassBearer } from "../src/pass-secret";

const key = new Uint8Array(32).fill(7);
const otherKey = new Uint8Array(32).fill(8);
const passKey = `0x${"ab".repeat(32)}` as const;

describe("pass secret · generation and hash", () => {
  test("secrets are 32 random bytes, different every time", () => {
    const a = generatePassSecret();
    const b = generatePassSecret();
    expect(isPassSecret(a)).toBe(true);
    expect(a).not.toBe(b);
  });
  test("hash is keccak256 of the bytes and deterministic", () => {
    const s = `0x${"00".repeat(31)}01` as const;
    expect(hashPassSecret(s)).toBe(hashPassSecret(s));
    expect(hashPassSecret(s)).not.toBe(s);
    expect(isPassSecret(hashPassSecret(s))).toBe(true);
  });
});

describe("pass secret · encryption for the buyer", () => {
  test("round-trips with the buyer's key", async () => {
    const s = generatePassSecret();
    const blob = await encryptPassSecret(s, key);
    expect(blob).toMatch(/^0x01[0-9a-f]+$/);
    expect(blob).not.toContain(s.slice(2));
    expect(await decryptPassSecret(blob, key)).toBe(s);
  });
  test("two encryptions of the same secret differ (random IV)", async () => {
    const s = generatePassSecret();
    expect(await encryptPassSecret(s, key)).not.toBe(await encryptPassSecret(s, key));
  });
  test("wrong key or tampered blob fails, never returns garbage", async () => {
    const blob = await encryptPassSecret(generatePassSecret(), key);
    await expect(decryptPassSecret(blob, otherKey)).rejects.toThrow();
    const tampered = blob.slice(0, -2) + (blob.endsWith("00") ? "01" : "00");
    await expect(decryptPassSecret(tampered, key)).rejects.toThrow();
    await expect(decryptPassSecret(`0x02${blob.slice(4)}`, key)).rejects.toThrow("Unsupported");
  });
  test("refuses keys that are not 32 bytes", async () => {
    await expect(encryptPassSecret(generatePassSecret(), new Uint8Array(16))).rejects.toThrow("32 bytes");
  });
});

describe("pass secret · bearer format", () => {
  const secret = generatePassSecret();
  test("formats and parses `<passKey>.<secret>`", () => {
    const token = formatPassBearer(passKey, secret);
    expect(parsePassBearer(`Bearer ${token}`)).toEqual({ passKey, secret });
    expect(parsePassBearer(token)).toEqual({ passKey, secret });
  });
  test("a bare pass key parses with no secret (so the server can say what is missing)", () => {
    expect(parsePassBearer(`Bearer ${passKey}`)).toEqual({ passKey, secret: null });
  });
  test("rejects malformed tokens", () => {
    expect(parsePassBearer(null)).toBeNull();
    expect(parsePassBearer("Bearer nope")).toBeNull();
    expect(parsePassBearer(`Bearer ${passKey}.abc`)).toBeNull();
    expect(parsePassBearer(`Bearer ${passKey}.${secret}.${secret}`)).toBeNull();
  });
});

describe("pass secret · ownership check (what the server does)", () => {
  const secret = generatePassSecret();
  const pass = { secretHash: hashPassSecret(secret) };
  test("accepts the right secret, case-insensitive on the stored hash", () => {
    expect(checkPassSecret(pass, secret)).toEqual({ ok: true });
    expect(checkPassSecret({ secretHash: pass.secretHash.toUpperCase().replace("0X", "0x") }, secret)).toEqual({ ok: true });
  });
  test("a copied entity key without the secret is 401", () => {
    expect(checkPassSecret(pass, null)).toMatchObject({ ok: false, status: 401 });
  });
  test("a wrong secret is 403", () => {
    expect(checkPassSecret(pass, generatePassSecret())).toMatchObject({ ok: false, status: 403 });
  });
  test("legacy passes without a hash are refused", () => {
    expect(checkPassSecret({}, secret)).toMatchObject({ ok: false, status: 403 });
  });
});
