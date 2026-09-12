import {
  ACCESS_PASS_ENTITY_TYPE,
  type AccessPass,
  APP_ID,
  type ArkivService,
  accessPassSchema,
  arkivServiceSchema,
  GRANT_ENTITY_TYPE,
  type Grant,
  grantSchema,
  SALE_ENTITY_TYPE,
  type Sale,
  SERVICE_ENTITY_TYPE,
  saleSchema,
} from "@apiritivo/shared";
import { trustedWriterAddress } from "./config";

/**
 * On-chain attribute names. snake_case because the Arkiv engine only accepts
 * lowercase letters, digits, ".", "-" and "_" in attribute names.
 */
export const ATTR = {
  app: "app",
  entityType: "entity_type",
  serviceId: "service_id",
  category: "category",
  providerId: "provider_id",
  providerName: "provider_name",
  available: "available",
  version: "version",
  manifestRef: "manifest_ref",
  priceUsdc: "price_usdc",
  accessSeconds: "access_seconds",
  payoutAddress: "payout_address",
  /** ENS name linked to the service (verified against payout_address at publish). */
  ensName: "ens_name",
  // access passes + sales
  buyerId: "buyer_id",
  buyerAddress: "buyer_address",
  txHash: "tx_hash",
  paidUsdc: "paid_usdc",
  chainId: "chain_id",
  passKey: "pass_key",
  /** keccak256(secret) of an access pass: proof of ownership, see pass-secret.ts. */
  secretHash: "secret_hash",
  /** Buyer's compressed public key (ACT grantee). On passes and sales. */
  buyerPublicKey: "buyer_pubkey",
  // private file of a service (Swarm ACT)
  privateName: "private_name",
  privateBytes: "private_bytes",
  privateType: "private_type",
  privateEncRef: "private_enc_ref",
  privateHistoryRef: "private_history_ref",
  privatePubkey: "private_pubkey",
  // grant entities
  actHistoryRef: "act_history_ref",
  actEncRef: "act_enc_ref",
  actPubkey: "act_pubkey",
} as const;

/**
 * Minimal structural view of an Arkiv entity as returned by `select()`.
 * We only depend on these fields so the SDK's entity class never leaks out.
 */
export type RawServiceEntity = {
  key?: `0x${string}` | undefined;
  owner?: `0x${string}` | undefined;
  createdAt?: bigint | undefined;
  expiresAt?: bigint | undefined;
  attributes?: Readonly<Record<string, { readonly type: string; readonly value: unknown }>> | undefined;
  toJson?: () => unknown;
};

/**
 * Only entities written by the app-owned writer are APIritivo entities. Anyone
 * can put `app = apiritivo` on a public chain; the owner is what the writer key
 * proves. Every parser applies this before looking at attributes.
 */
export function isTrustedEntity(entity: RawServiceEntity): boolean {
  return typeof entity.owner === "string" && entity.owner.toLowerCase() === trustedWriterAddress().toLowerCase();
}

function attrString(entity: RawServiceEntity, name: string): string | undefined {
  const v = entity.attributes?.[name]?.value;
  return typeof v === "string" ? v : undefined;
}

function attrBool(entity: RawServiceEntity, name: string): boolean | undefined {
  const v = entity.attributes?.[name]?.value;
  return typeof v === "boolean" ? v : undefined;
}

function attrNumber(entity: RawServiceEntity, name: string): number | undefined {
  const v = entity.attributes?.[name]?.value;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  return undefined;
}

/**
 * Convert a raw Arkiv entity into our `ArkivService`. Returns `null` for
 * entities that are not valid APIritivo services (defensive: anyone can
 * write attributes to a public chain).
 */
