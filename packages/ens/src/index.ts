/**
 * ENS adapter (browser and server). Read-only: the app never writes ENS records.
 *
 * A provider can link an ENS name they own to a service. The name is the
 * human-readable, machine-resolvable address of the API:
 *
 *   addr(name)                        → payout wallet   (verified by the server at publish time)
 *   text(name, "com.apiritivo.service") → Arkiv service_id
 *   contenthash(name)                 → bzz://<manifest_ref>  (EIP-1577, Swarm is a native ENS content type)
 *
 * Names are resolved through viem's universal resolver on the chain picked by
 * NEXT_PUBLIC_ENS_CHAIN ("sepolia", the default, or "mainnet").
 */

import { type Address, createPublicClient, type Hex, http, type PublicClient } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { namehash, normalize } from "viem/ens";

export const ENS_SERVICE_TEXT_KEY = "com.apiritivo.service";

export type EnsChainName = "sepolia" | "mainnet";

function chainName(): EnsChainName {
  // Plain `process.env.NEXT_PUBLIC_*` member reads: the only form Next inlines into the browser bundle.
  const raw = process.env.NEXT_PUBLIC_ENS_CHAIN || "sepolia";
  return raw.trim().toLowerCase() === "mainnet" ? "mainnet" : "sepolia";
}

export function ensChain() {
  return chainName() === "mainnet" ? mainnet : sepolia;
}

function rpcUrl(): string | undefined {
  const server = process.env.ENS_RPC_URL?.trim();
  const pub = process.env.NEXT_PUBLIC_ENS_RPC_URL?.trim();
  return server || pub || undefined;
}

let cached: PublicClient | undefined;
function client(): PublicClient {
  if (!cached) cached = createPublicClient({ chain: ensChain(), transport: http(rpcUrl()) }) as PublicClient;
  return cached;
}

/**
 * Sepolia runs the ENSv2 beta. Its UniversalResolverV2 resolves names registered
 * through the v2 app (app.ens.dev) and falls back to legacy v1 names; viem's
 * default on Sepolia is the v1 resolver, which does not see v2 names.
 * Override with NEXT_PUBLIC_ENS_UNIVERSAL_RESOLVER if ENS moves it.
 */
const SEPOLIA_UNIVERSAL_RESOLVER_V2: Address = "0x4a1817d13e9cf196f471725176355c1234b63c70";
function universalResolverAddress(): Address | undefined {
  const fromEnv = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_ENS_UNIVERSAL_RESOLVER?.trim() : undefined;
  if (fromEnv && /^0x[0-9a-fA-F]{40}$/.test(fromEnv)) return fromEnv as Address;
  return chainName() === "sepolia" ? SEPOLIA_UNIVERSAL_RESOLVER_V2 : undefined;
}

/** ENS manager app for the configured chain: app.ens.domains on mainnet, the ENSv2 beta app (app.ens.dev) on Sepolia. */
export function ensAppUrl(name: string): string {
  const fromEnv = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_ENS_APP_URL?.trim().replace(/\/+$/, "") : undefined;
  const base = fromEnv || (chainName() === "mainnet" ? "https://app.ens.domains" : "https://app.ens.dev");
  return `${base}/${name}`;
}

export function ensChainLabel(): string {
  return chainName() === "mainnet" ? "Ethereum mainnet" : "Sepolia";
}

const NAME_RE = /^(?=.{3,253}$)([a-z0-9-]+\.)+eth$/;

/** Lowercase + UTS-46 normalised ENS name, or null when it is not a valid `.eth` name. */
export function normalizeEnsName(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const n = normalize(trimmed);
    return NAME_RE.test(n) ? n : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ contenthash */

/** EIP-1577 Swarm contenthash: e4 01 01 fa 01 1b 20 + 32-byte reference. */
const SWARM_PREFIX = "e40101fa011b20";

export function swarmContenthash(manifestRef: string): Hex {
  const ref = manifestRef.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(ref)) throw new Error("Swarm contenthash needs a 32-byte reference.");
  return `0x${SWARM_PREFIX}${ref}`;
}

