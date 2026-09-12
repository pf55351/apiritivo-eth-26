import { tiramisu } from "@arkiv-network/sdk/chains";
import type { Chain, Hex } from "viem";

/**
 * Chain + RPC resolution shared by the read adapter (browser or server)
 * and the server writer.
 *
 * Every `process.env.NEXT_PUBLIC_*` read below is a plain member expression on
 * purpose: Next only inlines that exact form into the browser bundle.
 */
export function resolveChain(): Chain {
  return tiramisu;
}

/** Public RPC URL used for reads. Falls back to the chain default. */
export function resolveReadRpcUrl(): string | undefined {
  const fromEnv = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ARKIV_RPC_URL : undefined;
  return fromEnv && fromEnv.trim().length > 0 ? fromEnv.trim() : undefined;
}

/** The app-owned Arkiv writer shipped in `.env.example` (testnet demo key). */
export const DEFAULT_WRITER_ADDRESS: Hex = "0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C";

/**
 * The only Arkiv owner whose entities the app trusts. Arkiv is a public chain:
 * anyone can write `app = apiritivo` attributes, so every read filters by this
 * address and every parser refuses entities owned by someone else.
 *
 * Override with `NEXT_PUBLIC_ARKIV_WRITER_ADDRESS` when running your own writer;
 * it must be the address of `ARKIV_WRITER_PRIVATE_KEY` or nothing is listed.
 */
export function trustedWriterAddress(): Hex {
  const fromEnv = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ARKIV_WRITER_ADDRESS : undefined;
  const value = fromEnv?.trim();
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Hex) : DEFAULT_WRITER_ADDRESS;
}
