import { canonical, signedManifestSchema, manifestMessage, AppError, type SignedManifest } from '../../domain/src/index.ts';
import { verifyMessage, type Hex } from 'viem';
import type { SwarmPort } from '../../domain/src/ports.ts';
import { verifyReference } from './reference.ts';

export class BeeStorage implements SwarmPort {
  private base: string;
  constructor(url: string, private batchId?: string, private fetcher: typeof fetch = fetch) {
    this.base = new URL(url).href.replace(/\/$/, '');
    if (batchId && !/^[a-fA-F0-9]{64}$/.test(batchId)) throw new Error('Invalid SWARM_POSTAGE_BATCH_ID');
  }
  private async bytes(reference: Hex): Promise<Uint8Array> {
    if (!/^0x[a-fA-F0-9]{64}$/.test(reference)) throw new AppError('INVALID_REFERENCE', 400);
    const res = await this.fetcher(`${this.base}/bytes/${reference.slice(2)}`, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!res.ok || !res.body) throw new AppError('SWARM_READ_UNAVAILABLE', 503);
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = res.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 131072) throw new AppError('SWARM_DOCUMENT_TOO_LARGE', 502);
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    await verifyReference(bytes, reference);
    return bytes;
  }
  async readJson(reference: Hex): Promise<unknown> {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await this.bytes(reference)));
  }
  async readManifest(reference: Hex): Promise<SignedManifest> {
    const signed = signedManifestSchema.parse(await this.readJson(reference));
    if (!await verifyMessage({ address: signed.manifest.provider, message: manifestMessage(signed.manifest), signature: signed.signature as Hex })) {
      throw new AppError('INVALID_MANIFEST_SIGNATURE', 502);
    }
    return signed;
  }
  async uploadJson(value: unknown): Promise<Hex> {
    if (!this.batchId) throw new AppError('SWARM_UPLOAD_NOT_CONFIGURED', 503);
    const body = canonical(value);
    if (Buffer.byteLength(body) > 131072) throw new AppError('SWARM_DOCUMENT_TOO_LARGE', 400);
    const res = await this.fetcher(`${this.base}/bytes`, {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Swarm-Postage-Batch-Id': this.batchId, 'Swarm-Deferred-Upload': 'false' },
      body, signal: AbortSignal.timeout(60000), redirect: 'error',
    });
    if (!res.ok) throw new AppError('SWARM_UPLOAD_FAILED', 503);
    const data = await res.json() as { reference?: string };
    if (!data.reference || !/^[a-fA-F0-9]{64}$/.test(data.reference)) throw new AppError('INVALID_SWARM_RESPONSE', 502);
    const reference = `0x${data.reference.toLowerCase()}` as Hex;
    if (new TextDecoder().decode(await this.bytes(reference)) !== body) throw new AppError('SWARM_READBACK_MISMATCH', 502);
    return reference;
  }
}
