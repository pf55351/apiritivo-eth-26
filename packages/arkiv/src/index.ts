/**
 * Arkiv read adapter (safe for browser and server).
 * Exposes OUR functions only; the Arkiv SDK never leaks into React.
 */
import { createPublicClient, type PublicArkivClient } from "@arkiv-network/sdk";
import { and, eq } from "@arkiv-network/sdk/query";
import { APP_ID, SERVICE_ENTITY_TYPE, type ArkivService } from "@apiperitivo/shared";
import { http } from "viem";
import { resolveChain, resolveReadRpcUrl } from "./config";
import { ATTR, parseServiceEntity, type RawServiceEntity } from "./entity";

export type { ArkivService } from "@apiperitivo/shared";
export { ATTR, parseServiceEntity } from "./entity";

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

/** Explorer link for an entity key (informational). */
export function arkivEntityUrl(entityKey: string): string {
  return `${EXPLORER_URL}/entity/${entityKey}`;
}

/** Explorer link for a transaction hash (informational). */
export function arkivTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}
