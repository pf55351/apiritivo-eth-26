import type { Hex } from 'viem';
import type { Activation, Entitlement, Intent, Listing, Manifest, Payment, Plan, SignedManifest, SignedTransaction } from './index.ts';

export interface MarketPort {
  address: Hex;
  getPlan(planId: Hex): Promise<Plan>;
  verifyPayment(intent: Intent, txHash: Hex, manifest: Manifest): Promise<Payment>;
}
export interface ArkivPort {
  issuer: Hex;
  listServices(filters: { category?: string; maxPriceAtomic?: string }): Promise<Listing[]>;
  getListing(planId: Hex): Promise<Listing | undefined>;
  publishListing(listing: Listing, durationSeconds: number, capture?: (tx: SignedTransaction) => void): Promise<Activation>;
  createEntitlement(entitlement: Entitlement, capture: (tx: SignedTransaction) => void): Promise<Activation>;
  recoverEntitlement(tx: SignedTransaction): Promise<Activation>;
  checkEntitlement(entitlement: Entitlement, activation: Activation): Promise<{ active: boolean; head: bigint }>;
}
export interface SwarmPort {
  readManifest(reference: Hex): Promise<SignedManifest>;
  uploadJson(value: unknown): Promise<Hex>;
  readJson(reference: Hex): Promise<unknown>;
}
