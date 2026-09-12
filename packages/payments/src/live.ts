/**
 * Pure mapping from chain logs to `LiveSale` rows (browser-safe, no wallet).
 * Used by `watchSales` in ./browser.ts and unit-tested without a network.
 */
import type { Address, Hash, Hex } from "viem";
import { unitsToUsdc } from "./index";

export type LiveSale = {
  txHash: Hash;
  buyer: Address;
  provider: Address;
  amountUsdc: string;
  mode: "contract" | "direct";
  /** Contract mode only. */
  purchaseId?: number;
  serviceKey?: Hex;
  accessSeconds?: number;
  blockNumber: bigint;
};

type PurchasedArgs = { purchaseId?: bigint; buyer?: Address; provider?: Address; serviceId?: Hex; amount?: bigint; fee?: bigint; accessSeconds?: bigint };
type TransferArgs = { from?: Address; to?: Address; value?: bigint };
type LogMeta = { transactionHash: Hash; blockNumber: bigint };

/** `Purchased` event of APIritivoPayments → LiveSale; null when the log is incomplete (pending/removed). */
export function saleFromPurchasedLog(log: LogMeta & { args: PurchasedArgs }): LiveSale | null {
  const a = log.args;
  if (!a.buyer || !a.provider || a.amount === undefined) return null;
  return {
    txHash: log.transactionHash,
    buyer: a.buyer,
    provider: a.provider,
    amountUsdc: unitsToUsdc(a.amount),
    mode: "contract",
    purchaseId: a.purchaseId !== undefined ? Number(a.purchaseId) : undefined,
    serviceKey: a.serviceId,
    accessSeconds: a.accessSeconds !== undefined ? Number(a.accessSeconds) : undefined,
    blockNumber: log.blockNumber,
  };
}

/** USDC `Transfer` to the provider's payout wallet → LiveSale (direct mode). */
export function saleFromTransferLog(log: LogMeta & { args: TransferArgs }): LiveSale | null {
  const a = log.args;
  if (!a.from || !a.to || a.value === undefined) return null;
  return { txHash: log.transactionHash, buyer: a.from, provider: a.to, amountUsdc: unitsToUsdc(a.value), mode: "direct", blockNumber: log.blockNumber };
}

/** Stable identity of a sale across polls (a tx can carry several Purchased events). */
export function liveSaleKey(sale: LiveSale): string {
  return `${sale.txHash.toLowerCase()}:${sale.mode}:${sale.purchaseId ?? sale.amountUsdc}`;
}
