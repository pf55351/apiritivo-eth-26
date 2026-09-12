import { z } from "zod";
import { evmAddressSchema } from "./service";

export const ACCESS_PASS_ENTITY_TYPE = "access_pass" as const;
export const SALE_ENTITY_TYPE = "sale" as const;
/** Provider → buyer authorisation for a service's private file (Swarm ACT). */
export const GRANT_ENTITY_TYPE = "grant" as const;

const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash");
const entityKeySchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid Arkiv entity key");

const hex32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Expected 0x + 64 hex chars");

/**
 * An access pass as read from Arkiv. The API key is `<passKey>.<secret>`:
 * the entity stores keccak256(secret) in clear and the secret encrypted for
 * the buyer in the payload (see packages/arkiv pass-secret.ts).
 */
export const accessPassSchema = z.object({
  passKey: entityKeySchema,
  /** keccak256 of the pass secret (attribute `secret_hash`). Absent on legacy passes. */
  secretHash: hex32Schema.optional(),
  /** Secret encrypted for the buyer (payload). Absent on legacy passes. */
  encryptedSecret: z.string().optional(),
  /** Buyer's Swarm sharing public key (attribute `buyer_pubkey`): what the provider grants ACT access to. */
  buyerPublicKey: z.string().optional(),
  serviceId: z.string(),
  buyerId: z.string(),
  providerId: z.string(),
  txHash: z.string(),
  paidUsdc: z.string(),
  chainId: z.number().int(),
  /** Arkiv block at which the pass expires. */
  expiresAtBlock: z.string(),
  createdAtBlock: z.string().optional(),
  serviceName: z.string().optional(),
});
export type AccessPass = z.infer<typeof accessPassSchema>;

/** Permanent receipt of a purchase, used for provider revenue. */
export const saleSchema = z.object({
  saleKey: entityKeySchema,
  serviceId: z.string(),
  providerId: z.string(),
  buyerId: z.string(),
  txHash: z.string(),
  paidUsdc: z.string(),
  chainId: z.number().int(),
  passKey: z.string().optional(),
  buyerPublicKey: z.string().optional(),
  createdAtBlock: z.string().optional(),
});
export type Sale = z.infer<typeof saleSchema>;

const actKeySchema = z.string().regex(/^(0x)?[0-9a-fA-F]{66}$/, "Invalid compressed public key");
const actRefSchema = z.string().regex(/^[0-9a-fA-F]{64}([0-9a-fA-F]{64})?$/, "Invalid Swarm ACT reference");

/**
 * A grant: the provider added a buyer's public key to the ACT of the service's
 * private file. Carries the references valid after that grant (ACT is
 * immutable, so every grant produces a new history reference).
 */
export const grantSchema = z.object({
  grantKey: entityKeySchema,
  serviceId: z.string(),
  providerId: z.string(),
  buyerId: z.string(),
  buyerPublicKey: z.string(),
  historyRef: z.string(),
  encryptedRef: z.string(),
  publisherPubKey: z.string(),
  createdAtBlock: z.string().optional(),
});
export type Grant = z.infer<typeof grantSchema>;

/** Body of POST /api/grants. `providerId` is the caller's Swarm ID (trusted like elsewhere). */
export const publishGrantInputSchema = z.object({
  serviceId: z.string().min(2).max(48),
  providerId: z.string().min(1).max(128),
  buyerId: z.string().min(1).max(128),
  buyerPublicKey: actKeySchema,
  historyRef: actRefSchema,
  encryptedRef: actRefSchema,
  publisherPubKey: actKeySchema,
});
export type PublishGrantInput = z.infer<typeof publishGrantInputSchema>;
export type PublishGrantResult = { grantKey: string; txHash: string };

/** Body of POST /api/access-passes. */
export const issueAccessPassInputSchema = z.object({
  serviceId: z.string().min(2).max(48),
  buyerId: z.string().min(1).max(128),
  buyerAddress: evmAddressSchema,
  txHash: txHashSchema,
  /** keccak256 of the secret the buyer generated; stored in clear on the pass. */
  secretHash: hex32Schema,
  /** The secret encrypted with a key only the buyer can derive; stored in the pass payload. */
  encryptedSecret: z
    .string()
    .regex(/^0x[0-9a-fA-F]+$/)
    .max(512),
  /** Buyer's Swarm public key, so the provider can grant private files (optional). */
  buyerPublicKey: actKeySchema.optional(),
});
export type IssueAccessPassInput = z.infer<typeof issueAccessPassInputSchema>;

export const issueAccessPassResultSchema = z.object({
  passKey: entityKeySchema,
  saleKey: entityKeySchema,
  txHash: txHashSchema,
  paidUsdc: z.string(),
  expiresAtBlock: z.string(),
  /** Estimated wall-clock expiry (ISO). */
  expiresAt: z.string(),
  arkivTxHashes: z.array(z.string()),
});
export type IssueAccessPassResult = z.infer<typeof issueAccessPassResultSchema>;

/** Body of POST /api/bot/[serviceId]. */
export const botRequestSchema = z.object({
  operation: z.string().min(1).max(64),
  input: z.record(z.string(), z.unknown()).default({}),
});
export type BotRequest = z.infer<typeof botRequestSchema>;

export type BotVerification = {
  passKey: string;
  serviceId: string;
  expiresAtBlock: string;
  currentBlock: string;
  secondsRemaining: number;
};

/** Exact sum of USDC decimal strings (6 decimals) without floats. */
export function sumUsdc(values: readonly string[]): string {
  let total = 0n;
  for (const v of values) {
    const [int = "0", frac = ""] = v.trim().split(".");
    const micro = BigInt(int) * 1_000_000n + BigInt(`${frac}000000`.slice(0, 6));
    total += micro;
  }
  const int = total / 1_000_000n;
  const frac = (total % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${int}.${frac}` : `${int}`;
}

/** Human "expires in" from seconds. */
export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "expired";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
