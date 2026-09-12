import { z } from "zod";
import { actPublicKeySchema, actRefSchema, arkivStringSchema, entityKeySchema, evmAddressSchema, hex32Schema, txHashSchema } from "./primitives";
import { priceUsdcSchema } from "./service";

export const ACCESS_PASS_ENTITY_TYPE = "access_pass" as const;
export const SALE_ENTITY_TYPE = "sale" as const;
/** Provider → buyer authorisation for a service's private file (Swarm ACT). */
export const GRANT_ENTITY_TYPE = "grant" as const;

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
  paidUsdc: priceUsdcSchema,
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
  /** The wallet that paid (`buyer_address`); older receipts may lack it. */
  buyerAddress: evmAddressSchema.optional(),
  txHash: z.string(),
  paidUsdc: priceUsdcSchema,
  chainId: z.number().int(),
  passKey: z.string().optional(),
  buyerPublicKey: z.string().optional(),
  createdAtBlock: z.string().optional(),
});
export type Sale = z.infer<typeof saleSchema>;

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
  providerId: arkivStringSchema(128).min(1),
  buyerId: arkivStringSchema(128).min(1),
  buyerPublicKey: actPublicKeySchema,
  historyRef: actRefSchema,
  encryptedRef: actRefSchema,
  publisherPubKey: actPublicKeySchema,
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
  /** The buying Swarm ID's sharing key: the only key the provider may grant private files to. */
  buyerPublicKey: actPublicKeySchema,
  /** `personal_sign` by `buyerAddress` of the pass claim for `txHash` + `secretHash` (see `passClaimMessage`). */
  buyerSignature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "Expected a 65-byte signature"),
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
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
