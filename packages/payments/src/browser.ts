/**
 * Browser side of payments.
 *
 * Two signers are supported:
 *  - "swarm": an EVM account derived from the Swarm ID identity (`deriveAppSecret`).
 *    Same identity → same address everywhere, no wallet extension needed.
 *  - "injected": MetaMask / Core / Rabby through window.ethereum.
 *
 * Two payment modes, picked automatically:
 *  - contract: approve + `APIritivoPayments.buy` (when NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS is set)
 *  - direct:   plain USDC `transfer` to the provider's payout address
 */
import { type Address, createPublicClient, createWalletClient, custom, erc20Abi, formatEther, type Hash, type Hex, http, toHex, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { type OnChainPurchase, paymentsAbi, paymentsContractAddress, serviceKey } from "./contract";
import { keyFromSignature, PASS_KEY_MESSAGE, PAYMENT_CHAIN, passClaimMessage, USDC_ADDRESS, unitsToUsdc, usdcToUnits } from "./index";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export class WalletError extends Error {
  readonly code: "no-wallet" | "rejected" | "wrong-chain" | "insufficient" | "failed";
  readonly cause?: unknown;
  constructor(code: WalletError["code"], message: string, cause?: unknown) {
    super(message);
    this.name = "WalletError";
    this.code = code;
    this.cause = cause;
  }
}

export type Signer = { kind: "swarm" | "injected"; address: Address; client: WalletClient };

const publicClient = () => createPublicClient({ chain: PAYMENT_CHAIN, transport: http() });

function provider(): Eip1193 {
  const eth = (globalThis as { ethereum?: Eip1193 }).ethereum;
  if (!eth) throw new WalletError("no-wallet", "No EVM wallet found. Install MetaMask or Core to pay.");
  return eth;
}

export function hasInjectedWallet(): boolean {
  return Boolean((globalThis as { ethereum?: unknown }).ethereum);
}

/* ------------------------------------------------------------------ signers */

/** Account derived from the Swarm ID secret. The secret stays in memory only. */
export function swarmSigner(secret: Uint8Array): Signer {
  const account = privateKeyToAccount(toHex(secret));
  const client = createWalletClient({ account, chain: PAYMENT_CHAIN, transport: http() });
  return { kind: "swarm", address: account.address, client };
}

/** Hex private key of a derived signer, for the provider's "reveal / export" section. */
export function secretToPrivateKey(secret: Uint8Array): `0x${string}` {
  return toHex(secret);
}

async function connectInjectedWallet(): Promise<{ address: Address; chainId: number }> {
  const eth = provider();
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
    const address = accounts[0];
    if (!address) throw new WalletError("failed", "Wallet returned no account.");
    return { address: address as Address, chainId: Number.parseInt(chainHex, 16) };
  } catch (err) {
    if (err instanceof WalletError) throw err;
    throw new WalletError("rejected", "Wallet connection was rejected.", err);
  }
}

/** Subscribe to wallet changes. Accounts and chain are separate events: a network switch should not cost a new key signature. */
export function onWalletChange(onAccounts: () => void, onChain: () => void = onAccounts): () => void {
  const eth = (globalThis as { ethereum?: Eip1193 }).ethereum;
  if (!eth?.on) return () => {};
  eth.on("accountsChanged", onAccounts);
  eth.on("chainChanged", onChain);
  return () => {
    eth.removeListener?.("accountsChanged", onAccounts);
    eth.removeListener?.("chainChanged", onChain);
  };
}

