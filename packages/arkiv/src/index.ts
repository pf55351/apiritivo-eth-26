/**
 * Arkiv read adapter (safe for browser and server).
 * Exposes OUR functions only; the Arkiv SDK never leaks into React.
 */
import { createPublicClient, type PublicArkivClient } from "@arkiv-network/sdk";
import { and, eq } from "@arkiv-network/sdk/query";
import { ACCESS_PASS_ENTITY_TYPE, APP_ID, SALE_ENTITY_TYPE, SERVICE_ENTITY_TYPE, type AccessPass, type ArkivService, type Sale } from "@apiperitivo/shared";
import { http } from "viem";
import { resolveChain, resolveReadRpcUrl } from "./config";
import { ATTR, parseAccessPassEntity, parseSaleEntity, parseServiceEntity, type RawServiceEntity } from "./entity";

export type { AccessPass, ArkivService, Sale } from "@apiperitivo/shared";
export { ATTR, parseAccessPassEntity, parseSaleEntity, parseServiceEntity } from "./entity";

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

  let page = await client
    .select({ key: true, owner: true, createdAt: true, attributes: true, payload: true })
    .where(where)
    .limit(PAGE_SIZE)
    .fetch();

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

const EXPLORER_URL = "https://tiramisu.explorer.arkiv.network";

/* ---------- Phase 2: access passes & sales ---------- */

const PASS_SELECT = { key: true, owner: true, createdAt: true, expiresAt: true, attributes: true, payload: true } as const;

async function queryEntities<T>(
  entityType: string,
  extra: ReturnType<typeof eq>[],
  parse: (raw: RawServiceEntity) => T | null,
): Promise<T[]> {
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
  const passes = await queryEntities(
    ACCESS_PASS_ENTITY_TYPE,
    [eq(ATTR.serviceId, serviceId), eq(ATTR.buyerId, buyerId)],
    parseAccessPassEntity,
  );
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

export type AccessCheck =
  | { ok: true; pass: AccessPass; expiresAtBlock: string; currentBlock: string; secondsRemaining: number }
  | { ok: false; status: 401 | 403; error: string };

/**
 * The one check every gated service needs: is `passKey` a live access pass
 * for `serviceId`? Reads Arkiv directly; expired passes are gone from Arkiv,
 * so "not found" means "no access".
 */
export async function verifyAccessPass(passKey: string | null | undefined, serviceId: string): Promise<AccessCheck> {
  const key = (passKey ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    return { ok: false, status: 401, error: "Missing access pass. Send `Authorization: Bearer <passKey>`." };
  }
  const [pass, timing] = await Promise.all([getAccessPass(key), getBlockTiming()]);
  if (!pass) return { ok: false, status: 403, error: "Access pass not found on Arkiv or expired." };
  if (pass.serviceId !== serviceId) return { ok: false, status: 403, error: "This pass is for a different service." };
  const secondsRemaining = secondsUntilBlock(pass.expiresAtBlock, timing);
  if (secondsRemaining <= 0) return { ok: false, status: 403, error: "Access pass expired." };
  return { ok: true, pass, expiresAtBlock: pass.expiresAtBlock, currentBlock: timing.currentBlock.toString(), secondsRemaining };
}

/** Explorer link for an entity key (informational). */
export function arkivEntityUrl(entityKey: string): string {
  return `${EXPLORER_URL}/entity/${entityKey}`;
}

/** Explorer link for a transaction hash (informational). */
export function arkivTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}
