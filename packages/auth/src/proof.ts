import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes, keccak256, type Hex } from 'viem';
import { canonical } from '../../domain/src/index.ts';

export type Challenge = { id: string; publicKey: Hex; nonce: Hex; audience: string; expiresAt: number };
export const challengeMessage = (challenge: Challenge) => `APIperitivo login v1\n${canonical(challenge)}`;
export function identityFromSeed(seed: Uint8Array) {
  if (seed.byteLength !== 32) throw new Error('Expected 32-byte Swarm ID app secret');
  const publicKey = bytesToHex(ed25519.getPublicKey(seed));
  return {
    publicKey, subject: subjectFor(publicKey),
    signChallenge(challenge: Challenge): Hex {
      if (challenge.publicKey !== publicKey) throw new Error('Challenge key mismatch');
      return bytesToHex(ed25519.sign(new TextEncoder().encode(challengeMessage(challenge)), seed));
    },
  };
}
export const subjectFor = (publicKey: Hex): Hex => keccak256(hexToBytes(publicKey));
export function verifyChallenge(challenge: Challenge, signature: Hex): boolean {
  try {
    return ed25519.verify(hexToBytes(signature), new TextEncoder().encode(challengeMessage(challenge)), hexToBytes(challenge.publicKey), { zip215: false });
  } catch { return false; }
}
