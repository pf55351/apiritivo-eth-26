import { describe, it, expect } from 'vitest';
import { fixture, ref } from './fixtures.ts';
import { identityFromSeed } from '../packages/auth/src/proof.ts';
import { namedId } from '../packages/domain/src/index.ts';

describe('gateway authentication and timed access', () => {
  it('rejects replayed signatures, wrong origin and unauthenticated purchase', async () => {
    const f = await fixture();
    try {
      const challenge = f.loggedIn.challenge;
      const replay = await f.api.inject({ method: 'POST', url: '/api/auth/verify', headers: f.headers, payload: { challengeId: challenge.id, signature: f.identity.signChallenge(challenge) } });
      expect(replay.statusCode).toBe(401);
      const crossOrigin = await f.api.inject({ method: 'POST', url: '/api/auth/challenge', headers: { origin: 'https://evil.example' }, payload: { publicKey: f.identity.publicKey } });
      expect(crossOrigin.statusCode).toBe(403);
      expect((await f.invoke(namedId('none'), { origin: f.config.APP_ORIGIN })).statusCode).toBe(401);
    } finally { await f.close(); }
  });
  it('requires a fresh Arkiv check per call, allows repeated calls, denies exactly at expiry', async () => {
    const f = await fixture();
    try {
      const { purchaseId } = await f.buy();
      expect((await f.invoke(purchaseId)).json().error.code).toBe('ACCESS_NOT_ACTIVE');
      await f.worker.tick();
      expect((await f.invoke(purchaseId)).statusCode).toBe(200);
      expect((await f.invoke(purchaseId)).statusCode).toBe(200);
      expect(f.arkiv.checkEntitlement).toHaveBeenCalledTimes(2);
      f.arkiv.head = 130n;
      const expired = await f.invoke(purchaseId);
      expect(expired.statusCode).toBe(403); expect(expired.json().error.code).toBe('ACCESS_EXPIRED');
      expect(f.run).toHaveBeenCalledTimes(2);
      expect(f.store.usage(purchaseId).admitted).toBe(2);
    } finally { await f.close(); }
  });
  it('fails closed on Arkiv outage and distinguishes removal before expiry', async () => {
    const f = await fixture();
    try {
      const { purchaseId } = await f.buy(); await f.worker.tick();
      f.arkiv.unavailable = true;
      expect((await f.invoke(purchaseId)).json().error.code).toBe('ACCESS_CHECK_UNAVAILABLE');
      f.arkiv.unavailable = false; f.arkiv.exists = false;
      expect((await f.invoke(purchaseId)).json().error.code).toBe('ACCESS_NOT_ACTIVE');
      expect(f.run).not.toHaveBeenCalled();
    } finally { await f.close(); }
  });
  it('does not reveal another identity purchase and binds bearer tokens to one pass and scope', async () => {
    const f = await fixture();
    try {
      const first = await f.buy(), second = await f.buy(); await f.worker.tick();
      const other = await f.login(identityFromSeed(new Uint8Array(32).fill(8)));
      const hidden = await f.api.inject({ method: 'GET', url: `/api/purchases/${first.purchaseId}`, headers: { cookie: other.cookie } });
      expect(hidden.statusCode).toBe(404);
      const issued = await f.api.inject({ method: 'POST', url: `/api/passes/${first.purchaseId}/credentials`, headers: f.headers, payload: { operations: ['text.analyze'] } });
      expect(issued.statusCode).toBe(200);
      const credential = issued.json(), auth = { authorization: `Bearer ${credential.token}` };
      expect((await f.invoke(first.purchaseId, auth)).statusCode).toBe(200);
      expect((await f.invoke(second.purchaseId, auth)).json().error.code).toBe('OPERATION_NOT_ALLOWED');
      const purchase = await f.api.inject({ method: 'POST', url: '/api/purchases/prepare', headers: { ...auth, origin: f.config.APP_ORIGIN }, payload: { planId: f.store.getPurchase(first.purchaseId)!.intent.planId, payer: f.store.getPurchase(first.purchaseId)!.intent.payer } });
      expect(purchase.statusCode).toBe(401);
      f.arkiv.head = 130n;
      expect((await f.invoke(first.purchaseId, auth)).json().error.code).toBe('ACCESS_EXPIRED');
      await f.api.inject({ method: 'DELETE', url: `/api/credentials/${credential.id}`, headers: f.headers });
      expect((await f.invoke(first.purchaseId, auth)).statusCode).toBe(401);
    } finally { await f.close(); }
  });
  it('validates input before access check and releases concurrency on provider failure', async () => {
    const f = await fixture();
    try {
      const { purchaseId } = await f.buy(); await f.worker.tick();
      const p = f.store.getPurchase(purchaseId)!; p.manifest.limits.concurrency = 1; f.store.updatePurchase(p);
      const invalid = await f.api.inject({ method: 'POST', url: `/api/passes/${purchaseId}/invoke/text.analyze`, headers: f.headers, payload: { arbitraryUrl: 'http://localhost' } });
      expect(invalid.statusCode).toBe(400); expect(f.arkiv.checkEntitlement).not.toHaveBeenCalled();
      f.run.mockRejectedValueOnce(new Error('upstream sensitive secret'));
      const failed = await f.invoke(purchaseId);
      expect(failed.statusCode).toBe(502); expect(failed.body).not.toContain('sensitive');
      expect(f.store.usage(purchaseId).inflight).toBe(0);
      expect((await f.invoke(purchaseId)).statusCode).toBe(200);
    } finally { await f.close(); }
  });
  it('atomically rejects a concurrent request and permits an admitted request to finish after expiry', async () => {
    const f = await fixture();
    try {
      const { purchaseId } = await f.buy(); await f.worker.tick();
      const p = f.store.getPurchase(purchaseId)!; p.manifest.limits.concurrency = 1; f.store.updatePurchase(p);
      let finish!: (value: unknown) => void;
      let admitted!: () => void; const started = new Promise<void>(resolve => { admitted = resolve; });
      f.run.mockImplementationOnce(async () => { admitted(); return new Promise(resolve => { finish = resolve; }); });
      const first = f.invoke(purchaseId).then(response => response);
      await started;
      expect((await f.invoke(purchaseId)).statusCode).toBe(429);
      f.arkiv.head = 130n;
      expect((await f.invoke(purchaseId)).statusCode).toBe(403);
      finish({ done: true }); expect((await first).statusCode).toBe(200);
      expect(f.store.usage(purchaseId).inflight).toBe(0);
    } finally { await f.close(); }
  });
  it('finalizes a signed receipt after expiry and verifies the exact Swarm document', async () => {
    const f = await fixture();
    try {
      const { purchaseId } = await f.buy(); await f.worker.tick(); await f.invoke(purchaseId);
      const request = () => f.api.inject({ method: 'POST', url: `/api/purchases/${purchaseId}/receipt`, headers: f.headers });
      expect((await request()).statusCode).toBe(409);
      f.arkiv.head = 130n;
      const receipt = await request(); expect(receipt.statusCode).toBe(200);
      expect(receipt.json().receipt.usage).toEqual({ admitted: 1, inflight: 0, succeeded: 1 });
      expect((await request()).body).toBe(receipt.body);
      f.swarm.document = { fake: true };
      const save = () => f.api.inject({ method: 'POST', url: `/api/purchases/${purchaseId}/receipt-reference`, headers: f.headers, payload: { reference: ref } });
      expect((await save()).statusCode).toBe(409);
      f.swarm.document = receipt.json(); expect((await save()).statusCode).toBe(200);
    } finally { await f.close(); }
  });
});
