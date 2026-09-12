/**
 * Arkiv server writer adapter. SERVER ONLY.
 *
 * Trust model (Phase 1 / hackathon boundary):
 *  - Writes are signed by an app-owned key from `ARKIV_WRITER_PRIVATE_KEY`.
 *  - The `providerId` / `providerName` come from the caller's Swarm ID session
 *    and are trusted as-is. There is no signature from the Swarm identity, so
 *    this route must never be exposed as a trustless publishing endpoint.
 */

import {
  ACCESS_PASS_ENTITY_TYPE,
  APP_ID,
  type ArkivService,
  GRANT_ENTITY_TYPE,
  type IssueAccessPassResult,
  type PublishGrantInput,
  type PublishGrantResult,
  type PublishServiceInput,
  type PublishServiceResult,
  SALE_ENTITY_TYPE,
  SERVICE_ENTITY_TYPE,
} from "@apiritivo/shared";
import { createPublicClient, createWalletClient, ExpirationTime, jsonToPayload } from "@arkiv-network/sdk";
import { addr, bool, dec, i32, str, u64 } from "@arkiv-network/sdk/attr";
import { formatEther, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChain } from "./config";
import { ATTR } from "./entity";

export class ArkivWriterNotConfiguredError extends Error {
  constructor() {
    super("Arkiv writer is not configured. Set ARKIV_WRITER_PRIVATE_KEY on the server.");
    this.name = "ArkivWriterNotConfiguredError";
  }
}

function writerPrivateKey(): Hex | undefined {
  const raw = process.env.ARKIV_WRITER_PRIVATE_KEY?.trim();
  if (!raw) return undefined;
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(hex) ? (hex as Hex) : undefined;
}

export function isWriterConfigured(): boolean {
  return writerPrivateKey() !== undefined;
}

function writeRpcUrl(): string | undefined {
  const fromEnv = process.env.ARKIV_RPC_URL?.trim() || process.env.NEXT_PUBLIC_ARKIV_RPC_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : undefined;
}

export function writerAddress(): Hex | undefined {
  const pk = writerPrivateKey();
  return pk ? privateKeyToAccount(pk).address : undefined;
}

export type WriterStatus = {
  configured: boolean;
  address?: Hex;
  /** Native GLM balance, formatted; undefined when the RPC is unreachable. */
  balance?: string;
  funded?: boolean;
  chainId: number;
  /** Tiramisu block explorer: balance + transactions of the writer. */
  explorerUrl?: string;
  /** Arkiv Data Explorer: every entity the writer owns. */
  dataExplorerUrl?: string;
  faucetUrl: string;
};

export const ARKIV_FAUCET_URL = "https://hub.arkiv.network/faucet";

import { ARKIV_EXPLORER_URL, arkivOwnerUrl } from "./index";

export { ARKIV_EXPLORER_URL };

/** Health of the app-owned writer (no secrets). Used by the provider dashboard. */
export async function getWriterStatus(): Promise<WriterStatus> {
  const chain = resolveChain();
  const address = writerAddress();
  if (!address) return { configured: false, chainId: chain.id, faucetUrl: ARKIV_FAUCET_URL };
  let balance: string | undefined;
  let funded: boolean | undefined;
  try {
    const client = createPublicClient({ chain, transport: http(writeRpcUrl()) });
    const wei = await client.getBalance({ address });
    balance = formatEther(wei);
    funded = wei > 0n;
  } catch {
    /* RPC unreachable: report unknown */
  }
  return {
    configured: true,
    address,
    balance,
    funded,
    chainId: chain.id,
    explorerUrl: `${ARKIV_EXPLORER_URL}/address/${address}`,
    dataExplorerUrl: arkivOwnerUrl(address),
    faucetUrl: ARKIV_FAUCET_URL,
  };
}

/**
 * Create the long-lived service entity on Arkiv. Must only be called after
 * the manifest is already on Swarm (input.manifestRef).
 */
export async function publishService(input: PublishServiceInput): Promise<PublishServiceResult> {
  const pk = writerPrivateKey();
  if (!pk) throw new ArkivWriterNotConfiguredError();

  const client = createWalletClient({
    chain: resolveChain(),
    transport: http(writeRpcUrl()),
    account: privateKeyToAccount(pk),
  });

  // Attribute names are snake_case on the wire: the Tiramisu engine rejects uppercase
  // letters in attribute names (verified 2026-09-12), even though the SDK's local
  // validator accepts them. Our TypeScript shape stays camelCase (see ATTR in entity.ts).
  const attributes = {
    [ATTR.app]: str(APP_ID),
    [ATTR.entityType]: str(SERVICE_ENTITY_TYPE),
    [ATTR.serviceId]: str(input.serviceId),
    [ATTR.category]: str(input.category),
    [ATTR.providerId]: str(input.providerId),
    [ATTR.providerName]: str(input.providerName ?? ""),
    [ATTR.available]: bool(true),
    [ATTR.version]: i32(1),
    [ATTR.manifestRef]: str(input.manifestRef),
    // Commercial terms of one access pass (Phase 2 will sell exactly this). Kept on Arkiv,
    // not in the Swarm manifest, because they are discovery metadata and may change.
    [ATTR.priceUsdc]: dec(input.priceUsdc),
    [ATTR.accessSeconds]: u64(input.accessSeconds),
    // Where USDC payments go (Avalanche Fuji). Lives on Arkiv, not in the Swarm manifest.
    [ATTR.payoutAddress]: addr(input.payoutAddress),
    // Optional ENS name (route verified addr(name) == payoutAddress). Queryable so `name.eth` → service works even before the text record exists.
    ...(input.ensName ? { [ATTR.ensName]: str(input.ensName) } : {}),
    // Optional private file on Swarm (ACT). References are public, the content is not.
    ...(input.privateAttachment
      ? {
          [ATTR.privateName]: str(input.privateAttachment.name),
          [ATTR.privateBytes]: u64(input.privateAttachment.bytes),
          [ATTR.privateType]: str(input.privateAttachment.contentType ?? ""),
          [ATTR.privateEncRef]: str(input.privateAttachment.encryptedRef),
          [ATTR.privateHistoryRef]: str(input.privateAttachment.historyRef),
          [ATTR.privatePubkey]: str(input.privateAttachment.publisherPubKey),
        }
      : {}),
  };

  const { entityKey, txHash } = await client.createEntity({
    payload: jsonToPayload({ name: input.name, description: input.description }),
    contentType: "application/json",
    attributes,
    // Service listings never expire. Only the Phase 2 access passes (what a client buys) will carry a TTL.
    expires: ExpirationTime.permanent(),
  });

  return { entityKey, txHash, serviceId: input.serviceId };
}