/** Inverse of `swarmContenthash`; null for empty or non-Swarm hashes. */
export function swarmRefFromContenthash(contenthash: string | null | undefined): string | null {
  if (!contenthash) return null;
  const hex = contenthash.toLowerCase().replace(/^0x/, "");
  if (!hex.startsWith(SWARM_PREFIX) || hex.length !== SWARM_PREFIX.length + 64) return null;
  return hex.slice(SWARM_PREFIX.length);
}

/* ------------------------------------------------------------ resolution */

export type EnsServiceRecords = {
  name: string;
  /** addr record (coinType 60). */
  address: Address | null;
  /** `com.apiritivo.service` text record. */
  serviceId: string | null;
  /** Swarm reference decoded from the contenthash, if it is a bzz hash. */
  manifestRef: string | null;
  /** Raw contenthash for display. */
  contenthash: string | null;
};

/** Forward resolution of the address record only (server-side ownership check). */
export async function resolveEnsAddress(name: string): Promise<Address | null> {
  const n = normalizeEnsName(name);
  if (!n) return null;
  return client().getEnsAddress({ name: n, universalResolverAddress: universalResolverAddress() });
}

const contenthashAbi = [
  { type: "function", name: "contenthash", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }], outputs: [{ name: "", type: "bytes" }] },
] as const;

/** viem has no contenthash action: find the name's resolver and read `contenthash(node)` from it. */
async function readContenthash(c: PublicClient, name: string): Promise<string | null> {
  try {
    const resolver = await c.getEnsResolver({ name, universalResolverAddress: universalResolverAddress() });
    if (!resolver || /^0x0{40}$/.test(resolver)) return null;
    const hash = await c.readContract({ address: resolver, abi: contenthashAbi, functionName: "contenthash", args: [namehash(name)] });
    return hash && hash !== "0x" ? hash : null;
  } catch {
    return null;
  }
}

/** Everything APIritivo reads from a name. Missing records come back as null, never throw for "not set". */
export async function resolveServiceRecords(name: string): Promise<EnsServiceRecords> {
  const n = normalizeEnsName(name);
  if (!n) throw new Error("Invalid ENS name.");
  const c = client();
  const [address, serviceId, contenthash] = await Promise.all([
    c.getEnsAddress({ name: n, universalResolverAddress: universalResolverAddress() }).catch(() => null),
    c.getEnsText({ name: n, key: ENS_SERVICE_TEXT_KEY, universalResolverAddress: universalResolverAddress() }).catch(() => null),
    readContenthash(c, n),
  ]);
  return { name: n, address, serviceId: serviceId || null, manifestRef: swarmRefFromContenthash(contenthash), contenthash };
}

/** Records a provider must set in the ENS app so a name fully describes a service. */
export function recordsForService(params: {
  serviceId: string;
  manifestRef: string;
  payoutAddress: string;
}): { kind: "addr" | "text" | "contenthash"; key: string; value: string }[] {
  return [
    { kind: "addr", key: "ETH address", value: params.payoutAddress },
    { kind: "text", key: ENS_SERVICE_TEXT_KEY, value: params.serviceId },
    { kind: "contenthash", key: "Content hash", value: `bzz://${params.manifestRef}` },
  ];
}

export type EnsVerification = {
  addressOk: boolean;
  serviceOk: boolean;
  manifestOk: boolean;
  /** All three records point at this service. */
  complete: boolean;
};

export function verifyServiceRecords(records: EnsServiceRecords, service: { serviceId: string; manifestRef: string; payoutAddress?: string }): EnsVerification {
  const addressOk = Boolean(records.address && service.payoutAddress && records.address.toLowerCase() === service.payoutAddress.toLowerCase());
  const serviceOk = records.serviceId === service.serviceId;
  const manifestOk = Boolean(records.manifestRef && records.manifestRef === service.manifestRef.toLowerCase());
  return { addressOk, serviceOk, manifestOk, complete: addressOk && serviceOk && manifestOk };
}
