import { z } from "zod";
import { evmAddressSchema } from "./service";

export const ACCESS_PASS_ENTITY_TYPE = "access_pass" as const;
export const SALE_ENTITY_TYPE = "sale" as const;

const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash");
const entityKeySchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid Arkiv entity key");

/** An access pass as read from Arkiv. The entity key IS the API key. */
export const accessPassSchema = z.object({
  passKey: entityKeySchema,
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
  createdAtBlock: z.string().optional(),
});
export type Sale = z.infer<typeof saleSchema>;

/** Body of POST /api/access-passes. */
export const issueAccessPassInputSchema = z.object({
  serviceId: z.string().min(2).max(48),
  buyerId: z.string().min(1).max(128),
  buyerAddress: evmAddressSchema,
  txHash: txHashSchema,
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
    const micro = BigInt(int) * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
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
