/**
 * Arkiv read adapter (safe for browser and server).
 * Exposes OUR functions only; the Arkiv SDK never leaks into React.
 */
import { createPublicClient, type PublicArkivClient } from "@arkiv-network/sdk";
import { checkPassSecret, parsePassBearer } from "./pass-secret";

export * from "./pass-secret";

import {
  ACCESS_PASS_ENTITY_TYPE,
  type AccessPass,
  APP_ID,
  type ArkivService,
  GRANT_ENTITY_TYPE,
  type Grant,
  SALE_ENTITY_TYPE,
  type Sale,
  SERVICE_ENTITY_TYPE,
} from "@apiritivo/shared";
import { and, eq } from "@arkiv-network/sdk/query";
import { http } from "viem";
import { resolveChain, resolveReadRpcUrl } from "./config";
import { ATTR, parseAccessPassEntity, parseGrantEntity, parseSaleEntity, parseServiceEntity, type RawServiceEntity } from "./entity";

export type { AccessPass, ArkivService, Grant, Sale } from "@apiritivo/shared";
export { ATTR, parseAccessPassEntity, parseGrantEntity, parseSaleEntity, parseServiceEntity } from "./entity";

let cachedClient: PublicArkivClient | undefined;

function readClient(): PublicArkivClient {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: resolveChain(),
      transport: http(resolveReadRpcUrl()),
    }) as unknown as PublicArkivClient;
  }
  return cachedClient;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function queryServices(extra: ReturnType<typeof eq>[]): Promise<ArkivService[]> {
  const client = readClient();
  const where = and(eq(ATTR.app, APP_ID), eq(ATTR.entityType, SERVICE_ENTITY_TYPE), ...extra);

  let page = await client.select({ key: true, owner: true, createdAt: true, attributes: true, payload: true }).where(where).limit(PAGE_SIZE).fetch();

  const services: ArkivService[] = [];
  let pages = 0;
  for (;;) {
    for (const entity of page.entities) {
      const parsed = parseServiceEntity(entity as unknown as RawServiceEntity);
      if (parsed) services.push(parsed);
    }
    pages += 1;
    if (!page.hasNextPage() || pages >= MAX_PAGES) break;
    page = await page.next();
  }

  // Newest first (by creation block), stable for ties.
  services.sort((a, b) => {
    const ba = a.createdAtBlock ? BigInt(a.createdAtBlock) : 0n;
    const bb = b.createdAtBlock ? BigInt(b.createdAtBlock) : 0n;
    return bb > ba ? 1 : bb < ba ? -1 : 0;
  });

  // If the same serviceId was published twice keep the newest version.
  const seen = new Map<string, ArkivService>();
  for (const s of services) {
    const existing = seen.get(s.serviceId);
    if (!existing || s.version > existing.version) seen.set(s.serviceId, s);
  }
  return Array.from(seen.values());
}

/** Marketplace: every available service. */
export async function listServices(): Promise<ArkivService[]> {
  return queryServices([eq(ATTR.available, true)]);
}

/** Single service by our stable serviceId. */
export async function getService(serviceId: string): Promise<ArkivService | null> {
  const results = await queryServices([eq(ATTR.serviceId, serviceId)]);
  return results[0] ?? null;
}

/** Provider dashboard: every service owned by a Swarm identity (available or not). */
export async function listServicesByProvider(providerId: string): Promise<ArkivService[]> {
  return queryServices([eq(ATTR.providerId, providerId)]);
}

/** Tiramisu block explorer: transactions and address balances (browser-safe). */
export const ARKIV_EXPLORER_URL = "https://tiramisu.explorer.arkiv.network";
const EXPLORER_URL = ARKIV_EXPLORER_URL;

/** Arkiv Data Explorer: entities and queries. `chain=tiramisu` pins the testnet. */
export const ARKIV_DATA_EXPLORER_URL = "https://data.arkiv.network";
export const ARKIV_CHAIN_SLUG = "tiramisu";

/* ---------- Phase 2: access passes & sales ---------- */

const PASS_SELECT = { key: true, owner: true, createdAt: true, expiresAt: true, attributes: true, payload: true } as const;

async function queryEntities<T>(entityType: string, extra: ReturnType<typeof eq>[], parse: (raw: RawServiceEntity) => T | null): Promise<T[]> {
  const client = readClient();
  let page = await client
    .select(PASS_SELECT)
    .where(and(eq(ATTR.app, APP_ID), eq(ATTR.entityType, entityType), ...extra))
    .limit(PAGE_SIZE)
    .fetch();
  const out: T[] = [];
  let pages = 0;
  for (;;) {
    for (const entity of page.entities) {
      const parsed = parse(entity as unknown as RawServiceEntity);
      if (parsed) out.push(parsed);
    }
    pages += 1;
    if (!page.hasNextPage() || pages >= MAX_PAGES) break;
    page = await page.next();
  }
  return out;
}

/** Live (non-expired) passes owned by a buyer. Arkiv drops expired entities itself. */
export async function listAccessPassesByBuyer(buyerId: string): Promise<AccessPass[]> {
  const passes = await queryEntities(ACCESS_PASS_ENTITY_TYPE, [eq(ATTR.buyerId, buyerId)], parseAccessPassEntity);
  return passes.sort((a, b) => (BigInt(b.expiresAtBlock) > BigInt(a.expiresAtBlock) ? 1 : -1));
}

/** Live passes of one buyer for one service. */
export async function listAccessPassesForService(serviceId: string, buyerId: string): Promise<AccessPass[]> {
  const passes = await queryEntities(ACCESS_PASS_ENTITY_TYPE, [eq(ATTR.serviceId, serviceId), eq(ATTR.buyerId, buyerId)], parseAccessPassEntity);
  return passes.sort((a, b) => (BigInt(b.expiresAtBlock) > BigInt(a.expiresAtBlock) ? 1 : -1));
}

