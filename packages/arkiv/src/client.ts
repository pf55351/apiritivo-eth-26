import { createPublicClient, createWalletClient, ExpirationTime, jsonToPayload, ENTITY_EVENTS_ABI, type FullEntity } from '@arkiv-network/sdk';
import { str, bytes32, u64, u256, addr } from '@arkiv-network/sdk/attr';
import { eq, lte } from '@arkiv-network/sdk/query';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { createPublicClient as evmPublicClient, custom, http, keccak256, decodeEventLog, type Hex, type TransactionReceipt } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { APP, ARKIV_CHAIN_ID, AppError, canonical, entitlementSchema, listingSchema, type Activation, type Entitlement, type Listing, type SignedTransaction } from '../../domain/src/index.ts';
import type { ArkivPort } from '../../domain/src/ports.ts';

// Protocol precompile address from @arkiv-network/sdk 0.8.1 src/consts.ts.
export const ARKIV_ENGINE = '0x4400000000000000000000000000000000000044';
export function activationFromReceipt(receipt: TransactionReceipt, issuer: Hex): Activation {
  if (receipt.status !== 'success') throw new AppError('ARKIV_TRANSACTION_REVERTED', 409);
  const events = receipt.logs.filter(log => log.address.toLowerCase() === ARKIV_ENGINE).flatMap(log => {
    try {
      const event = decodeEventLog({ abi: ENTITY_EVENTS_ABI, ...log });
      return event.eventName === 'EntityCreated' && event.args.owner.toLowerCase() === issuer.toLowerCase() ? [event.args] : [];
    } catch { return []; }
  });
  if (events.length !== 1) throw new AppError('ARKIV_RECEIPT_MISMATCH', 409);
  const event = events[0];
  if (event.creationFlags !== 1) throw new AppError('ARKIV_RECEIPT_MISMATCH', 409);
  return { entityKey: event.entityKey, txHash: receipt.transactionHash, createdAtBlock: receipt.blockNumber.toString(), expiresAtBlock: event.expiresAt.toString() };
}

export function entitlementMatches(entity: FullEntity, expected: Entitlement, activation: Activation, issuer: Hex, head: bigint): boolean {
  const parsed = entitlementSchema.safeParse(entity.toJson());
  if (!parsed.success || canonical(parsed.data) !== canonical(expected) || entity.key !== activation.entityKey ||
      entity.owner.toLowerCase() !== issuer.toLowerCase() || entity.creator.toLowerCase() !== issuer.toLowerCase() ||
      !entity.creationFlags.readonly || entity.creationFlags.permissionlessExtension ||
      entity.expiresAt !== BigInt(activation.expiresAtBlock) || head >= entity.expiresAt) return false;
  const attributes = entitlementAttributes(expected);
  return Object.entries(attributes).every(([name, value]) => {
    const actual = entity.attributes[name];
    return actual?.type === value.type && actual.value === value.value;
  });
}
export function entitlementAttributes(e: Entitlement) {
  return { app: str(APP), type: str('entitlement'), subject: bytes32(e.subject), purchaseId: bytes32(e.purchaseId),
    planId: bytes32(e.planId), serviceId: bytes32(e.serviceId), manifestRef: bytes32(e.manifestRef), chainId: u64(e.chainId) };
}
export function listingAttributes(l: Listing) {
  return { app: str(APP), type: str('service'), planId: bytes32(l.planId), serviceId: bytes32(l.serviceId),
    category: str(l.category), provider: addr(l.provider), priceAtomic: u256(BigInt(l.priceAtomic)),
    durationSeconds: u64(l.durationSeconds), chainId: u64(l.chainId), token: addr(l.token), manifestRef: bytes32(l.manifestRef) };
}

