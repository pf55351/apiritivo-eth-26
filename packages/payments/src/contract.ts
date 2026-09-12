/**
 * APIritivoPayments contract binding (see contracts/src/APIritivoPayments.sol).
 * The address comes from NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS; when unset the app
 * falls back to direct USDC transfers.
 *
 * The ABI is written by hand in the human-readable form; `test/abi-drift.test.ts`
 * compares it with the Foundry artifact whenever `contracts/out` is present.
 */
import { type Address, type Hex, keccak256, parseAbi, toBytes } from "viem";

export const paymentsAbi = parseAbi([
  // purchases
  "function buy(address provider, bytes32 serviceId, uint256 amount, uint64 accessSeconds) returns (uint256 purchaseId)",
  "function claim(address to, uint256 amount) returns (uint256 withdrawn)",
  // revenue
  "function claimable(address provider) view returns (uint256)",
  "function totalEarned(address provider) view returns (uint256)",
  "function serviceRevenue(bytes32 serviceId) view returns (uint256)",
  "function servicePurchases(bytes32 serviceId) view returns (uint256)",
  "function serviceKey(string serviceId) pure returns (bytes32)",
  // history
  "function purchaseCount() view returns (uint256)",
  "function getPurchase(uint256 purchaseId) view returns ((address buyer, address provider, bytes32 serviceId, uint256 amount, uint256 fee, uint64 accessSeconds, uint64 timestamp))",
  "function getPurchases(uint256 offset, uint256 limit) view returns ((address buyer, address provider, bytes32 serviceId, uint256 amount, uint256 fee, uint64 accessSeconds, uint64 timestamp)[] page)",
  // fees and ownership (owner-only writes are never called from the app)
  "function feeBps() view returns (uint16)",
  "function feeRecipient() view returns (address)",
  "function feesAccrued() view returns (uint256)",
  "function MAX_FEE_BPS() view returns (uint16)",
  "function owner() view returns (address)",
  "function token() view returns (address)",
  "function setFee(uint16 feeBps_, address feeRecipient_)",
  "function withdrawFees() returns (uint256 amount)",
  "function transferOwnership(address newOwner)",
  // events
  "event Purchased(uint256 indexed purchaseId, address indexed buyer, address indexed provider, bytes32 serviceId, uint256 amount, uint256 fee, uint64 accessSeconds)",
  "event Claimed(address indexed provider, address indexed to, uint256 amount)",
  "event FeeUpdated(uint16 feeBps, address feeRecipient)",
  "event FeesWithdrawn(address indexed to, uint256 amount)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
  // errors
  "error FeeTooHigh(uint16 feeBps, uint16 maxFeeBps)",
  "error InsufficientBalance(uint256 requested, uint256 available)",
  "error NotOwner()",
  "error Reentrancy()",
  "error TransferFailed()",
  "error ZeroAddress()",
  "error ZeroAmount()",
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
