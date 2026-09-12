/**
 * APIritivoPayments contract binding (see contracts/src/APIritivoPayments.sol).
 * The address comes from NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS; when unset the app
 * falls back to direct USDC transfers.
 */
import { type Address, type Hex, keccak256, parseAbi, toBytes } from "viem";

export const paymentsAbi = parseAbi([
  "function buy(address provider, bytes32 serviceId, uint256 amount, uint64 accessSeconds) returns (uint256 purchaseId)",
  "function claim(address to, uint256 amount) returns (uint256 withdrawn)",
  "function claimable(address provider) view returns (uint256)",
  "function totalEarned(address provider) view returns (uint256)",
  "function serviceRevenue(bytes32 serviceId) view returns (uint256)",
  "function servicePurchases(bytes32 serviceId) view returns (uint256)",
  "function purchaseCount() view returns (uint256)",
  "function feeBps() view returns (uint16)",
  "function feesAccrued() view returns (uint256)",
  "function owner() view returns (address)",
  "function token() view returns (address)",
  "function getPurchases(uint256 offset, uint256 limit) view returns ((address buyer, address provider, bytes32 serviceId, uint256 amount, uint256 fee, uint64 accessSeconds, uint64 timestamp)[])",
  "event Purchased(uint256 indexed purchaseId, address indexed buyer, address indexed provider, bytes32 serviceId, uint256 amount, uint256 fee, uint64 accessSeconds)",
  "event Claimed(address indexed provider, address indexed to, uint256 amount)",
]);

export function paymentsContractAddress(): Address | undefined {
  const raw = (process.env.NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS ?? "").trim();
  return /^0x[0-9a-fA-F]{40}$/.test(raw) ? (raw as Address) : undefined;
}

export function isContractMode(): boolean {
  return paymentsContractAddress() !== undefined;
}

/** Same hashing as `APIritivoPayments.serviceKey`. */
export function serviceKey(serviceId: string): Hex {
  return keccak256(toBytes(serviceId));
}

export type OnChainPurchase = {
  purchaseId?: number;
  buyer: Address;
  provider: Address;
  serviceKey: Hex;
  amountUsdc: string;
  feeUsdc: string;
  accessSeconds: number;
  timestamp: number;
};
