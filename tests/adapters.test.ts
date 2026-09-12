import { describe, it, expect, vi } from 'vitest';
import { encodeEventTopics, encodeAbiParameters, type Hex, type TransactionReceipt } from 'viem';
import { ENTITY_EVENTS_ABI, type FullEntity } from '@arkiv-network/sdk';
import { bytes32 } from '@arkiv-network/sdk/attr';
import { accessMarketAbi } from '../packages/avalanche/src/abi.ts';
import { FujiMarket, paymentFromReceipt } from '../packages/avalanche/src/client.ts';
import { activationFromReceipt, entitlementMatches, entitlementAttributes, ARKIV_ENGINE } from '../packages/arkiv/src/client.ts';
import { BeeStorage } from '../packages/swarm/src/server.ts';
import { contentReference } from '../packages/swarm/src/reference.ts';
import { APP, FUJI_USDC, canonical, entitlementSchema, manifestMessage, manifestSchema, namedId, purchaseId, type Intent } from '../packages/domain/src/index.ts';
import { activation, manifest, marketAddress, provider, payer, ref, signer, treasury } from './fixtures.ts';

function receipt(address: Hex, topics: ReturnType<typeof encodeEventTopics>, data: Hex): TransactionReceipt {
  if (!topics.every(topic => typeof topic === 'string')) throw new Error('Fixture requires concrete topics');
  const blockHash = namedId('block'), hash = namedId('tx');
  return { transactionHash: hash, transactionIndex: 0, blockHash, blockNumber: 10n, from: payer, to: marketAddress,
    status: 'success', type: 'eip1559', contractAddress: null, cumulativeGasUsed: 1n, gasUsed: 1n, effectiveGasPrice: 1n, logsBloom: '0x',
    logs: [{ address, topics: topics as [Hex, ...Hex[]], data, blockHash, blockNumber: 10n, transactionHash: hash, transactionIndex: 0, logIndex: 0, removed: false }] };
}
describe('Fuji payment proof', () => {
  const intent: Intent = { id: namedId('intent'), subject: namedId('subject'), payer, planId: manifest.planId, manifestRef: ref, createdAt: 0 };
  const id = purchaseId(43113, marketAddress, payer, intent.id);
  const proof = () => receipt(marketAddress,
    encodeEventTopics({ abi: accessMarketAbi, eventName: 'AccessPurchased', args: { purchaseId: id, planId: manifest.planId, payer } }),
    encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], [intent.id, intent.subject, 100000n, 90000n, 10000n]));
  it('accepts a matching event and rejects wrong market, beneficiary, fee or reverted tx', () => {
    expect(paymentFromReceipt(proof(), marketAddress, intent, manifest).purchaseId).toBe(id);
    expect(() => paymentFromReceipt(proof(), provider, intent, manifest)).toThrow('PURCHASE_MISMATCH');
    expect(() => paymentFromReceipt(proof(), marketAddress, { ...intent, subject: namedId('attacker') }, manifest)).toThrow('PURCHASE_MISMATCH');
    expect(() => paymentFromReceipt(proof(), marketAddress, intent, { ...manifest, feeBps: 0 })).toThrow('PURCHASE_MISMATCH');
    expect(() => paymentFromReceipt({ ...proof(), status: 'reverted' }, marketAddress, intent, manifest)).toThrow('PAYMENT_REVERTED');
    expect(() => paymentFromReceipt({ ...proof(), logs: [] }, marketAddress, intent, manifest)).toThrow('PURCHASE_MISMATCH');
  });
  it('accepts the checksummed official Fuji USDC address and rejects a different token', async () => {
    const market = new FujiMarket('http://localhost:1', marketAddress);
    vi.spyOn(market.client, 'getChainId').mockResolvedValue(43113);
    const read = vi.spyOn(market.client, 'readContract');
    const plan = { ...manifest, priceAtomic: 100000n, manifestRef: ref, active: true };
    read.mockResolvedValueOnce(plan).mockResolvedValueOnce(FUJI_USDC);
    expect((await market.getPlan(manifest.planId)).priceAtomic).toBe('100000');
    read.mockResolvedValueOnce(plan).mockResolvedValueOnce(provider);
    await expect(market.getPlan(manifest.planId)).rejects.toThrow('WRONG_PAYMENT_TOKEN');
  });
  it('requires chain and configured confirmation count', async () => {
    const market = new FujiMarket('http://localhost:1', marketAddress, 2);
    vi.spyOn(market, 'getPlan').mockResolvedValue({ serviceId: manifest.serviceId, manifestRef: ref, provider, treasury, priceAtomic: '100000', durationSeconds: 60, feeBps: 1000, active: false });
    vi.spyOn(market.client, 'getTransactionReceipt').mockResolvedValue(proof());
    vi.spyOn(market.client, 'getBlockNumber').mockResolvedValue(10n);
    vi.spyOn(market.client, 'getBlock').mockResolvedValue({ hash: proof().blockHash } as Awaited<ReturnType<typeof market.client.getBlock>>);
    await expect(market.verifyPayment(intent, proof().transactionHash, manifest)).rejects.toThrow('PAYMENT_PENDING');
  });
});
describe('Arkiv entitlement provenance', () => {
  const entitlement = entitlementSchema.parse({ schemaVersion: 1, app: APP, type: 'entitlement', purchaseId: namedId('purchase'), purchaseIntentId: namedId('intent'), subject: namedId('subject'),
    planId: manifest.planId, serviceId: manifest.serviceId, manifestRef: ref, payer, paymentTx: namedId('payment'), paymentBlock: '10', market: marketAddress, chainId: 43113, durationSeconds: 60 });
  const entity: FullEntity = { key: activation.entityKey, owner: provider, creator: provider, createdAt: 100n, updatedAt: 100n,
    expiresAt: 130n, creationFlags: { readonly: true, permissionlessExtension: false, raw: 1 }, contentType: 'application/json',
    payload: new TextEncoder().encode(canonical(entitlement)), attributeSchema: {}, attributes: entitlementAttributes(entitlement),
    toJson: () => entitlement, toText: () => canonical(entitlement) };
  it('requires issuer ownership and creation, exact payload, attributes and fixed expiry', () => {
    expect(entitlementMatches(entity, entitlement, activation, provider, 129n)).toBe(true);
    expect(entitlementMatches(entity, entitlement, activation, provider, 130n)).toBe(false);
    expect(entitlementMatches({ ...entity, creator: payer }, entitlement, activation, provider, 100n)).toBe(false);
    expect(entitlementMatches({ ...entity, owner: payer }, entitlement, activation, provider, 100n)).toBe(false);
    expect(entitlementMatches({ ...entity, expiresAt: 200n }, entitlement, activation, provider, 100n)).toBe(false);
    expect(entitlementMatches({ ...entity, attributes: { ...entity.attributes, subject: bytes32(namedId('attacker')) } }, entitlement, activation, provider, 100n)).toBe(false);
    expect(entitlementMatches({ ...entity, toJson: () => ({ ...entitlement, subject: namedId('attacker') }) }, entitlement, activation, provider, 100n)).toBe(false);
    expect(entitlementMatches({ ...entity, creationFlags: { readonly: true, permissionlessExtension: true, raw: 3 } }, entitlement, activation, provider, 100n)).toBe(false);
  });
  it('uses actual expiry from the engine receipt and refuses logs emitted elsewhere', () => {
    const proof = receipt(ARKIV_ENGINE, encodeEventTopics({ abi: ENTITY_EVENTS_ABI, eventName: 'EntityCreated', args: { entityKey: activation.entityKey, owner: provider } }),
      encodeAbiParameters([{ type: 'uint64' }, { type: 'uint8' }], [777n, 1]));
    expect(activationFromReceipt(proof, provider).expiresAtBlock).toBe('777');
    expect(() => activationFromReceipt({ ...proof, logs: [{ ...proof.logs[0], address: marketAddress }] }, provider)).toThrow('ARKIV_RECEIPT_MISMATCH');
  });
});
describe('Swarm immutable manifests', () => {
  it('checks provider signatures AND Swarm reference on downloaded bytes', async () => {
    const signed = { manifest, signature: await signer.signMessage({ message: manifestMessage(manifest) }) };
    const body = canonical(signed), reference = await contentReference(new TextEncoder().encode(body));
    const fetcher = vi.fn(async () => new Response(body));
    const bee = new BeeStorage('http://bee.test', undefined, fetcher);
    expect((await bee.readManifest(reference)).manifest).toEqual(manifest);
    await expect(bee.readManifest(ref)).rejects.toThrow('SWARM_REFERENCE_MISMATCH');
    const modified = canonical({ ...signed, manifest: { ...manifest, limits: { ...manifest.limits, concurrency: 10 } } });
    fetcher.mockImplementation(async () => new Response(modified));
    const modifiedReference = await contentReference(new TextEncoder().encode(modified));
    await expect(bee.readManifest(modifiedReference)).rejects.toThrow('INVALID_MANIFEST_SIGNATURE');
  });
  it('verifies multi-chunk upload readback, refuses write without batch, and bounds downloads', async () => {
    const value = { text: 'a'.repeat(10000) }, body = canonical(value), reference = await contentReference(new TextEncoder().encode(body));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ reference: reference.slice(2) })).mockResolvedValueOnce(new Response(body));
    const bee = new BeeStorage('http://bee.test', 'a'.repeat(64), fetcher);
    expect(await bee.uploadJson(value)).toBe(reference);
    expect(fetcher.mock.calls[0][1]!.headers).toHaveProperty('Swarm-Postage-Batch-Id', 'a'.repeat(64));
    await expect(new BeeStorage('http://bee.test').uploadJson(value)).rejects.toThrow('SWARM_UPLOAD_NOT_CONFIGURED');
    const huge = new BeeStorage('http://bee.test', undefined, async () => new Response('x'.repeat(131073)));
    await expect(huge.readJson(ref)).rejects.toThrow('SWARM_DOCUMENT_TOO_LARGE');
  });
  it('rejects per-call billing fields and incompatible TTLs in the shared schema', () => {
    expect(manifestSchema.safeParse({ ...manifest, maxRequests: 100 }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...manifest, durationSeconds: 3 }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...manifest, durationSeconds: 0 }).success).toBe(false);
  });
});