export async function ensurePaymentChain(): Promise<void> {
  const eth = provider();
  const hex = `0x${PAYMENT_CHAIN.id.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902) throw new WalletError("wrong-chain", `Switch your wallet to ${PAYMENT_CHAIN.name}.`, err);
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hex,
          chainName: PAYMENT_CHAIN.name,
          nativeCurrency: PAYMENT_CHAIN.nativeCurrency,
          rpcUrls: PAYMENT_CHAIN.rpcUrls.default.http,
          blockExplorerUrls: [PAYMENT_CHAIN.blockExplorers?.default.url ?? "https://testnet.snowtrace.io"],
        },
      ],
    });
  }
}

export async function injectedSigner(): Promise<Signer> {
  const eth = provider();
  await ensurePaymentChain();
  const { address } = await connectInjectedWallet();
  const client = createWalletClient({ account: address, chain: PAYMENT_CHAIN, transport: custom(eth) });
  return { kind: "injected", address, client };
}

/** Signer for an account the wallet already exposes to this site: no prompt, null when nothing is connected. */
export async function reconnectInjectedWallet(): Promise<Signer | null> {
  const eth = (globalThis as { ethereum?: Eip1193 }).ethereum;
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    const address = accounts[0];
    if (!address) return null;
    const client = createWalletClient({ account: address as Address, chain: PAYMENT_CHAIN, transport: custom(eth) });
    return { kind: "injected", address: address as Address, client };
  } catch {
    return null;
  }
}

/** Chain the injected wallet is on, or null without a wallet. */
export async function walletChainId(): Promise<number | null> {
  const eth = (globalThis as { ethereum?: Eip1193 }).ethereum;
  if (!eth) return null;
  try {
    return Number.parseInt((await eth.request({ method: "eth_chainId" })) as string, 16);
  } catch {
    return null;
  }
}

/** One `personal_sign` of PASS_KEY_MESSAGE → the account's pass encryption key. */
export async function signPassKeyMessage(signer: Signer): Promise<Uint8Array> {
  try {
    const signature = await signer.client.signMessage({ account: signer.address, message: PASS_KEY_MESSAGE });
    return keyFromSignature(signature);
  } catch (err) {
    throw new WalletError("rejected", "Signature was rejected in the wallet.", err);
  }
}

/** Sign the claim for a paid transaction (see `passClaimMessage`); sent to POST /api/access-passes as `buyerSignature`. */
export async function signPassClaim(signer: Signer, txHash: Hash, secretHash: Hex, fileKey?: string): Promise<Hex> {
  try {
    return await signer.client.signMessage({ account: signer.address, message: passClaimMessage(txHash, secretHash, fileKey) });
  } catch (err) {
    throw new WalletError("rejected", "Signature was rejected in the wallet.", err);
  }
}

/* ------------------------------------------------------------------ reads */

export type Balances = { avax: string; usdc: string };

export async function getBalances(address: Address): Promise<Balances> {
  const client = publicClient();
  const [avax, usdc] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
  ]);
  return { avax: formatEther(avax), usdc: unitsToUsdc(usdc) };
}

export type ProviderStats = { claimableUsdc: string; totalEarnedUsdc: string };
export type ServiceStats = { revenueUsdc: string; purchases: number };

export async function readProviderStats(address: Address): Promise<ProviderStats | null> {
  const contract = paymentsContractAddress();
  if (!contract) return null;
  const client = publicClient();
  const [claimable, total] = await Promise.all([
    client.readContract({ address: contract, abi: paymentsAbi, functionName: "claimable", args: [address] }),
    client.readContract({ address: contract, abi: paymentsAbi, functionName: "totalEarned", args: [address] }),
  ]);
  return { claimableUsdc: unitsToUsdc(claimable), totalEarnedUsdc: unitsToUsdc(total) };
}

export async function readServiceStats(serviceId: string): Promise<ServiceStats | null> {
  const contract = paymentsContractAddress();
  if (!contract) return null;
  const client = publicClient();
  const key = serviceKey(serviceId);
  const [revenue, purchases] = await Promise.all([
    client.readContract({ address: contract, abi: paymentsAbi, functionName: "serviceRevenue", args: [key] }),
    client.readContract({ address: contract, abi: paymentsAbi, functionName: "servicePurchases", args: [key] }),
  ]);
  return { revenueUsdc: unitsToUsdc(revenue), purchases: Number(purchases) };
}

export async function readRecentPurchases(limit = 20): Promise<OnChainPurchase[] | null> {
  const contract = paymentsContractAddress();
  if (!contract) return null;
  // Count first: a purchase landing between the two reads would otherwise shift every id.
  const total = Number(await publicClient().readContract({ address: contract, abi: paymentsAbi, functionName: "purchaseCount" }));
  const rows = await publicClient().readContract({ address: contract, abi: paymentsAbi, functionName: "getPurchases", args: [0n, BigInt(Math.min(limit, total || 0))] });
  return rows.map((r, i) => ({
    purchaseId: total - 1 - i,
    buyer: r.buyer,
    provider: r.provider,
    serviceKey: r.serviceId,
    amountUsdc: unitsToUsdc(r.amount),
    feeUsdc: unitsToUsdc(r.fee),
    accessSeconds: Number(r.accessSeconds),
    timestamp: Number(r.timestamp),
  }));
}

/* ------------------------------------------------------------------ live */

import { type LiveSale, saleFromPurchasedLog, saleFromTransferLog } from "./live";

export { type LiveSale, liveSaleKey, saleFromPurchasedLog, saleFromTransferLog } from "./live";

/**
 * Listen for new sales as they land on Avalanche Fuji. The public RPC has no
 * websocket, so viem polls `eth_getLogs` every `pollingIntervalMs`.
 *  - contract mode: `Purchased` events of APIritivoPayments filtered by provider
 *  - direct mode:   USDC `Transfer` events to the provider's payout address
 * Returns the unsubscribe function.
 */
export function watchSales(params: { provider: Address; onSale: (sale: LiveSale) => void; onError?: (err: Error) => void; pollingIntervalMs?: number }): () => void {
  const contract = paymentsContractAddress();
  const client = publicClient();
  const pollingInterval = params.pollingIntervalMs ?? 4_000;
  if (contract) {
    return client.watchContractEvent({
      address: contract,
      abi: paymentsAbi,
      eventName: "Purchased",
      args: { provider: params.provider },
      poll: true,
      pollingInterval,
      onError: params.onError,
      onLogs: (logs) => {
        for (const log of logs) {
          const sale = saleFromPurchasedLog(log);
          if (sale) params.onSale(sale);
        }
      },
    });
  }
  return client.watchContractEvent({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    eventName: "Transfer",
    args: { to: params.provider },
    poll: true,
    pollingInterval,
    onError: params.onError,
    onLogs: (logs) => {
      for (const log of logs) {
        const sale = saleFromTransferLog(log);
        if (sale) params.onSale(sale);
      }
    },
  });
}

/* ------------------------------------------------------------------ writes */

async function waitOk(hash: Hash, what: string): Promise<bigint> {
  const receipt = await publicClient().waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success") throw new WalletError("failed", `${what} reverted on-chain.`);
  return receipt.blockNumber;
}

function rethrow(err: unknown, what: string): never {
  if (err instanceof WalletError) throw err;
  const msg = String((err as Error)?.message ?? err);
  if (/rejected|denied/i.test(msg)) throw new WalletError("rejected", `${what} was rejected in the wallet.`, err);
  if (/insufficient funds/i.test(msg)) throw new WalletError("insufficient", `Not enough AVAX for gas on ${PAYMENT_CHAIN.name}.`, err);
  throw new WalletError("failed", `${what} failed.`, err);
}

export type PaymentSent = { txHash: Hash; from: Address; to: Address; amountUsdc: string; mode: "contract" | "direct"; approveTxHash?: Hash };

/**
 * Pay for access. Contract mode: approve (if needed) then `buy`; the returned
 * hash is the `buy` transaction, which the server verifies via the Purchased event.
 * Direct mode: USDC `transfer` to the provider.
 */
export async function payForAccess(params: {
  signer: Signer;
  provider: Address;
  serviceId: string;
  priceUsdc: string;
  accessSeconds: number;
  onStep?: (step: "approving" | "paying") => void;
}): Promise<PaymentSent> {
  const { signer } = params;
  const units = usdcToUnits(params.priceUsdc);
  const balances = await getBalances(signer.address);
  if (usdcToUnits(balances.usdc) < units) {
    throw new WalletError("insufficient", `Not enough USDC on ${PAYMENT_CHAIN.name} (balance ${balances.usdc}).`);
  }
  if (BigInt(Math.floor(Number(balances.avax) * 1e6)) === 0n) {
    throw new WalletError("insufficient", `No AVAX for gas on ${PAYMENT_CHAIN.name}. Use the AVAX faucet first.`);
  }

  const account = signer.client.account!;
  const contract = paymentsContractAddress();

  if (contract) {
    let approveTxHash: Hash | undefined;
    const allowance = await publicClient().readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "allowance", args: [signer.address, contract] });
    if (allowance < units) {
      params.onStep?.("approving");
      try {
        approveTxHash = await signer.client.writeContract({
          account,
          chain: PAYMENT_CHAIN,
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [contract, units],
        });
      } catch (err) {
        rethrow(err, "USDC approval");
      }
      await waitOk(approveTxHash, "USDC approval");
    }
    params.onStep?.("paying");
    try {
      const txHash = await signer.client.writeContract({
        account,
        chain: PAYMENT_CHAIN,
        address: contract,
        abi: paymentsAbi,
        functionName: "buy",
        args: [params.provider, serviceKey(params.serviceId), units, BigInt(params.accessSeconds)],
      });
      return { txHash, from: signer.address, to: contract, amountUsdc: params.priceUsdc, mode: "contract", approveTxHash };
    } catch (err) {
      rethrow(err, "Purchase");
    }
  }

  params.onStep?.("paying");
  try {
    const txHash = await signer.client.writeContract({
      account,
      chain: PAYMENT_CHAIN,
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [params.provider, units],
    });
    return { txHash, from: signer.address, to: params.provider, amountUsdc: params.priceUsdc, mode: "direct" };
  } catch (err) {
    rethrow(err, "USDC transfer");
  }
}

/** Wait until a payment is mined. */
export async function waitForPayment(txHash: Hash): Promise<{ blockNumber: bigint; success: boolean }> {
  const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash, timeout: 180_000 });
  return { blockNumber: receipt.blockNumber, success: receipt.status === "success" };
}

/** Provider: withdraw earned USDC from the contract to any address (amount empty = all). */
export async function claimEarnings(signer: Signer, to: Address, amountUsdc?: string): Promise<Hash> {
  const contract = paymentsContractAddress();
  if (!contract) throw new WalletError("failed", "Payments contract is not deployed yet.");
  try {
    const hash = await signer.client.writeContract({
      account: signer.client.account!,
      chain: PAYMENT_CHAIN,
      address: contract,
      abi: paymentsAbi,
      functionName: "claim",
      args: [to, amountUsdc ? usdcToUnits(amountUsdc) : 0n],
    });
    await waitOk(hash, "Claim");
    return hash;
  } catch (err) {
    rethrow(err, "Claim");
  }
}

/** Move USDC out of a wallet (e.g. from the Swarm wallet to MetaMask). */
export async function transferUsdc(signer: Signer, to: Address, amountUsdc: string): Promise<Hash> {
  try {
    const hash = await signer.client.writeContract({
      account: signer.client.account!,
      chain: PAYMENT_CHAIN,
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, usdcToUnits(amountUsdc)],
    });
    await waitOk(hash, "USDC transfer");
    return hash;
  } catch (err) {
    rethrow(err, "USDC transfer");
  }
}
