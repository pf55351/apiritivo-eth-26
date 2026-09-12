import { AppError } from '../../../../packages/domain/src/index.ts';
import type { ArkivPort, MarketPort } from '../../../../packages/domain/src/ports.ts';
import type { Store } from '../db/store.ts';

export class ActivationWorker {
  private running?: Promise<void>;
  constructor(private store: Store, private arkiv: ArkivPort, private market: MarketPort, private recoverPublication: () => Promise<void> = async () => {}) {}
  async drain() { await this.running; }
  async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.running || this.store.purchases().some(p => p.signedTransaction && !p.activation)) throw new AppError('ISSUER_BUSY', 409);
    const task = work();
    this.running = task.then(() => {}, () => {}).finally(() => { this.running = undefined; });
    return task;
  }
  tick(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.run().finally(() => { this.running = undefined; });
    return this.running;
  }
  private async run() {
    // Resolve a saved publication transaction before assigning the issuer another nonce.
    await this.recoverPublication();
    // A signed tx may not have reached the mempool. Reserve its nonce by blocking
    // later creates until it has a receipt; retry backoff must not allow overtaking.
    const jobs = this.store.purchases().sort((a, b) => Number(!!b.signedTransaction && !b.activation) - Number(!!a.signedTransaction && !a.activation));
    for (const job of jobs) {
      if (job.signedTransaction && !job.activation && (job.status === 'manual_review' || job.retryAt > Date.now())) return;
      if (!['paid', 'submitting'].includes(job.status) || job.retryAt > Date.now()) continue;
      const id = job.payment.purchaseId;
      try {
        // A saved transaction is reconciled as-is. Expiration never causes a new create.
        const activation = job.signedTransaction
          ? await this.arkiv.recoverEntitlement(job.signedTransaction)
          : await (async () => {
            const payment = await this.market.verifyPayment(job.intent, job.payment.txHash, job.manifest);
            if (payment.blockHash !== job.payment.blockHash || payment.purchaseId !== id) throw new AppError('PAYMENT_CHANGED', 409);
            return this.arkiv.createEntitlement(job.entitlement, signed => this.store.captureTransaction(id, signed));
          })();
        const latest = this.store.getPurchase(id)!;
        latest.activation = activation; latest.status = 'active'; latest.lastError = undefined;
        this.store.updatePurchase(latest);
      } catch (error) {
        // Read again: the transport may already have persisted a tx before throwing.
        const latest = this.store.getPurchase(id)!;
        latest.attempts++;
        latest.lastError = error instanceof AppError ? error.code : 'ACTIVATION_RETRY_PENDING';
        latest.retryAt = Date.now() + Math.min(60000, 1000 * 2 ** Math.min(latest.attempts, 6));
        if (error instanceof AppError && error.status === 409) latest.status = 'manual_review';
        this.store.updatePurchase(latest);
        if (latest.signedTransaction && !latest.activation) return;
      }
    }
  }
}
