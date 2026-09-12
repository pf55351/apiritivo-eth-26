import type { SwarmIdClient } from '@snaha/swarm-id';
import { identityFromSeed } from '../../auth/src/proof.ts';
import { canonical } from '../../domain/src/index.ts';
import { verifyReference } from './reference.ts';

// Call only after SwarmIdClient.connect() from a user gesture. No secret leaves the browser.
export async function swarmIdentity(client: Pick<SwarmIdClient, 'deriveAppSecret'>) {
  return identityFromSeed(await client.deriveAppSecret('apiperitivo-login-ed25519-v1'));
}

// Encrypt before upload: the Swarm reference alone never contains the decryption key.
export async function savePrivateReceipt(client: Pick<SwarmIdClient, 'deriveAppSecret' | 'uploadData' | 'downloadData'>, receipt: unknown) {
  const seed = await client.deriveAppSecret('apiperitivo-receipt-aes256-v1');
  const key = await crypto.subtle.importKey('raw', new Uint8Array(seed), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(receipt)));
  const envelope = new TextEncoder().encode(JSON.stringify({ version: 1, iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(encrypted)) }));
  const uploaded = await client.uploadData(envelope, { encrypt: false });
  const readback = await client.downloadData(uploaded.reference);
  if (readback.length !== envelope.length || !readback.every((v, i) => v === envelope[i])) throw new Error('Swarm receipt readback mismatch');
  await verifyReference(readback, uploaded.reference);
  if (canonical(await readPrivateReceipt(client, uploaded.reference)) !== canonical(receipt)) throw new Error('Receipt decryption mismatch');
  // Keep this entry in the user's vault. /receipt-reference accepts only public demo receipts.
  return { reference: uploaded.reference, visibility: 'private' as const, verifiedBy: 'browser' as const };
}

export async function readPrivateReceipt(client: Pick<SwarmIdClient, 'deriveAppSecret' | 'downloadData'>, reference: string): Promise<unknown> {
  const bytes = await client.downloadData(reference);
  await verifyReference(bytes, reference);
  const envelope = JSON.parse(new TextDecoder().decode(bytes));
  if (envelope.version !== 1 || !Array.isArray(envelope.iv) || envelope.iv.length !== 12 || !Array.isArray(envelope.ciphertext)) throw new Error('Invalid receipt envelope');
  const seed = await client.deriveAppSecret('apiperitivo-receipt-aes256-v1');
  const key = await crypto.subtle.importKey('raw', new Uint8Array(seed), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(envelope.iv) }, key, new Uint8Array(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}
