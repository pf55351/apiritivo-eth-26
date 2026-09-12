import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture, signedTx, activation } from './fixtures.ts';
import { Store } from '../apps/gateway/src/db/store.ts';
import { ActivationWorker } from '../apps/gateway/src/workers/activation.ts';
import { AppError } from '../packages/domain/src/index.ts';

describe('durable activation worker', () => {
  it('recovers the same signed transaction after process restart and never remints an expired pass', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiperitivo-')), path = join(dir, 'db.sqlite');
    const f = await fixture(path);
    try {
      const { purchaseId, purchaseIntentId } = await f.buy();
      f.arkiv.createEntitlement.mockImplementationOnce(async (_, capture) => { capture(signedTx); throw new Error('Connection lost after broadcast'); });
      await f.worker.tick();
      expect(f.store.getPurchase(purchaseId)!.signedTransaction).toEqual(signedTx);
      await f.close();
      const reopened = new Store(path);
      try {
        const p = reopened.getPurchase(purchaseId)!; p.retryAt = 0; reopened.updatePurchase(p);
        f.arkiv.head = 200n;
        const worker = new ActivationWorker(reopened, f.arkiv, f.market); await worker.tick(); await worker.tick();
        expect(reopened.getPurchase(purchaseId)!.activation).toEqual(activation);
        expect(reopened.purchaseForIntent(purchaseIntentId)!.payment.purchaseId).toBe(purchaseId);
        expect(f.arkiv.createEntitlement).toHaveBeenCalledTimes(1);
        expect(f.arkiv.recoverEntitlement).toHaveBeenCalledTimes(1);
        expect((await f.arkiv.checkEntitlement()).active).toBe(false);
      } finally { reopened.close(); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('prevents the next purchase from reusing a reserved nonce, including during backoff', async () => {
    const f = await fixture();
    try {
      const first = await f.buy(), second = await f.buy();
      f.arkiv.createEntitlement.mockImplementationOnce(async (_, capture) => { capture(signedTx); throw new Error('Not accepted by RPC'); });
      await f.worker.tick(); await f.worker.tick();
      expect(f.arkiv.createEntitlement).toHaveBeenCalledTimes(1);
      expect(f.store.getPurchase(second.purchaseId)!.status).toBe('paid');
      const p = f.store.getPurchase(first.purchaseId)!; p.retryAt = 0; f.store.updatePurchase(p);
      await f.worker.tick();
      expect(f.arkiv.recoverEntitlement).toHaveBeenCalledTimes(1);
      expect(f.arkiv.createEntitlement).toHaveBeenCalledTimes(2);
      expect(f.store.getPurchase(second.purchaseId)!.status).toBe('active');
    } finally { await f.close(); }
  });
  it('does not reactivate on duplicate confirm and routes a reverted activation to manual review', async () => {
    const f = await fixture();
    try {
      const bought = await f.buy();
      f.arkiv.createEntitlement.mockImplementationOnce(async (_, capture) => { capture(signedTx); throw new AppError('ARKIV_TRANSACTION_REVERTED', 409); });
      await f.worker.tick(); await f.worker.tick();
      const p = f.store.getPurchase(bought.purchaseId)!;
      expect(p.status).toBe('manual_review');
      const duplicate = await f.api.inject({ method: 'POST', url: '/api/purchases/confirm', headers: f.headers, payload: { purchaseIntentId: bought.purchaseIntentId, txHash: p.payment.txHash } });
      expect(duplicate.statusCode).toBe(202); expect(duplicate.json().status).toBe('manual_review');
      expect(f.arkiv.createEntitlement).toHaveBeenCalledTimes(1);
      expect(duplicate.body).not.toContain(signedTx.raw);
    } finally { await f.close(); }
  });
});