export function parseServiceEntity(entity: RawServiceEntity): ArkivService | null {
  if (!isTrustedEntity(entity)) return null;
  if (attrString(entity, ATTR.app) !== APP_ID) return null;
  if (attrString(entity, ATTR.entityType) !== SERVICE_ENTITY_TYPE) return null;

  let payload: unknown = {};
  try {
    payload = entity.toJson ? entity.toJson() : {};
  } catch {
    payload = {};
  }
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;

  const candidate = {
    serviceId: attrString(entity, ATTR.serviceId),
    // No defaults for the fields that decide whether a listing is sold: a half-written entity is dropped.
    category: attrString(entity, ATTR.category),
    providerId: attrString(entity, ATTR.providerId),
    providerName: attrString(entity, ATTR.providerName),
    available: attrBool(entity, ATTR.available),
    version: attrNumber(entity, ATTR.version) ?? 1,
    manifestRef: attrString(entity, ATTR.manifestRef),
    priceUsdc: attrString(entity, ATTR.priceUsdc),
    accessSeconds: attrNumber(entity, ATTR.accessSeconds),
    payoutAddress: attrString(entity, ATTR.payoutAddress),
    ensName: attrString(entity, ATTR.ensName) || undefined,
    name: typeof p.name === "string" ? p.name : undefined,
    description: typeof p.description === "string" ? p.description : "",
    entityKey: entity.key,
    owner: entity.owner,
    createdAtBlock: entity.createdAt !== undefined ? entity.createdAt.toString() : undefined,
    privateAttachment: attrString(entity, ATTR.privateEncRef)
      ? {
          name: attrString(entity, ATTR.privateName) ?? "private file",
          bytes: attrNumber(entity, ATTR.privateBytes),
          contentType: attrString(entity, ATTR.privateType),
          encryptedRef: attrString(entity, ATTR.privateEncRef),
          historyRef: attrString(entity, ATTR.privateHistoryRef),
          publisherPubKey: attrString(entity, ATTR.privatePubkey),
        }
      : undefined,
  };

  const parsed = arkivServiceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parseAccessPassEntity(entity: RawServiceEntity): AccessPass | null {
  if (!isTrustedEntity(entity)) return null;
  if (attrString(entity, ATTR.app) !== APP_ID) return null;
  if (attrString(entity, ATTR.entityType) !== ACCESS_PASS_ENTITY_TYPE) return null;
  let payload: Record<string, unknown> = {};
  try {
    const p = entity.toJson ? entity.toJson() : {};
    if (p && typeof p === "object") payload = p as Record<string, unknown>;
  } catch {
    /* empty payload */
  }
  const parsed = accessPassSchema.safeParse({
    passKey: entity.key,
    serviceId: attrString(entity, ATTR.serviceId),
    buyerId: attrString(entity, ATTR.buyerId),
    providerId: attrString(entity, ATTR.providerId),
    txHash: attrString(entity, ATTR.txHash),
    paidUsdc: attrString(entity, ATTR.paidUsdc),
    chainId: attrNumber(entity, ATTR.chainId),
    expiresAtBlock: entity.expiresAt !== undefined ? entity.expiresAt.toString() : undefined,
    createdAtBlock: entity.createdAt !== undefined ? entity.createdAt.toString() : undefined,
    serviceName: typeof payload.serviceName === "string" ? payload.serviceName : undefined,
    secretHash: attrString(entity, ATTR.secretHash),
    encryptedSecret: typeof payload.encryptedSecret === "string" ? payload.encryptedSecret : undefined,
    buyerPublicKey: attrString(entity, ATTR.buyerPublicKey),
  });
  return parsed.success ? parsed.data : null;
}

export function parseGrantEntity(entity: RawServiceEntity): Grant | null {
  if (!isTrustedEntity(entity)) return null;
  if (attrString(entity, ATTR.app) !== APP_ID) return null;
  if (attrString(entity, ATTR.entityType) !== GRANT_ENTITY_TYPE) return null;
  const parsed = grantSchema.safeParse({
    grantKey: entity.key,
    serviceId: attrString(entity, ATTR.serviceId),
    providerId: attrString(entity, ATTR.providerId),
    buyerId: attrString(entity, ATTR.buyerId),
    buyerPublicKey: attrString(entity, ATTR.buyerPublicKey),
    historyRef: attrString(entity, ATTR.actHistoryRef),
    encryptedRef: attrString(entity, ATTR.actEncRef),
    publisherPubKey: attrString(entity, ATTR.actPubkey),
    createdAtBlock: entity.createdAt !== undefined ? entity.createdAt.toString() : undefined,
  });
  return parsed.success ? parsed.data : null;
}

export function parseSaleEntity(entity: RawServiceEntity): Sale | null {
  if (!isTrustedEntity(entity)) return null;
  if (attrString(entity, ATTR.app) !== APP_ID) return null;
  if (attrString(entity, ATTR.entityType) !== SALE_ENTITY_TYPE) return null;
  const parsed = saleSchema.safeParse({
    saleKey: entity.key,
    serviceId: attrString(entity, ATTR.serviceId),
    providerId: attrString(entity, ATTR.providerId),
    buyerId: attrString(entity, ATTR.buyerId),
    txHash: attrString(entity, ATTR.txHash),
    paidUsdc: attrString(entity, ATTR.paidUsdc),
    chainId: attrNumber(entity, ATTR.chainId),
    passKey: attrString(entity, ATTR.passKey),
    buyerPublicKey: attrString(entity, ATTR.buyerPublicKey),
    createdAtBlock: entity.createdAt !== undefined ? entity.createdAt.toString() : undefined,
  });
  return parsed.success ? parsed.data : null;
}
