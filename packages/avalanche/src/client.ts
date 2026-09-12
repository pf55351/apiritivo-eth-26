import { createPublicClient, decodeEventLog, http, type Hex, type TransactionReceipt } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { accessMarketAbi } from './abi.ts';
import { AppError, FUJI_CHAIN_ID, FUJI_USDC, purchaseId, type Intent, type Manifest, type Payment, type Plan } from '../../domain/src/index.ts';
import type { MarketPort } from '../../domain/src/ports.ts';

export function assertPlan(manifest: Manifest, plan: Plan, reference: Hex, requireActive = true) {
  const matches = plan.manifestRef.toLowerCase() === reference &&
    plan.serviceId.toLowerCase() === manifest.serviceId && plan.provider.toLowerCase() === manifest.provider &&
    plan.treasury.toLowerCase() === manifest.treasury && plan.priceAtomic === manifest.priceAtomic &&
    plan.durationSeconds === manifest.durationSeconds && plan.feeBps === manifest.feeBps;
  if (!matches || (requireActive && !plan.active)) throw new AppError('PLAN_MISMATCH', 409);
}

export function paymentFromReceipt(receipt: TransactionReceipt, market: Hex, intent: Intent, manifest: Manifest): Payment {
  if (receipt.status !== 'success') throw new AppError('PAYMENT_REVERTED', 409);
  const expectedId = purchaseId(FUJI_CHAIN_ID, market, intent.payer, intent.id);
  const events = receipt.logs.filter(log => log.address.toLowerCase() === market.toLowerCase()).flatMap(log => {
    try {
      const event = decodeEventLog({ abi: accessMarketAbi, ...log });
      return event.eventName === 'AccessPurchased' && event.args.purchaseId === expectedId ? [event.args] : [];
    } catch { return []; }
  });
  if (events.length !== 1) throw new AppError('PURCHASE_MISMATCH', 409);
  const event = events[0];
  const amount = BigInt(manifest.priceAtomic), fee = amount * BigInt(manifest.feeBps) / 10000n;
  if (event.planId !== intent.planId || event.subject !== intent.subject || event.payer.toLowerCase() !== intent.payer ||
      event.purchaseIntentId !== intent.id || event.amount !== amount || event.feeAmount !== fee || event.providerAmount !== amount - fee) {
    throw new AppError('PURCHASE_MISMATCH', 409);
  }
  return { purchaseId: expectedId, txHash: receipt.transactionHash, blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash };
}

export class FujiMarket implements MarketPort {
  readonly client;
  constructor(url: string, public address: Hex, private confirmations = 2) {
    this.client = createPublicClient({ chain: avalancheFuji, transport: http(url, { timeout: 15000, retryCount: 1 }), cacheTime: 0 });
  }
  private async assertNetwork() {
    if (await this.client.getChainId() !== FUJI_CHAIN_ID) throw new AppError('WRONG_PAYMENT_CHAIN', 503);
  }
  async getPlan(planId: Hex): Promise<Plan> {
    await this.assertNetwork();
    const [plan, token] = await Promise.all([
      this.client.readContract({ address: this.address, abi: accessMarketAbi, functionName: 'getPlan', args: [planId] }),
      this.client.readContract({ address: this.address, abi: accessMarketAbi, functionName: 'paymentToken' }),
    ]);
    if (token.toLowerCase() !== FUJI_USDC.toLowerCase()) throw new AppError('WRONG_PAYMENT_TOKEN', 503);
    return { ...plan, manifestRef: plan.manifestRef.toLowerCase() as Hex, priceAtomic: plan.priceAtomic.toString() };
  }
  async verifyPayment(intent: Intent, txHash: Hex, manifest: Manifest): Promise<Payment> {
    assertPlan(manifest, await this.getPlan(intent.planId), intent.manifestRef, false);
    const receipt = await this.client.getTransactionReceipt({ hash: txHash });
    const [head, canonicalBlock] = await Promise.all([
      this.client.getBlockNumber({ cacheTime: 0 }), this.client.getBlock({ blockNumber: receipt.blockNumber }),
    ]);
    if (head < receipt.blockNumber + BigInt(this.confirmations - 1)) throw new AppError('PAYMENT_PENDING', 503);
    if (canonicalBlock.hash !== receipt.blockHash) throw new AppError('PAYMENT_REORG', 503);
    return paymentFromReceipt(receipt, this.address, intent, manifest);
  }
}
