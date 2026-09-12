import { z } from "zod";

/**
 * Wire-level primitives shared by every schema. One definition each, so the
 * adapters, the routes and the UI agree on what a hash, a reference or an
 * Arkiv string is.
 */

/** `0x` + 64 hex: transaction hashes, Arkiv entity keys, keccak digests, pass secrets. */
export const hex32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Expected 0x + 64 hex chars");
export const txHashSchema = hex32Schema.describe("transaction hash");
export const entityKeySchema = hex32Schema.describe("Arkiv entity key");

export const evmAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM address (0x + 40 hex)");

/** Plain Swarm reference: 64 hex chars. ENS `contenthash` (EIP-1577) can only carry this form. */
export const swarmReferenceSchema = z.string().regex(/^[0-9a-fA-F]{64}$/, "Invalid Swarm reference (64 hex chars)");

/** Swarm ACT reference (encrypted reference or history reference): 64 or 128 hex chars. */
export const actRefSchema = z.string().regex(/^[0-9a-fA-F]{64}(?:[0-9a-fA-F]{64})?$/, "Invalid Swarm ACT reference");

/** Compressed secp256k1 public key, 33 bytes, as used for ACT grantees. */
export const actPublicKeySchema = z.string().regex(/^(0x)?[0-9a-fA-F]{66}$/, "Invalid compressed public key");

/** Arkiv `str` attributes carry at most this many UTF-8 bytes; the engine rejects longer ones. */
export const ARKIV_STR_MAX_BYTES = 128;

const utf8 = new TextEncoder();

export function utf8ByteLength(value: string): number {
  return utf8.encode(value).byteLength;
}

/**
 * A string that fits an Arkiv `str` attribute. `maxChars` is the user-facing
 * limit; the byte check catches multi-byte text the chain would refuse after
 * the manifest is already on Swarm.
 */
export function arkivStringSchema(maxChars: number, message = `Max ${maxChars} characters`) {
  return z
    .string()
    .trim()
    .max(maxChars, message)
    .refine((v) => utf8ByteLength(v) <= ARKIV_STR_MAX_BYTES, { message: `Max ${ARKIV_STR_MAX_BYTES} bytes (accents and symbols count more)` });
}
