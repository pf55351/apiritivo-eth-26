import { randomBytes } from 'node:crypto';
import { encodeFunctionData, erc20Abi, type Hex } from 'viem';
import { accessMarketAbi } from '../../../../packages/avalanche/src/abi.ts';
import { assertPlan } from '../../../../packages/avalanche/src/client.ts';
import { AppError, APP, FUJI_CHAIN_ID, FUJI_USDC, entitlementSchema, type Intent, type Purchase } from '../../../../packages/domain/src/index.ts';
import type { ArkivPort, MarketPort, SwarmPort } from '../../../../packages/domain/src/ports.ts';
import type { Store } from '../db/store.ts';

export class Purchases {
  constructor(private store: Store, private market: MarketPort, private arkiv: ArkivPort, private swarm: SwarmPort) {}
  async plan(planId: Hex) {
    const listing = await this.arkiv.getListing(planId);
    if (!listing) throw new AppError('PLAN_NOT_FOUND', 404);
    const signed = await this.swarm.readManifest(listing.manifestRef);
    if (signed.manifest.planId !== planId || signed.manifest.serviceId !== listing.serviceId) throw new AppError('PLAN_MISMATCH', 409);
    assertPlan(signed.manifest, await this.market.getPlan(planId), listing.manifestRef);
    return { listing, ...signed };
  }
  async prepare(subject: Hex, payer: Hex, planId: Hex) {
    const { listing, manifest } = await this.plan(planId);
    const intent: Intent = { id: `0x${randomBytes(32).toString('hex')}`, subject, payer, planId, manifestRef: listing.manifestRef, createdAt: Date.now() };
    this.store.putIntent(intent);
    return { purchaseIntentId: intent.id, subject, chainId: FUJI_CHAIN_ID, market: this.market.address, token: FUJI_USDC, amount: manifest.priceAtomic,
      approve: { to: FUJI_USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [this.market.address, BigInt(manifest.priceAtomic)] }) },
      purchase: { to: this.market.address, data: encodeFunctionData({ abi: accessMarketAbi, functionName: 'purchase', args: [planId, intent.id, subject] }) },
    };
  }
  async confirm(subject: Hex, intentId: Hex, txHash: Hex): Promise<Purchase> {
    const intent = this.store.getIntent(intentId);
    if (!intent || intent.subject !== subject) throw new AppError('PURCHASE_NOT_FOUND', 404);
    const existing = this.store.purchaseForIntent(intentId);
    if (existing) {
      if (existing.payment.txHash !== txHash) throw new AppError('PURCHASE_MISMATCH', 409);
      return existing;
    }
    // Use immutable terms saved in the intent even if the listing expired or was delisted meanwhile.
    const { manifest } = await this.swarm.readManifest(intent.manifestRef);
    if (manifest.planId !== intent.planId) throw new AppError('PURCHASE_MISMATCH', 409);
    const payment = await this.market.verifyPayment(intent, txHash, manifest);
    const entitlement = entitlementSchema.parse({
      schemaVersion: 1, app: APP, type: 'entitlement', purchaseId: payment.purchaseId, purchaseIntentId: intent.id,
      subject, planId: intent.planId, serviceId: manifest.serviceId, manifestRef: intent.manifestRef, payer: intent.payer,
      paymentTx: txHash, paymentBlock: payment.blockNumber, market: this.market.address, chainId: FUJI_CHAIN_ID, durationSeconds: manifest.durationSeconds,
    });
    return this.store.putPurchase({ intent, payment, manifest, entitlement, status: 'paid', attempts: 0, retryAt: 0 });
  }
}

// Never expose signed raw activation transactions through HTTP responses.
export function purchaseView(p: Purchase) {
  return { purchaseId: p.payment.purchaseId, planId: p.intent.planId, subject: p.intent.subject, payer: p.intent.payer,
    status: p.status, payment: p.payment, activation: p.activation, attempts: p.attempts, lastError: p.lastError };
}
