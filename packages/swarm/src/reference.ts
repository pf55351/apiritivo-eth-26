import { MerkleTree } from '@ethersphere/bee-js';
import { bytesToHex, type Hex } from 'viem';
import { AppError } from '../../domain/src/index.ts';

// Raw /bytes content addressing, including multi-chunk files. This is a Swarm BMT,
// not a plain keccak256(payload). Application documents are capped at 128 KiB.
export async function contentReference(bytes: Uint8Array): Promise<Hex> {
  if (bytes.byteLength > 131072) throw new AppError('SWARM_DOCUMENT_TOO_LARGE', 400);
  return bytesToHex((await MerkleTree.root(bytes)).hash());
}
export async function verifyReference(bytes: Uint8Array, reference: string) {
  const normalized = reference.startsWith('0x') ? reference.toLowerCase() : `0x${reference.toLowerCase()}`;
  if (await contentReference(bytes) !== normalized) throw new AppError('SWARM_REFERENCE_MISMATCH', 502);
}
