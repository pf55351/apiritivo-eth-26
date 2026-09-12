/**
 * Server side: verify that a payment really happened on Fuji before an access
 * pass is issued. Contract mode checks the `Purchased` event of
 * APIperitivoPayments; direct mode checks a plain USDC `Transfer`.
 */
import { createPublicClient, erc20Abi, http, parseEventLogs, type Address, type Hash } from "viem";
import { PAYMENT_CHAIN, USDC_ADDRESS, unitsToUsdc, usdcToUnits } from "./index";
import { paymentsAbi, paymentsContractAddress, serviceKey } from "./contract";

export type PaymentVerification =
  | { ok: true; mode: "contract" | "direct"; from: Address; to: Address; amountUsdc: string; blockNumber: bigint; purchaseId?: number }
  | { ok: false; reason: string };

function rpcUrl(): string | undefined {
  const v = process.env.AVALANCHE_FUJI_RPC_URL?.trim();
  return v && v.length > 0 ? v : undefined;
}

async function receiptOf(txHash: Hash) {
  const client = createPublicClient({ chain: PAYMENT_CHAIN, transport: http(rpcUrl()) });
  try {
    return await client.getTransactionReceipt({ hash: txHash });
  } catch {
    return null;
  }
}

/** Direct mode: a USDC Transfer to `to` of at least `minUsdc`. */
export async function verifyUsdcPayment(params: { txHash: Hash; to: Address; minUsdc: string }): Promise<PaymentVerification> {
  const receipt = await receiptOf(params.txHash);
  if (!receipt) return { ok: false, reason: "Transaction not found on Avalanche Fuji (not mined yet, or wrong network)." };
  if (receipt.status !== "success") return { ok: false, reason: "Transaction reverted." };

  const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs }).filter(
    (log) => log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() && log.args.to.toLowerCase() === params.to.toLowerCase(),
  );
  if (transfers.length === 0) return { ok: false, reason: "No USDC transfer to the provider's payout address in this transaction." };
  const total = transfers.reduce((sum, t) => sum + t.args.value, 0n);
  if (total < usdcToUnits(params.minUsdc)) {
    return { ok: false, reason: `Paid ${unitsToUsdc(total)} USDC, but the service costs ${params.minUsdc} USDC.` };
  }
  return { ok: true, mode: "direct", from: transfers[0]!.args.from, to: params.to, amountUsdc: unitsToUsdc(total), blockNumber: receipt.blockNumber };
}

/** Contract mode: a `Purchased(provider, serviceId)` event from our contract of at least `minUsdc`. */
export async function verifyContractPurchase(params: { txHash: Hash; provider: Address; serviceId: string; minUsdc: string }): Promise<PaymentVerification> {
  const contract = paymentsContractAddress();
  if (!contract) return { ok: false, reason: "Payments contract not configured." };
  const receipt = await receiptOf(params.txHash);
  if (!receipt) return { ok: false, reason: "Transaction not found on Avalanche Fuji (not mined yet, or wrong network)." };
  if (receipt.status !== "success") return { ok: false, reason: "Transaction reverted." };

  const key = serviceKey(params.serviceId).toLowerCase();
  const purchases = parseEventLogs({ abi: paymentsAbi, eventName: "Purchased", logs: receipt.logs }).filter(
    (log) =>
      log.address.toLowerCase() === contract.toLowerCase() &&
      log.args.provider.toLowerCase() === params.provider.toLowerCase() &&
      log.args.serviceId.toLowerCase() === key,
  );
  if (purchases.length === 0) return { ok: false, reason: "No Purchased event for this service/provider in the transaction." };
  const p = purchases[0]!;
  if (p.args.amount < usdcToUnits(params.minUsdc)) {
    return { ok: false, reason: `Paid ${unitsToUsdc(p.args.amount)} USDC, but the service costs ${params.minUsdc} USDC.` };
  }
  return {
    ok: true,
    mode: "contract",
    from: p.args.buyer,
    to: contract,
    amountUsdc: unitsToUsdc(p.args.amount),
    blockNumber: receipt.blockNumber,
    purchaseId: Number(p.args.purchaseId),
  };
}

/** Picks contract mode when the contract is configured, direct mode otherwise. */
export async function verifyPayment(params: { txHash: Hash; provider: Address; serviceId: string; minUsdc: string }): Promise<PaymentVerification> {
  if (paymentsContractAddress()) return verifyContractPurchase(params);
  return verifyUsdcPayment({ txHash: params.txHash, to: params.provider, minUsdc: params.minUsdc });
}
