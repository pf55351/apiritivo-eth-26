/**
 * Payment rail for Phase 2: USDC on Avalanche Fuji, paid directly from the
 * client's wallet to the provider's payout address. No contract yet.
 */
import { type Address, defineChain, formatUnits, type Hash, type Hex, hexToBytes, keccak256, parseUnits } from "viem";

/** Avalanche Fuji, defined locally so we do not pull every viem chain into the bundle. */
export const PAYMENT_CHAIN = defineChain({
  id: 43113,
  name: "Avalanche Fuji",
  nativeCurrency: { name: "Avalanche Fuji", symbol: "AVAX", decimals: 18 },
  rpcUrls: { default: { http: ["https://api.avax-test.network/ext/bc/C/rpc"] } },
  blockExplorers: { default: { name: "SnowTrace", url: "https://testnet.snowtrace.io", apiUrl: "https://api-testnet.snowtrace.io" } },
  contracts: { multicall3: { address: "0xca11bde05977b3631167028862be2a173976ca11", blockCreated: 7096959 } },
  testnet: true,
});
export const PAYMENT_CHAIN_ID = PAYMENT_CHAIN.id; // 43113
export const PAYMENT_CHAIN_NAME = "Avalanche Fuji";
export const USDC_DECIMALS = 6;
/** Circle's official testnet USDC on Fuji (name "USD Coin", symbol USDC, 6 decimals). */
export const USDC_ADDRESS: Address = "0x5425890298aed601595a70AB815c96711a31Bc65";
export const USDC_FAUCET_URL = "https://faucet.circle.com/";
export const AVAX_FAUCET_URL = "https://core.app/tools/testnet-faucet/";
export const EXPLORER_URL = "https://testnet.snowtrace.io";

export function usdcToUnits(price: string): bigint {
  return parseUnits(price, USDC_DECIMALS);
}

export function unitsToUsdc(units: bigint): string {
  return formatUnits(units, USDC_DECIMALS);
}

export function explorerTxUrl(hash: Hash | string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: Address | string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function explorerTokenUrl(): string {
  return `${EXPLORER_URL}/token/${USDC_ADDRESS}`;
}

/** Normalise a Swarm ID identity address (40 hex, maybe without 0x) into an EVM address. */
export function toEvmAddress(value: string | undefined | null): Address | undefined {
  if (!value) return undefined;
  const hex = value.startsWith("0x") ? value : `0x${value}`;
  return /^0x[0-9a-fA-F]{40}$/.test(hex) ? (hex as Address) : undefined;
}

export * from "./contract";

/* ------------------------------------------------------------ wallet pass key */

/**
 * Fixed message a browser wallet signs once per session. EOA signatures are
 * deterministic (RFC 6979), so the same account always yields the same key.
 */
export const PASS_KEY_MESSAGE = [
  "APIritivo pass key v1",
  "",
  "Sign this message to derive the key that protects your API keys.",
  "It is free and does not send a transaction.",
].join("\n");

/** 32-byte AES key from a wallet signature of PASS_KEY_MESSAGE (pure; the signature itself is never stored). */
export function keyFromSignature(signature: Hex): Uint8Array {
  return hexToBytes(keccak256(signature));
}

/* ------------------------------------------------------------ pass claim */

/**
 * Message the paying wallet signs to claim the pass for its own payment.
 * Binding the secret hash to the transaction proves the caller of
 * `POST /api/access-passes` controls the address that paid, so nobody can
 * race a buyer and mint their pass with a foreign secret. Verified server-side
 * with `verifyMessage`; free, no transaction.
 */
export function passClaimMessage(txHash: Hex | string, secretHash: Hex | string): string {
  return ["APIritivo pass claim v1", "", `Payment: ${txHash.toLowerCase()}`, `Secret hash: ${secretHash.toLowerCase()}`, "", "Sign to receive the API key for this payment."].join(
    "\n",
  );
}
