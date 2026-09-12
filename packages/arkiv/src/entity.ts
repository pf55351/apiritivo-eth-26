import {
  ACCESS_PASS_ENTITY_TYPE,
  APP_ID,
  SALE_ENTITY_TYPE,
  SERVICE_ENTITY_TYPE,
  accessPassSchema,
  arkivServiceSchema,
  saleSchema,
  type AccessPass,
  type ArkivService,
  type Sale,
} from "@apiperitivo/shared";

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
  // access passes + sales
  buyerId: "buyer_id",
  buyerAddress: "buyer_address",
  txHash: "tx_hash",
  paidUsdc: "paid_usdc",
  chainId: "chain_id",
  passKey: "pass_key",
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
 * entities that are not valid APIperitivo services (defensive: anyone can
 * write attributes to a public chain).
 */
export function parseServiceEntity(entity: RawServiceEntity): ArkivService | null {
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
    category: attrString(entity, ATTR.category) ?? "utility",
    providerId: attrString(entity, ATTR.providerId),
    providerName: attrString(entity, ATTR.providerName),
    available: attrBool(entity, ATTR.available) ?? true,
    version: attrNumber(entity, ATTR.version) ?? 1,
    manifestRef: attrString(entity, ATTR.manifestRef),
    priceUsdc: attrString(entity, ATTR.priceUsdc),
    accessSeconds: attrNumber(entity, ATTR.accessSeconds),
    payoutAddress: attrString(entity, ATTR.payoutAddress),
    name: typeof p.name === "string" ? p.name : undefined,
    description: typeof p.description === "string" ? p.description : "",
    entityKey: entity.key,
    owner: entity.owner,
    createdAtBlock: entity.createdAt !== undefined ? entity.createdAt.toString() : undefined,
  };

  const parsed = arkivServiceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parseAccessPassEntity(entity: RawServiceEntity): AccessPass | null {
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
  });
  return parsed.success ? parsed.data : null;
}

export function parseSaleEntity(entity: RawServiceEntity): Sale | null {
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
    createdAtBlock: entity.createdAt !== undefined ? entity.createdAt.toString() : undefined,
  });
  return parsed.success ? parsed.data : null;
}