export class ArkivNetwork implements ArkivPort {
  readonly client;
  private rpc;
  private account;
  constructor(private url: string, public issuer: Hex, privateKey?: Hex) {
    this.client = createPublicClient({ chain: tiramisu, transport: http(url, { timeout: 15000, retryCount: 1 }), cacheTime: 0 });
    this.rpc = evmPublicClient({ chain: tiramisu, transport: http(url, { timeout: 15000, retryCount: 1 }), cacheTime: 0 });
    this.account = privateKey ? privateKeyToAccount(privateKey) : undefined;
    if (this.account && this.account.address.toLowerCase() !== issuer.toLowerCase()) throw new Error('Arkiv issuer/private key mismatch');
  }
  private async assertNetwork() {
    if (await this.client.getChainId() !== ARKIV_CHAIN_ID) throw new AppError('WRONG_ARKIV_CHAIN', 503);
  }
  private listings() {
    return this.client.select().ownedBy(this.issuer).createdBy(this.issuer).where(eq('app', str(APP)), eq('type', str('service')));
  }
  async listServices(filters: { category?: string; maxPriceAtomic?: string }): Promise<Listing[]> {
    await this.assertNetwork();
    const query = this.listings();
    if (filters.category) query.where(eq('category', str(filters.category)));
    if (filters.maxPriceAtomic) query.where(lte('priceAtomic', u256(BigInt(filters.maxPriceAtomic))));
    const page = await query.limit(100).fetch();
    return page.entities.map(e => listingSchema.parse(e.toJson()));
  }
  async getListing(planId: Hex): Promise<Listing | undefined> {
    await this.assertNetwork();
    const page = await this.listings().where(eq('planId', bytes32(planId))).limit(2).fetch();
    if (page.entities.length > 1) throw new AppError('AMBIGUOUS_LISTING', 503);
    return page.entities[0] ? listingSchema.parse(page.entities[0].toJson()) : undefined;
  }
  private wallet(capture: (tx: SignedTransaction) => void) {
    if (!this.account) throw new AppError('ARKIV_SIGNER_NOT_CONFIGURED', 503);
    // viem signs locally, then the transport saves exact signed bytes BEFORE broadcast.
    // Retrying these bytes cannot create a second entity, even after its TTL has expired.
    const upstream = http(this.url, { timeout: 15000, retryCount: 0 })({ chain: tiramisu });
    const transport = custom({ request: async ({ method, params }) => {
      if (method === 'eth_sendRawTransaction') {
        const raw = (params as [Hex])[0]; capture({ raw, hash: keccak256(raw) });
      }
      return upstream.request({ method, params });
    } }, { retryCount: 0 });
    return createWalletClient({ account: this.account, chain: tiramisu, transport });
  }
  async publishListing(listing: Listing, durationSeconds: number, capture: (tx: SignedTransaction) => void = () => {}): Promise<Activation> {
    await this.assertNetwork();
    if (await this.getListing(listing.planId)) throw new AppError('LISTING_ALREADY_EXISTS', 409);
    const result = await this.wallet(capture).createEntity({
      payload: jsonToPayload(listingSchema.parse(listing)), contentType: 'application/json', attributes: listingAttributes(listing),
      expires: ExpirationTime.fromSeconds(durationSeconds), flags: { readonly: true, permissionlessExtension: false },
    });
    return activationFromReceipt(await this.rpc.getTransactionReceipt({ hash: result.txHash }), this.issuer);
  }
  async createEntitlement(entitlement: Entitlement, capture: (tx: SignedTransaction) => void): Promise<Activation> {
    await this.assertNetwork();
    const result = await this.wallet(capture).createEntity({
      payload: jsonToPayload(entitlementSchema.parse(entitlement)), contentType: 'application/json',
      attributes: entitlementAttributes(entitlement), expires: ExpirationTime.fromSeconds(entitlement.durationSeconds),
      flags: { readonly: true, permissionlessExtension: false },
    });
    return activationFromReceipt(await this.rpc.getTransactionReceipt({ hash: result.txHash }), this.issuer);
  }
  async recoverEntitlement(tx: SignedTransaction): Promise<Activation> {
    await this.assertNetwork();
    if (keccak256(tx.raw) !== tx.hash) throw new AppError('SIGNED_TRANSACTION_CORRUPT', 409);
    // If broadcasting reports "already known" or "nonce too low", receipt lookup still resolves it.
    try { await this.rpc.sendRawTransaction({ serializedTransaction: tx.raw }); } catch { /* same hash only */ }
    const receipt = await this.rpc.waitForTransactionReceipt({ hash: tx.hash, timeout: 20000, pollingInterval: 1000 });
    return activationFromReceipt(receipt, this.issuer);
  }
  async checkEntitlement(expected: Entitlement, activation: Activation) {
    await this.assertNetwork();
    // Start a fresh query for every admission. Never reuse a pagination cursor or cached positive.
    const page = await this.client.select().ownedBy(this.issuer).createdBy(this.issuer)
      .where(eq('app', str(APP)), eq('type', str('entitlement')), eq('subject', bytes32(expected.subject)), eq('purchaseId', bytes32(expected.purchaseId)))
      .limit(2).fetch();
    return { active: page.entities.length === 1 && entitlementMatches(page.entities[0], expected, activation, this.issuer, page.blockNumber), head: page.blockNumber };
  }
}
