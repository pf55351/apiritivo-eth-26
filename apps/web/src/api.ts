import type { Hex } from "viem";
import type {
  Manifest,
  Listing,
  Activation,
  Payment,
} from "../../../packages/domain/src/index.ts";

export type Config = {
  mode: "demo" | "testnet";
  swarmIdUrl: string;
  market?: Hex;
  treasury?: Hex;
  publisher?: Hex;
  feeBps: number;
  ready: {
    catalog: boolean;
    checkout: boolean;
    publishing: boolean;
    receipts: boolean;
  };
};
export type Plan = { manifest: Manifest; listing: Listing; signature: Hex };
export type Pass = {
  purchaseId: Hex;
  planId: Hex;
  manifestRef: Hex;
  manifest: Manifest;
  payment: Payment;
  activation?: Activation;
  status: string;
  access: "active" | "pending" | "expired" | "inactive" | "unavailable";
  remainingSeconds?: number;
  checkedAt: number;
  lastError?: string;
};
export type Offer = {
  manifest: Manifest;
  reference?: Hex;
  activation?: Activation;
  status: "published" | "prepared";
};
export type Prepared = {
  purchaseIntentId: Hex;
  approve: { to: Hex; data: Hex };
  purchase: { to: Hex; data: Hex };
};
export type Pending = {
  planId: Hex;
  prepared: Prepared;
  payer: Hex;
  txHash?: Hex;
  purchaseRequested?: boolean;
};
const messages: Record<string, string> = {
  AUTH_REQUIRED: "Your session has ended. Sign in to continue.",
  ORIGIN_REJECTED:
    "Open this app at its configured localhost address to continue.",
  ACCESS_EXPIRED: "This pass has expired. Pick a new pass to keep going.",
  ACCESS_NOT_ACTIVE:
    "Your pass is not active yet. Wait for activation and try again.",
  ACCESS_CHECK_UNAVAILABLE:
    "Access verification is temporarily unavailable. Your request was not run.",
  ISSUER_BUSY:
    "Another activation is being confirmed. Please retry in a moment.",
  INVALID_INPUT: "Check your input and try again.",
  PUBLISHER_NOT_AUTHORIZED:
    "Publishing on testnet requires the market operator wallet. You can still export a draft.",
  RATE_LIMITED: "Too many requests. Wait one minute, then try again.",
  RECEIPT_NOT_FINAL:
    "The receipt will be ready after the pass expires and all requests finish.",
  PLAN_NOT_FOUND: "This offer is no longer available in the catalog.",
  PAYMENT_NOT_CONFIRMED:
    "The transaction is still confirming. Resume activation in a moment.",
  PAYMENT_REVERTED: "This transaction failed on-chain. No pass was created.",
};
export class ApiError extends Error {
  constructor(public code: string) {
    super(
      messages[code] ??
        `${code.replaceAll("_", " ").toLowerCase()}. Please retry or check the server configuration.`,
    );
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(result.error?.code ?? "REQUEST_FAILED");
  }
  return result;
}
export const price = (value: string) =>
  (Number(value) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 });
export const duration = (seconds: number) =>
  seconds < 60
    ? `${seconds} sec`
    : seconds < 3600
      ? `${seconds / 60} min`
      : `${seconds / 3600} hr`;
export const short = (id: string) => `${id.slice(0, 6)}…${id.slice(-4)}`;
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function saved<T>(key: string): T | undefined {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
}
