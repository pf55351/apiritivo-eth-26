/**
 * Server side: verify that a payment really happened on Fuji before an access
 * pass is issued. Contract mode checks the `Purchased` event of
 * APIritivoPayments; direct mode checks a plain USDC `Transfer`.
 */
import { type Address, createPublicClient, erc20Abi, type Hash, type Hex, http, type Log, parseEventLogs, verifyMessage } from "viem";
import { paymentsAbi, paymentsContractAddress, serviceKey } from "./contract";
import { PAYMENT_CHAIN, passClaimMessage, USDC_ADDRESS, unitsToUsdc, usdcToUnits } from "./index";

export type PaymentVerification =
  | { ok: true; mode: "contract" | "direct"; from: Address; to: Address; amountUsdc: string; blockNumber: bigint; purchaseId?: number }
  /** `transient` = the RPC failed, not the payment: answer 503 and let the client retry. */
  | { ok: false; reason: string; transient?: boolean };

function rpcUrl(): string | undefined {
  const v = process.env.AVALANCHE_FUJI_RPC_URL?.trim();
  return v && v.length > 0 ? v : undefined;
}

/** The parts of a transaction receipt the verifiers look at (pure, testable). */
export type ReceiptLike = { status: "success" | "reverted"; blockNumber: bigint; logs: Log[] };

type ReceiptLookup = { receipt: ReceiptLike | null; error?: string };

/** null receipt = mined nowhere we can see; `error` = the RPC itself failed. */
async function receiptOf(txHash: Hash): Promise<ReceiptLookup> {
  const client = createPublicClient({ chain: PAYMENT_CHAIN, transport: http(rpcUrl(), { timeout: 15_000 }) });
  try {
    return { receipt: await client.getTransactionReceipt({ hash: txHash }) };
  } catch (err) {
    const name = (err as { name?: string }).name ?? "";
    // viem: TransactionReceiptNotFoundError = not mined (yet). Anything else is the RPC.
    if (name === "TransactionReceiptNotFoundError") return { receipt: null };
    return { receipt: null, error: (err as Error).message.split("\n")[0] ?? "RPC error" };
  }
}

const NOT_FOUND = "Transaction not found on Avalanche Fuji (not mined yet, or wrong network).";

function lookupFailure(lookup: ReceiptLookup): PaymentVerification | null {
  if (lookup.error) return { ok: false, reason: `Avalanche Fuji RPC unavailable: ${lookup.error}`, transient: true };
  if (!lookup.receipt) return { ok: false, reason: NOT_FOUND };
  return null;
}

/** Direct mode, pure: a USDC Transfer to `to` of at least `minUsdc` inside `receipt`, all from one wallet. */
export function verifyUsdcReceipt(receipt: ReceiptLike | null, params: { to: Address; minUsdc: string }): PaymentVerification {
  if (!receipt) return { ok: false, reason: NOT_FOUND };
  if (receipt.status !== "success") return { ok: false, reason: "Transaction reverted." };

  const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs }).filter(
    (log) => log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() && log.args.to.toLowerCase() === params.to.toLowerCase(),
  );
  if (transfers.length === 0) return { ok: false, reason: "No USDC transfer to the provider's payout address in this transaction." };
  const from = transfers[0]!.args.from;
  if (transfers.some((t) => t.args.from.toLowerCase() !== from.toLowerCase())) {
    return { ok: false, reason: "The transaction carries USDC transfers from several wallets; one buyer per payment." };
  }
  const total = transfers.reduce((sum, t) => sum + t.args.value, 0n);
  if (total < usdcToUnits(params.minUsdc)) {
    return { ok: false, reason: `Paid ${unitsToUsdc(total)} USDC, but the service costs ${params.minUsdc} USDC.` };
  }
  return { ok: true, mode: "direct", from, to: params.to, amountUsdc: unitsToUsdc(total), blockNumber: receipt.blockNumber };
}

/** Direct mode: fetches the receipt, then `verifyUsdcReceipt`. */
export async function verifyUsdcPayment(params: { txHash: Hash; to: Address; minUsdc: string }): Promise<PaymentVerification> {
  const lookup = await receiptOf(params.txHash);
  return lookupFailure(lookup) ?? verifyUsdcReceipt(lookup.receipt, params);
}

/**
 * Contract mode, pure: exactly one `Purchased(provider, serviceId)` event emitted by
 * `contract`, paying at least `minUsdc` for the listing's `accessSeconds`.
 */
export function verifyContractReceipt(
  receipt: ReceiptLike | null,
  contract: Address,
  params: { provider: Address; serviceId: string; minUsdc: string; accessSeconds?: number },
): PaymentVerification {
  if (!receipt) return { ok: false, reason: NOT_FOUND };
  if (receipt.status !== "success") return { ok: false, reason: "Transaction reverted." };

  const key = serviceKey(params.serviceId).toLowerCase();
  const purchases = parseEventLogs({ abi: paymentsAbi, eventName: "Purchased", logs: receipt.logs }).filter(
    (log) => log.address.toLowerCase() === contract.toLowerCase() && log.args.provider.toLowerCase() === params.provider.toLowerCase() && log.args.serviceId.toLowerCase() === key,
  );
  if (purchases.length === 0) return { ok: false, reason: "No Purchased event for this service/provider in the transaction." };
  if (purchases.length > 1) return { ok: false, reason: "The transaction carries several purchases of this service; one purchase per payment." };
  const p = purchases[0]!;
  if (p.args.amount < usdcToUnits(params.minUsdc)) {
    return { ok: false, reason: `Paid ${unitsToUsdc(p.args.amount)} USDC, but the service costs ${params.minUsdc} USDC.` };
  }
  if (params.accessSeconds !== undefined && Number(p.args.accessSeconds) !== params.accessSeconds) {
    return { ok: false, reason: `The purchase was for ${p.args.accessSeconds} seconds of access, but the listing sells ${params.accessSeconds}.` };
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

/** Contract mode: fetches the receipt, then `verifyContractReceipt` against the configured contract. */
export async function verifyContractPurchase(params: {
  txHash: Hash;
  provider: Address;
  serviceId: string;
  minUsdc: string;
  accessSeconds?: number;
}): Promise<PaymentVerification> {
  const contract = paymentsContractAddress();
  if (!contract) return { ok: false, reason: "Payments contract not configured." };
  const lookup = await receiptOf(params.txHash);
  return lookupFailure(lookup) ?? verifyContractReceipt(lookup.receipt, contract, params);
}

/** Picks contract mode when the contract is configured, direct mode otherwise. */
export async function verifyPayment(params: { txHash: Hash; provider: Address; serviceId: string; minUsdc: string; accessSeconds?: number }): Promise<PaymentVerification> {
  if (paymentsContractAddress()) return verifyContractPurchase(params);
  return verifyUsdcPayment({ txHash: params.txHash, to: params.provider, minUsdc: params.minUsdc });
}

/**
 * Did the wallet that paid sign the claim for this payment and secret hash?
 * Proves the caller controls `buyerAddress`, so a bystander cannot mint a pass
 * for someone else's transaction (EOA signatures; ERC-1271 wallets are not supported).
 */
export async function verifyPassClaim(params: { buyerAddress: Address; txHash: Hash; secretHash: Hex; signature: Hex }): Promise<boolean> {
  try {
    return await verifyMessage({ address: params.buyerAddress, message: passClaimMessage(params.txHash, params.secretHash), signature: params.signature });
  } catch {
    return false;
  }
}