/**
 * Fetch one pass by its key. Returns null when it does not exist or has
 * expired (Arkiv removes expired entities, so "not found" == "no access").
 */
export async function getAccessPass(passKey: string): Promise<AccessPass | null> {
  const client = readClient();
  try {
    const entity = await client.getEntity(passKey as `0x${string}`);
    return parseAccessPassEntity(entity as unknown as RawServiceEntity);
  } catch {
    return null;
  }
}

/** Permanent sale receipts of a provider (revenue). */
export async function listSalesByProvider(providerId: string): Promise<Sale[]> {
  return queryEntities(SALE_ENTITY_TYPE, [eq(ATTR.providerId, providerId)], parseSaleEntity);
}

/** Grants of a service's private file, newest first (the newest history ref is the live ACT). */
export async function listGrantsForService(serviceId: string): Promise<Grant[]> {
  const grants = await queryEntities(GRANT_ENTITY_TYPE, [eq(ATTR.serviceId, serviceId)], parseGrantEntity);
  return grants.sort((a, b) => (BigInt(b.createdAtBlock ?? "0") > BigInt(a.createdAtBlock ?? "0") ? 1 : -1));
}

/** The grant a buyer holds for a service's private file, if any. */
export async function findGrant(serviceId: string, buyerId: string): Promise<Grant | null> {
  const grants = await queryEntities(GRANT_ENTITY_TYPE, [eq(ATTR.serviceId, serviceId), eq(ATTR.buyerId, buyerId)], parseGrantEntity);
  grants.sort((a, b) => (BigInt(b.createdAtBlock ?? "0") > BigInt(a.createdAtBlock ?? "0") ? 1 : -1));
  return grants[0] ?? null;
}

/** Sale receipt for a payment tx (replay protection). */
export async function findSaleByTxHash(txHash: string): Promise<Sale | null> {
  const sales = await queryEntities(SALE_ENTITY_TYPE, [eq(ATTR.txHash, txHash.toLowerCase())], parseSaleEntity);
  return sales[0] ?? null;
}

export type BlockTiming = { currentBlock: bigint; currentBlockTime: number; blockDuration: number };

export async function getBlockTiming(): Promise<BlockTiming> {
  const t = await readClient().getBlockTiming();
  return { currentBlock: BigInt(t.currentBlock), currentBlockTime: Number(t.currentBlockTime), blockDuration: Number(t.blockDuration) };
}

/** Seconds until `targetBlock`, estimated from the chain's block timing (negative = past). */
export function secondsUntilBlock(targetBlock: bigint | string, timing: BlockTiming): number {
  const target = typeof targetBlock === "string" ? BigInt(targetBlock) : targetBlock;
  return Number(target - timing.currentBlock) * timing.blockDuration;
}

export function estimateBlockDate(targetBlock: bigint | string, timing: BlockTiming): Date {
  return new Date((timing.currentBlockTime + secondsUntilBlock(targetBlock, timing)) * 1000);
}

export type AccessCheck = { ok: true; pass: AccessPass; expiresAtBlock: string; currentBlock: string; secondsRemaining: number } | { ok: false; status: 401 | 403; error: string };

/**
 * The one check every gated service needs: is `passKey` a live access pass
 * for `serviceId`? Reads Arkiv directly; expired passes are gone from Arkiv,
 * so "not found" means "no access".
 */
export async function verifyAccessPass(authorization: string | null | undefined, serviceId: string): Promise<AccessCheck> {
  const bearer = parsePassBearer(authorization);
  if (!bearer) {
    return { ok: false, status: 401, error: "Missing access pass. Send `Authorization: Bearer <passKey>.<secret>`." };
  }
  const [pass, timing] = await Promise.all([getAccessPass(bearer.passKey), getBlockTiming()]);
  if (!pass) return { ok: false, status: 403, error: "Access pass not found on Arkiv or expired." };
  if (pass.serviceId !== serviceId) return { ok: false, status: 403, error: "This pass is for a different service." };
  const secondsRemaining = secondsUntilBlock(pass.expiresAtBlock, timing);
  if (secondsRemaining <= 0) return { ok: false, status: 403, error: "Access pass expired." };
  // Ownership: the entity key is public, the secret is not.
  const owned = checkPassSecret(pass, bearer.secret);
  if (!owned.ok) return owned;
  return { ok: true, pass, expiresAtBlock: pass.expiresAtBlock, currentBlock: timing.currentBlock.toString(), secondsRemaining };
}

/** Data Explorer link for an arbitrary Arkiv query, e.g. `$key = key(0x…)` or `$owner = addr(0x…)`. */
export function arkivQueryUrl(query: string): string {
  return `${ARKIV_DATA_EXPLORER_URL}/?q=${encodeURIComponent(query)}&chain=${ARKIV_CHAIN_SLUG}`;
}

/** Data Explorer link for an entity key (informational). */
export function arkivEntityUrl(entityKey: string): string {
  return arkivQueryUrl(`$key = key(${entityKey})`);
}

/** Data Explorer link for every entity owned by an address (e.g. the app writer). */
export function arkivOwnerUrl(address: string): string {
  return arkivQueryUrl(`$owner = addr(${address})`);
}

/** Data Explorer landing page on Tiramisu (no query). */
export function arkivDataExplorerUrl(): string {
  return `${ARKIV_DATA_EXPLORER_URL}/?chain=${ARKIV_CHAIN_SLUG}`;
}

/**
 * Block explorer link for a transaction hash. The Data Explorer has no
 * transaction view, so tx proofs stay on the Tiramisu block explorer.
 */
export function arkivTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}
