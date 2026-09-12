import { tiramisu } from "@arkiv-network/sdk/chains";
import type { Chain } from "viem";

/**
 * Chain + RPC resolution shared by the read adapter (browser or server)
 * and the server writer.
 */
export function resolveChain(): Chain {
  return tiramisu;
}

/** Public RPC URL used for reads. Falls back to the chain default. */
export function resolveReadRpcUrl(): string | undefined {
  const fromEnv = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ARKIV_RPC_URL) || undefined;
  return fromEnv && fromEnv.trim().length > 0 ? fromEnv.trim() : undefined;
}
