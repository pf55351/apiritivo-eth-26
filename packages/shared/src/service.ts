import { z } from "zod";
import { actPublicKeySchema, actRefSchema, arkivStringSchema, evmAddressSchema, swarmReferenceSchema } from "./primitives";

export { actPublicKeySchema, evmAddressSchema, swarmReferenceSchema } from "./primitives";

export const APP_ID = "apiritivo" as const;
export const SERVICE_ENTITY_TYPE = "service" as const;

/** Curated categories. Providers may also type a custom slug. */
export const SERVICE_CATEGORIES = [
  { slug: "market-data", label: "Market Data" },
  { slug: "ai-text", label: "AI / Text" },
  { slug: "ai-vision", label: "AI / Vision" },
  { slug: "weather", label: "Weather" },
  { slug: "geo", label: "Geo & Maps" },
  { slug: "identity", label: "Identity" },
  { slug: "payments", label: "Payments" },
  { slug: "storage", label: "Storage" },
  { slug: "messaging", label: "Messaging" },
  { slug: "analytics", label: "Analytics" },
  { slug: "utility", label: "Utility" },
] as const;

export function categoryLabel(slug: string): string {
  const found = SERVICE_CATEGORIES.find((c) => c.slug === slug);
  if (found) return found.label;
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

const slug = z
  .string()
  .min(2, "Min 2 characters")
  .max(48, "Max 48 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and dashes");

/** Access durations a provider can sell. Seconds are what is stored on Arkiv. */
export const DEMO_ACCESS_SECONDS = 30;

export const ACCESS_DURATIONS = [
  { seconds: DEMO_ACCESS_SECONDS, label: "30 seconds" },
  { seconds: 120, label: "2 minutes" },
  { seconds: 3600, label: "1 hour" },
  { seconds: 6 * 3600, label: "6 hours" },
  { seconds: 86400, label: "1 day" },
  { seconds: 7 * 86400, label: "7 days" },
  { seconds: 30 * 86400, label: "30 days" },
  { seconds: 365 * 86400, label: "1 year" },
] as const;

export function formatAccessDuration(seconds: number): string {
  const known = ACCESS_DURATIONS.find((d) => d.seconds === seconds);
  if (known) return known.label;
  if (seconds % 86400 === 0) return `${seconds / 86400} days`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hours`;
  if (seconds % 60 === 0) return `${seconds / 60} minutes`;
  return `${seconds} seconds`;
}

/** Price in USDC as a decimal string (exact, never a float). Up to 6 decimals like USDC itself. */
export const priceUsdcSchema = z
  .string()
  .trim()
  .regex(/^\d{1,9}(?:\.\d{1,6})?$/, "Use a number like 0.50 (max 6 decimals)");

export function formatPriceUsdc(price: string): string {
  const [int, frac = ""] = price.split(".");
  const cleanFrac = frac.replace(/0+$/, "");
  const shown = cleanFrac.length === 0 ? `${int}.00` : cleanFrac.length === 1 ? `${int}.${cleanFrac}0` : `${int}.${cleanFrac}`;
  return `${shown} USDC`;
}

/** Lowercase `.eth` name (a subname is fine). Resolution and ownership are checked by the server. */
export const ensNameSchema = arkivStringSchema(120, "Max 120 characters")
  .toLowerCase()
  .regex(/^(?=.{3,253}$)([a-z0-9-]+\.)+eth$/, "Use a .eth name like myapi.eth");

/**
 * Normalised service as read from Arkiv. This is OUR shape; vendor entity
 * objects never leave the arkiv adapter.
 */

/**
 * Optional private file of a service, stored on Swarm with ACT (Access Control
 * Trie): encrypted, readable only by the provider and the buyers it granted.
 * The references are public on Arkiv but useless without being a grantee.
 */
export const privateAttachmentSchema = z.object({
  name: arkivStringSchema(120).min(1),
  bytes: z
    .number()
    .int()
    .positive()
    .max(512 * 1024),
  contentType: arkivStringSchema(100).optional(),
  encryptedRef: actRefSchema,
  /** History reference at upload time (grants produce newer ones, see `grant` entities). */
  historyRef: actRefSchema,
  publisherPubKey: actPublicKeySchema,
});
export type PrivateAttachment = z.infer<typeof privateAttachmentSchema>;

export const arkivServiceSchema = z.object({
  serviceId: z.string(),
  category: z.string(),
  providerId: z.string(),
  providerName: z.string().optional(),
  available: z.boolean(),
  version: z.number().int(),
  manifestRef: z.string(),
  name: z.string(),
  description: z.string(),
  /** Price of one access pass, USDC decimal string. */
  priceUsdc: z.string().optional(),
  /** How long one purchased access lasts, in seconds. */
  accessSeconds: z.number().int().positive().optional(),
  /** EVM address that receives USDC payments (Avalanche Fuji). */
  payoutAddress: z.string().optional(),
  /** Arkiv entity key (proof link). */
  entityKey: z.string().optional(),
  /** Arkiv entity owner (the app writer address). */
  owner: z.string().optional(),
  /** Block the entity was created at. */
  createdAtBlock: z.string().optional(),
  /** Private file (Swarm ACT), if the provider attached one. */
  privateAttachment: privateAttachmentSchema.optional(),
  /** ENS name linked by the provider; its addr record resolved to `payoutAddress` at publish time. */
  ensName: z.string().optional(),
});

export type ArkivService = z.infer<typeof arkivServiceSchema>;

/** Body of POST /api/services. */
export const publishServiceInputSchema = z.object({
  serviceId: slug,
  category: slug,
  providerId: arkivStringSchema(128).min(1),
  providerName: arkivStringSchema(80).optional(),
  manifestRef: swarmReferenceSchema,
  name: z.string().trim().min(2, "Min 2 characters").max(80, "Max 80 characters"),
  description: z.string().trim().min(8, "Min 8 characters").max(400, "Max 400 characters"),
  priceUsdc: priceUsdcSchema,
  // Arkiv converts seconds to 2-second blocks and refuses odd values; catching it here keeps a
  // buyer from paying for a pass the writer can never mint.
  accessSeconds: z
    .number()
    .int()
    .positive("Pick an access duration")
    .multipleOf(2, "Access duration must be an even number of seconds")
    .max(10 * 365 * 86400),
  payoutAddress: evmAddressSchema,
  privateAttachment: privateAttachmentSchema.optional(),
  /** Optional ENS name owned by the provider (verified server-side: addr(name) == payoutAddress). */
  ensName: ensNameSchema.optional(),
});

export type PublishServiceInput = z.infer<typeof publishServiceInputSchema>;

export const publishServiceResultSchema = z.object({
  entityKey: z.string(),
  txHash: z.string(),
  serviceId: z.string(),
});

export type PublishServiceResult = z.infer<typeof publishServiceResultSchema>;

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

function randomSuffix(length = 4): string {
  const alphabet = "0123456789abcdef";
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => alphabet[b % 16]).join("");
}

/** Stable unique id: `market-data-a81f`. Never relies on name uniqueness. */
export function generateServiceId(name: string): string {
  const base = slugify(name) || "service";
  return `${base}-${randomSuffix(4)}`;
}
