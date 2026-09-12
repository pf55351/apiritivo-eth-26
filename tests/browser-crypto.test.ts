import { it, expect } from 'vitest';
import { readPrivateReceipt, savePrivateReceipt, swarmIdentity } from '../packages/swarm/src/browser.ts';
import { contentReference } from '../packages/swarm/src/reference.ts';
import { identityFromSeed, verifyChallenge } from '../packages/auth/src/proof.ts';
import { namedId } from '../packages/domain/src/index.ts';

it('roundtrips a private AES-GCM receipt and keeps reference verification in the browser', async () => {
  let stored = new Uint8Array();
  const client = {
    deriveAppSecret: async (_label: string) => new Uint8Array(32).fill(7),
    uploadData: async (bytes: Uint8Array) => { stored = new Uint8Array(bytes); return { reference: (await contentReference(bytes)).slice(2) }; },
    downloadData: async (_ref: string) => stored,
  };
  const receipt = { purchase: namedId('purchase'), privateResult: 'Only for the account holder' };
  const result = await savePrivateReceipt(client, receipt);
  expect(result.visibility).toBe('private'); expect(result.verifiedBy).toBe('browser');
  expect(new TextDecoder().decode(stored)).not.toContain(receipt.privateResult);
  expect(await readPrivateReceipt(client, result.reference)).toEqual(receipt);
  await expect(readPrivateReceipt({ ...client, deriveAppSecret: async () => new Uint8Array(32).fill(8) }, result.reference)).rejects.toThrow();
  stored[10] ^= 1;
  await expect(readPrivateReceipt(client, result.reference)).rejects.toThrow('SWARM_REFERENCE_MISMATCH');
});

it('derives a stable app identity and binds signatures to audience, nonce and expiry', async () => {
  const seed = new Uint8Array(32).fill(7);
  const identity = await swarmIdentity({ deriveAppSecret: async () => seed });
  expect(identity.subject).toBe(identityFromSeed(seed).subject);
  const challenge = { id: 'test', publicKey: identity.publicKey, nonce: namedId('nonce'), audience: 'http://localhost:3001', expiresAt: 1234567 };
  const signature = identity.signChallenge(challenge);
  expect(verifyChallenge(challenge, signature)).toBe(true);
  expect(verifyChallenge({ ...challenge, audience: 'https://attacker.test' }, signature)).toBe(false);
  expect(verifyChallenge({ ...challenge, expiresAt: 9999999 }, signature)).toBe(false);
  expect(verifyChallenge({ ...challenge, nonce: namedId('another') }, signature)).toBe(false);
});
