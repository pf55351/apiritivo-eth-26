import { vi } from 'vitest';
import { z } from 'zod';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, type Hex } from 'viem';
import { sampleManifests } from '../scripts/sample-manifests.ts';
import { configSchema } from '../apps/gateway/src/config.ts';
import { Store } from '../apps/gateway/src/db/store.ts';
import { createApp } from '../apps/gateway/src/app.ts';
import { identityFromSeed } from '../packages/auth/src/proof.ts';
import { APP, namedId, listingFromManifest, purchaseId, type Activation, type Entitlement, type Intent, type Listing, type Manifest, type SignedTransaction } from '../packages/domain/src/index.ts';
import type { ArkivPort, MarketPort, SwarmPort } from '../packages/domain/src/ports.ts';

export const TEST_KEY = `0x${'01'.repeat(32)}` as Hex;
export const signer = privateKeyToAccount(TEST_KEY);
export const provider = signer.address.toLowerCase() as Hex;
export const treasury = '0x2222222222222222222222222222222222222222' as Hex;
export const marketAddress = '0x3333333333333333333333333333333333333333' as Hex;
export const payer = '0x4444444444444444444444444444444444444444' as Hex;
export const manifest = sampleManifests(provider, treasury)[0];
export const ref = namedId('test-manifest');
export const listing = listingFromManifest(manifest, ref);
export const activation: Activation = { entityKey: namedId('entity'), txHash: namedId('arkiv-tx'), createdAtBlock: '100', expiresAtBlock: '130' };
export const signedTx: SignedTransaction = { raw: '0x1234', hash: keccak256('0x1234') };

// Test doubles only. Production server always constructs the real RPC/Bee adapters.
export class FakeArkiv implements ArkivPort {
  issuer = provider; head = 100n; exists = true; unavailable = false;
  listServices = vi.fn(async () => [listing]);
  getListing = vi.fn(async () => listing);
  publishListing = vi.fn(async () => activation);
  createEntitlement = vi.fn(async (_e: Entitlement, capture: (tx: SignedTransaction) => void) => { capture(signedTx); return activation; });
  recoverEntitlement = vi.fn(async () => activation);
  checkEntitlement = vi.fn(async () => {
    if (this.unavailable) throw new Error('RPC offline');
    return { active: this.exists && this.head < 130n, head: this.head };
  });
}
export class FakeMarket implements MarketPort {
  address = marketAddress;
  getPlan = vi.fn(async () => ({ serviceId: manifest.serviceId, provider, treasury, priceAtomic: manifest.priceAtomic, durationSeconds: manifest.durationSeconds, feeBps: manifest.feeBps, manifestRef: ref, active: true }));
  verifyPayment = vi.fn(async (intent: Intent, txHash: Hex, _manifest: Manifest) => ({ purchaseId: purchaseId(43113, marketAddress, intent.payer, intent.id), txHash, blockNumber: '10', blockHash: namedId('payment-block') }));
}
export class FakeSwarm implements SwarmPort {
  document: unknown;
  readManifest = vi.fn(async () => ({ manifest: structuredClone(manifest), signature: `0x${'01'.repeat(65)}` }));
  uploadJson = vi.fn(async (value: unknown) => { this.document = value; return ref; });
  readJson = vi.fn(async () => this.document);
}
export async function fixture(path = ':memory:') {
  const config = configSchema.parse({ NODE_ENV: 'test', RECEIPT_PRIVATE_KEY: TEST_KEY });
  const store = new Store(path), arkiv = new FakeArkiv(), market = new FakeMarket(), swarm = new FakeSwarm();
  const run = vi.fn(async (input: unknown, _signal: AbortSignal) => input);
  const { api, worker } = await createApp({ config, store, arkiv, market, swarm, operations: { 'text.analyze': { input: z.strictObject({ text: z.string().min(1) }), run } } });
  await api.ready();
  const identity = identityFromSeed(new Uint8Array(32).fill(7));
  const headers: Record<string, string> = { origin: config.APP_ORIGIN };
  const login = async (who = identity) => {
    const challenge = (await api.inject({ method: 'POST', url: '/api/auth/challenge', headers, payload: { publicKey: who.publicKey } })).json();
    const response = await api.inject({ method: 'POST', url: '/api/auth/verify', headers, payload: { challengeId: challenge.id, signature: who.signChallenge(challenge) } });
    return { response, challenge, cookie: response.cookies[0].name + '=' + response.cookies[0].value };
  };
  const loggedIn = await login(); headers.cookie = loggedIn.cookie;
  const buy = async () => {
    const prepared = await api.inject({ method: 'POST', url: '/api/purchases/prepare', headers, payload: { planId: manifest.planId, payer } });
    if (prepared.statusCode !== 200) throw new Error(prepared.body);
    const purchaseIntentId = prepared.json().purchaseIntentId as Hex;
    const confirmed = await api.inject({ method: 'POST', url: '/api/purchases/confirm', headers, payload: { purchaseIntentId, txHash: namedId(purchaseIntentId) } });
    if (confirmed.statusCode !== 202) throw new Error(confirmed.body);
    return { purchaseIntentId, purchaseId: confirmed.json().purchaseId as Hex };
  };
  const invoke = (id: Hex, extra: Record<string, string> = headers) => api.inject({ method: 'POST', url: `/api/passes/${id}/invoke/text.analyze`, headers: extra, payload: { text: 'Ciao APIperitivo' } });
  return { api, worker: worker!, config, store, arkiv, market, swarm, identity, headers, run, login, buy, invoke, loggedIn,
    close: async () => { await api.close(); store.close(); } };
}
