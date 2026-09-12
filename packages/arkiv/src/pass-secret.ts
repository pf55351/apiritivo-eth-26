/**
 * Access-pass secret: proof of ownership for a pass.
 *
 * The Arkiv entity key of a pass is public (anyone can list passes in the
 * explorer), so it cannot be the API key on its own. At purchase the buyer's
 * browser generates a random 32-byte secret `S`:
 *   - the entity stores `secret_hash = keccak256(S)` as a plain attribute, and
 *     `S` encrypted (AES-256-GCM) in the payload, under a key derived from the
 *     buyer's Swarm ID (`deriveAppSecret`), so the buyer recovers `S` on any device;
 *   - the API key is `<passKey>.<S>`; the server hashes `S` and compares.
 * Browser-safe: WebCrypto + viem keccak, no vendor SDK.
 */
import { bytesToHex, type Hex, hexToBytes, keccak256 } from "viem";

export const PASS_SECRET_BYTES = 32;
const IV_BYTES = 12;
const ENC_VERSION = 1;

const hex32 = /^0x[0-9a-fA-F]{64}$/;

export function isPassSecret(value: string): value is Hex {
  return hex32.test(value);
}

/** Random 32-byte secret, hex. Generated in the buyer's browser. */
export function generatePassSecret(): Hex {
  const bytes = new Uint8Array(PASS_SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/** What goes on-chain in clear: keccak256 of the secret. */
export function hashPassSecret(secret: Hex): Hex {
  return keccak256(hexToBytes(secret));
}

async function aesKey(keyBytes: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  if (keyBytes.byteLength !== 32) throw new Error("Pass encryption key must be 32 bytes.");
  return crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "AES-GCM" }, false, [usage]);
}

/** `iv(12) || ciphertext || tag(16)`, prefixed with a version byte, hex. */
export async function encryptPassSecret(secret: Hex, keyBytes: Uint8Array): Promise<string> {
  const key = await aesKey(keyBytes, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, hexToBytes(secret) as BufferSource));
  const out = new Uint8Array(1 + IV_BYTES + ct.byteLength);
  out[0] = ENC_VERSION;
  out.set(iv, 1);
  out.set(ct, 1 + IV_BYTES);
  return bytesToHex(out);
}

/** Inverse of `encryptPassSecret`. Throws on a wrong key or a tampered blob. */
export async function decryptPassSecret(blob: string, keyBytes: Uint8Array): Promise<Hex> {
  const bytes = hexToBytes(blob as Hex);
  if (bytes[0] !== ENC_VERSION || bytes.byteLength < 1 + IV_BYTES + 16) throw new Error("Unsupported pass secret envelope.");
  const key = await aesKey(keyBytes, "decrypt");
  const iv = bytes.slice(1, 1 + IV_BYTES);
  const ct = bytes.slice(1 + IV_BYTES);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct as BufferSource));
  const secret = bytesToHex(plain);
  if (!isPassSecret(secret)) throw new Error("Decrypted pass secret has the wrong length.");
  return secret;
}

/** API key as presented to services: `<passKey>.<secret>`. */
export function formatPassBearer(passKey: string, secret: Hex): string {
  return `${passKey}.${secret}`;
}

/** Parse `Authorization: Bearer <passKey>.<secret>` (or the bare token). */
export function parsePassBearer(header: string | null | undefined): { passKey: Hex; secret: Hex } | { passKey: Hex; secret: null } | null {
  const token = (header ?? "").replace(/^Bearer\s+/i, "").trim();
  const [passKey, secret, ...rest] = token.split(".");
  if (!passKey || !hex32.test(passKey) || rest.length > 0) return null;
  if (secret === undefined) return { passKey: passKey as Hex, secret: null };
  if (!hex32.test(secret)) return null;
  return { passKey: passKey as Hex, secret: secret as Hex };
}

/** Pure ownership check used by `verifyAccessPass`. */
export function checkPassSecret(pass: { secretHash?: string }, secret: Hex | null): { ok: true } | { ok: false; status: 401 | 403; error: string } {
  if (!pass.secretHash) return { ok: false, status: 403, error: "This pass was minted without a secret and cannot be used. Buy access again." };
  if (!secret) return { ok: false, status: 401, error: "Missing pass secret. Send `Authorization: Bearer <passKey>.<secret>`." };
  if (hashPassSecret(secret).toLowerCase() !== pass.secretHash.toLowerCase()) return { ok: false, status: 403, error: "Pass secret does not match this pass." };
  return { ok: true };
}
