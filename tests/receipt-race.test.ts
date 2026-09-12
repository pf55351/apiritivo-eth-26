import { it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fixture } from './fixtures.ts';
import { acquireLock } from '../apps/gateway/src/db/lock.ts';

it('blocks a delayed admission after receipt finalization closes the pass', async () => {
  const f = await fixture();
  try {
    const { purchaseId } = await f.buy(); await f.worker.tick();
    let resolveCheck!: (result: { active: boolean; head: bigint }) => void;
    let beginCheck!: () => void;
    const started = new Promise<void>(resolve => { beginCheck = resolve; });
    f.arkiv.checkEntitlement.mockImplementationOnce(async () => { beginCheck(); return new Promise(resolve => { resolveCheck = resolve; }); });
    const pending = f.invoke(purchaseId).then(response => response); await started;
    f.arkiv.head = 130n;
    const final = await f.api.inject({ method: 'POST', url: `/api/purchases/${purchaseId}/receipt`, headers: f.headers });
    expect(final.statusCode).toBe(200);
    resolveCheck({ active: true, head: 129n });
    expect((await pending).statusCode).toBe(403);
    expect(f.run).not.toHaveBeenCalled();
    expect(final.json().receipt.usage.admitted).toBe(0);
  } finally { await f.close(); }
});

it('allows only one gateway or publisher to hold the database lock', () => {
  const directory = mkdtempSync(join(tmpdir(), 'apiperitivo-lock-')), path = join(directory, 'db.sqlite');
  try {
    const release = acquireLock(path);
    expect(() => acquireLock(path)).toThrow('already in use');
    release();
    acquireLock(path)();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