function walletClient() {
  const pk = writerPrivateKey();
  if (!pk) throw new ArkivWriterNotConfiguredError();
  return createWalletClient({ chain: resolveChain(), transport: http(writeRpcUrl()), account: privateKeyToAccount(pk) });
}

/**
 * Issue an access pass after the USDC payment has been verified on-chain.
 *
 * Two entities are written:
 *  1. `access_pass` — expires after `service.accessSeconds`. Its entity key is
 *     the API key the buyer presents to the bot. Arkiv deletes it on expiry.
 *  2. `sale` — permanent receipt (tx hash, amount) so provider revenue survives
 *     the pass expiring.
 */
export async function issueAccessPass(params: {
  service: ArkivService;
  buyerId: string;
  buyerAddress: string;
  txHash: string;
  paidUsdc: string;
  chainId: number;
  /** keccak256(secret), stored in clear as `secret_hash`. */
  secretHash: string;
  /** Secret encrypted for the buyer, stored in the payload. The server never sees the secret. */
  encryptedSecret: string;
  /** Buyer's Swarm public key for ACT grants (optional). */
  buyerPublicKey?: string;
}): Promise<IssueAccessPassResult> {
  const { service } = params;
  if (!service.accessSeconds) throw new Error("Service has no access duration.");
  const client = walletClient();
  const txHash = params.txHash.toLowerCase();

  const common = {
    [ATTR.app]: str(APP_ID),
    [ATTR.serviceId]: str(service.serviceId),
    [ATTR.providerId]: str(service.providerId),
    [ATTR.buyerId]: str(params.buyerId),
    [ATTR.buyerAddress]: addr(params.buyerAddress),
    [ATTR.txHash]: str(txHash),
    [ATTR.paidUsdc]: dec(params.paidUsdc),
    [ATTR.chainId]: i32(params.chainId),
    ...(params.buyerPublicKey ? { [ATTR.buyerPublicKey]: str(params.buyerPublicKey) } : {}),
  };

  const pass = await client.createEntity({
    payload: jsonToPayload({ serviceName: service.name, purchasedAt: new Date().toISOString(), encryptedSecret: params.encryptedSecret }),
    contentType: "application/json",
    attributes: { ...common, [ATTR.entityType]: str(ACCESS_PASS_ENTITY_TYPE), [ATTR.secretHash]: str(params.secretHash.toLowerCase()) },
    expires: ExpirationTime.fromSeconds(service.accessSeconds),
  });

  const sale = await client.createEntity({
    payload: jsonToPayload({ serviceName: service.name, purchasedAt: new Date().toISOString() }),
    contentType: "application/json",
    attributes: { ...common, [ATTR.entityType]: str(SALE_ENTITY_TYPE), [ATTR.passKey]: str(pass.entityKey) },
    expires: ExpirationTime.permanent(),
  });

  const timing = await createPublicClient({ chain: resolveChain(), transport: http(writeRpcUrl()) }).getBlockTiming();
  const secondsLeft = Number(pass.expiresAt - BigInt(timing.currentBlock)) * Number(timing.blockDuration);
  const expiresAt = new Date((Number(timing.currentBlockTime) + secondsLeft) * 1000).toISOString();

  return {
    passKey: pass.entityKey,
    saleKey: sale.entityKey,
    txHash,
    paidUsdc: params.paidUsdc,
    expiresAtBlock: pass.expiresAt.toString(),
    expiresAt,
    arkivTxHashes: [pass.txHash, sale.txHash],
  };
}

/**
 * Record that the provider granted a buyer access to the service's private
 * file (Swarm ACT). Permanent; the newest grant carries the live history ref.
 */
export async function publishGrant(input: PublishGrantInput): Promise<PublishGrantResult> {
  const client = walletClient();
  const { entityKey, txHash } = await client.createEntity({
    payload: jsonToPayload({ grantedAt: new Date().toISOString() }),
    contentType: "application/json",
    attributes: {
      [ATTR.app]: str(APP_ID),
      [ATTR.entityType]: str(GRANT_ENTITY_TYPE),
      [ATTR.serviceId]: str(input.serviceId),
      [ATTR.providerId]: str(input.providerId),
      [ATTR.buyerId]: str(input.buyerId),
      [ATTR.buyerPublicKey]: str(input.buyerPublicKey),
      [ATTR.actHistoryRef]: str(input.historyRef),
      [ATTR.actEncRef]: str(input.encryptedRef),
      [ATTR.actPubkey]: str(input.publisherPubKey),
    },
    expires: ExpirationTime.permanent(),
  });
  return { grantKey: entityKey, txHash };
}
