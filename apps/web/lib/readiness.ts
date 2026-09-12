/**
 * Account readiness: what a signed-in identity still needs before it can act
 * in the current view. Pure functions, so the rules are testable without React.
 *
 * Client: USDC (pays for passes), AVAX (gas for approve + buy), GLM (the app
 * writer mints the pass on Arkiv). Provider: Swarm drive (stores manifests),
 * GLM (the writer publishes listings), AVAX (gas to claim earnings), USDC
 * (where earnings land, informational).
 */
import type { Role } from "@apiritivo/shared";
import { formatTtl } from "./format";

export type ReadinessState = "ok" | "low" | "missing" | "info" | "loading" | "unknown";

export type ReadinessCheck = {
  id: "usdc" | "avax" | "glm" | "drive";
  /** 1 to 3 words. */
  label: string;
  state: ReadinessState;
  /** Current amount or mode, shown next to the state. */
  value?: string;
  /** One short sentence: what this resource is for. */
  hint: string;
  /** Where to fix it (faucet, Swarm ID). */
  href?: string;
  hrefLabel?: string;
};

export type ReadinessInput = {
  view: Role;
  /** Client: `idle` means no browser wallet is connected yet. Provider: the Swarm wallet is always derived. */
  wallet: { status: "idle" | "deriving" | "ready" | "error"; balances: { avax: string; usdc: string } | null };
  writer: { funded?: boolean; balance?: string; faucetUrl?: string; ownerMismatch?: boolean } | null | undefined;
  drive: { mode?: "user-stamp" | "subsidised" | "unavailable"; ttlSeconds?: number; label?: string; usable?: boolean; manageUrl: string };
  faucets: { avax: string; usdc: string; glm: string };
};

/** Below this the buyer may not afford approve + buy on Fuji. */
export const AVAX_LOW_BELOW = 0.005;
/** A drive this close to expiry is flagged before uploads start failing. */
export const DRIVE_WARN_BELOW_SECONDS = 7 * 86_400;

function amount(value: string, digits: number): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : value;
}

function walletState(input: ReadinessInput): ReadinessState | null {
  if (input.wallet.status === "idle") return input.view === "client" ? "missing" : "loading";
  if (input.wallet.status === "deriving") return "loading";
  if (input.wallet.status === "error") return "unknown";
  if (!input.wallet.balances) return "loading";
  return null;
}

export function usdcCheck(input: ReadinessInput): ReadinessCheck {
  const pending = walletState(input);
  const base = { id: "usdc" as const, label: "USDC", href: input.faucets.usdc, hrefLabel: "USDC faucet" };
  const client = input.view === "client";
  const hint = client ? "Pays for access passes." : "Sales land here.";
  if (pending === "missing")
    return { ...base, state: "missing", value: "no wallet", hint: "Connected at checkout: MetaMask, Rabby or Core pays.", href: undefined, hrefLabel: undefined };
  if (pending) return { ...base, state: pending, hint };
  const usdc = Number(input.wallet.balances!.usdc);
  const value = amount(input.wallet.balances!.usdc, 2);
  if (!client) return { ...base, state: "info", value, hint, href: undefined, hrefLabel: undefined };
  return { ...base, state: usdc > 0 ? "ok" : "missing", value, hint };
}

export function avaxCheck(input: ReadinessInput): ReadinessCheck {
  const pending = walletState(input);
  const base = { id: "avax" as const, label: "AVAX", href: input.faucets.avax, hrefLabel: "AVAX faucet" };
  const hint = input.view === "client" ? "Gas for approve and buy." : "Gas to claim earnings.";
  if (pending === "missing")
    return { ...base, state: "missing", value: "no wallet", hint: "The wallet connected at checkout pays the gas.", href: undefined, hrefLabel: undefined };
  if (pending) return { ...base, state: pending, hint };
  const avax = Number(input.wallet.balances!.avax);
  const value = amount(input.wallet.balances!.avax, 4);
  const state: ReadinessState = avax <= 0 ? "missing" : avax < AVAX_LOW_BELOW ? "low" : "ok";
  return { ...base, state, value, hint };
}

export function glmCheck(input: ReadinessInput): ReadinessCheck {
  const base = { id: "glm" as const, label: "GLM writer", href: input.writer?.faucetUrl ?? input.faucets.glm, hrefLabel: "GLM faucet" };
  const hint = input.view === "client" ? "The app writer mints your pass on Arkiv." : "The app writer publishes your listing on Arkiv.";
  if (input.writer === undefined) return { ...base, state: "loading", hint };
  if (input.writer === null || input.writer.funded === undefined) return { ...base, state: "unknown", hint };
  if (input.writer.ownerMismatch) {
    return { ...base, state: "missing", hint: "The writer key does not match the trusted writer address; nothing it writes is listed.", href: undefined, hrefLabel: undefined };
  }
  const value = input.writer.balance ? amount(input.writer.balance, 3) : undefined;
  return { ...base, state: input.writer.funded ? "ok" : "missing", value, hint };
}

export function driveCheck(input: ReadinessInput): ReadinessCheck {
  const base = { id: "drive" as const, label: "Swarm drive", href: input.drive.manageUrl, hrefLabel: "Swarm ID" };
  const hint = "Stores manifests and private files.";
  const { mode, ttlSeconds, label, usable } = input.drive;
  if (!mode) return { ...base, state: "loading", hint };
  if (mode === "unavailable") return { ...base, state: "missing", value: "no drive", hint };
  if (mode === "subsidised") return { ...base, state: "ok", value: "shared gateway", hint, href: undefined, hrefLabel: undefined };
  const name = label || "own drive";
  if (usable === false) return { ...base, state: "missing", value: `${name} · not usable`, hint };
  if (ttlSeconds !== undefined && ttlSeconds < DRIVE_WARN_BELOW_SECONDS) {
    return { ...base, state: "low", value: `${name} · ${formatTtl(ttlSeconds)} left`, hint };
  }
  return { ...base, state: "ok", value: ttlSeconds !== undefined ? `${name} · ${formatTtl(ttlSeconds)} left` : name, hint };
}

export function buildChecks(input: ReadinessInput): ReadinessCheck[] {
  return input.view === "client" ? [usdcCheck(input), avaxCheck(input), glmCheck(input)] : [driveCheck(input), glmCheck(input), avaxCheck(input), usdcCheck(input)];
}

export type ReadinessSummary = {
  tone: "ok" | "warn" | "block" | "loading";
  /** Button text, 1 to 2 words. */
  label: string;
  missing: number;
  low: number;
};

export function summarize(checks: ReadinessCheck[]): ReadinessSummary {
  const missing = checks.filter((c) => c.state === "missing").length;
  const low = checks.filter((c) => c.state === "low").length;
  if (missing > 0) return { tone: "block", label: `${missing} missing`, missing, low };
  if (checks.some((c) => c.state === "loading")) return { tone: "loading", label: "Checking", missing, low };
  if (low > 0) return { tone: "warn", label: `${low} low`, missing, low };
  return { tone: "ok", label: "Ready", missing, low };
}

export function stateLabel(state: ReadinessState): string {
  switch (state) {
    case "ok":
      return "present";
    case "low":
      return "low";
    case "missing":
      return "missing";
    case "info":
      return "balance";
    case "loading":
      return "checking";
    default:
      return "unknown";
  }
}
