import { z } from 'zod';
import { encodeAbiParameters, keccak256, stringToHex, type Hex } from 'viem';

export const APP = 'apiperitivo' as const;
export const FUJI_CHAIN_ID = 43113;
export const ARKIV_CHAIN_ID = 7738577;
export const FUJI_USDC = '0x5425890298aed601595a70AB815c96711a31Bc65' as const;
export const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(v => v.toLowerCase() as Hex);
export const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).refine(v => !/^0x0{40}$/.test(v), 'Zero address').transform(v => v.toLowerCase() as `0x${string}`);
export const nonzero32 = hex32.refine(v => !/^0x0{64}$/.test(v), 'Zero identifier');
export const atomic = z.string().regex(/^[1-9][0-9]*$/).refine(v => BigInt(v) < 2n ** 256n);
export const duration = z.number().int().min(2).max(30 * 86400).multipleOf(2);
export const operationId = z.enum(['text.analyze', 'json.transform']);
export const limitsSchema = z.strictObject({
  requestsPerMinute: z.number().int().min(1).max(600),
  concurrency: z.number().int().min(1).max(20),
  bodyBytes: z.number().int().min(256).max(131072),
  timeoutMs: z.number().int().min(100).max(30000),
});
export const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1), app: z.literal(APP),
  serviceId: nonzero32, planId: nonzero32,
  name: z.string().min(1).max(100), version: z.string().min(1).max(30),
  description: z.string().min(1).max(2000), category: z.enum(['text', 'data', 'utilities']),
  provider: address, treasury: address, chainId: z.literal(FUJI_CHAIN_ID), token: z.literal(FUJI_USDC),
  priceAtomic: atomic, durationSeconds: duration, feeBps: z.number().int().min(0).max(10000),
  operations: z.array(operationId).min(1).max(2).refine(v => new Set(v).size === v.length),
  limits: limitsSchema, terms: z.string().min(1).max(4000),
});
export type Manifest = z.infer<typeof manifestSchema>;
export const signedManifestSchema = z.strictObject({
  manifest: manifestSchema, signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});
export type SignedManifest = z.infer<typeof signedManifestSchema>;
export const listingSchema = z.strictObject({
  schemaVersion: z.literal(1), app: z.literal(APP), type: z.literal('service'),
  planId: nonzero32, serviceId: nonzero32, manifestRef: nonzero32,
  name: z.string().min(1).max(100), category: manifestSchema.shape.category,
  provider: address, priceAtomic: atomic, durationSeconds: duration,
  chainId: z.literal(FUJI_CHAIN_ID), token: z.literal(FUJI_USDC),
});
export type Listing = z.infer<typeof listingSchema>;
export const entitlementSchema = z.strictObject({
  schemaVersion: z.literal(1), app: z.literal(APP), type: z.literal('entitlement'),
  purchaseId: nonzero32, purchaseIntentId: nonzero32, subject: nonzero32,
  planId: nonzero32, serviceId: nonzero32, manifestRef: nonzero32,
  payer: address, paymentTx: nonzero32, paymentBlock: z.string().regex(/^\d+$/),
  market: address, chainId: z.literal(FUJI_CHAIN_ID), durationSeconds: duration,
});
export type Entitlement = z.infer<typeof entitlementSchema>;
export type Plan = Pick<Manifest, 'serviceId' | 'provider' | 'treasury' | 'priceAtomic' | 'durationSeconds' | 'feeBps'> & { manifestRef: Hex; active: boolean };
export type Intent = { id: Hex; subject: Hex; payer: Hex; planId: Hex; manifestRef: Hex; createdAt: number };
export type Payment = { purchaseId: Hex; txHash: Hex; blockNumber: string; blockHash: Hex };
export type Activation = { entityKey: Hex; txHash: Hex; createdAtBlock: string; expiresAtBlock: string };
export type SignedTransaction = { raw: Hex; hash: Hex };
export type Purchase = {
  intent: Intent; payment: Payment; manifest: Manifest; entitlement: Entitlement;
  status: 'paid' | 'submitting' | 'active' | 'manual_review';
  signedTransaction?: SignedTransaction; activation?: Activation;
  attempts: number; retryAt: number; lastError?: string;
};
// Canonical JSON for this schema: integer numbers, strings, booleans, arrays, objects.
// Versioned signing domains prevent a receipt being reused as a manifest or login proof.
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('Non-JSON value');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
}
export const manifestMessage = (m: Manifest) => `APIperitivo manifest v1\n${canonical(m)}`;
// Separate from the public manifest: a copied manifest signature cannot claim a publisher session.
export const publicationMessage = (subject: Hex, m: Manifest) => `APIperitivo publication authorization v1\n${subject}\n${keccak256(stringToHex(canonical(m)))}`;
export const receiptMessage = (r: unknown) => `APIperitivo receipt v1\n${canonical(r)}`;
export const namedId = (name: string): Hex => keccak256(stringToHex(`${APP}:${name}`));
export function purchaseId(chainId: number, market: Hex, payer: Hex, intent: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'bytes32' }], [BigInt(chainId), market, payer, intent]));
}
export function listingFromManifest(manifest: Manifest, manifestRef: Hex): Listing {
  return listingSchema.parse({ ...Object.fromEntries(['planId', 'serviceId', 'name', 'category', 'provider', 'priceAtomic', 'durationSeconds', 'chainId', 'token'].map(k => [k, manifest[k as keyof Manifest]])), schemaVersion: 1, app: APP, type: 'service', manifestRef });
}
export class AppError extends Error {
  constructor(public code: string, public status: number, message = code) { super(message); }
}
