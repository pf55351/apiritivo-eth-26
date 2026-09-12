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
import { createPublicClient, createWalletClient, ExpirationTime, jsonToPayload, type PublicArkivClient } from "@arkiv-network/sdk";
import { addr, bool, dec, i32, str, u64 } from "@arkiv-network/sdk/attr";
import { formatEther, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChain, trustedWriterAddress } from "./config";
import { ATTR } from "./entity";
import { ARKIV_EXPLORER_URL, arkivOwnerUrl, type BlockTiming, estimateBlockDate, getAccessPass } from "./index";

export { ARKIV_EXPLORER_URL };

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

/** Writes may use a dedicated RPC; reads in this module use the same one so a fresh write is visible. */
function writeRpcUrl(): string | undefined {
  const fromEnv = process.env.ARKIV_RPC_URL?.trim() || process.env.NEXT_PUBLIC_ARKIV_RPC_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : undefined;
}

function writerAddress(): Hex | undefined {
  const pk = writerPrivateKey();
  return pk ? privateKeyToAccount(pk).address : undefined;
}

let cachedReader: PublicArkivClient | undefined;

/** Public client on the write RPC (cached; no key involved). */
function reader(): PublicArkivClient {
  if (!cachedReader) cachedReader = createPublicClient({ chain: resolveChain(), transport: http(writeRpcUrl()) }) as unknown as PublicArkivClient;
  return cachedReader;
}

function walletClient() {
  const pk = writerPrivateKey();
  if (!pk) throw new ArkivWriterNotConfiguredError();
  return createWalletClient({ chain: resolveChain(), transport: http(writeRpcUrl()), account: privateKeyToAccount(pk) });
}

async function writeBlockTiming(): Promise<BlockTiming> {
  const t = await reader().getBlockTiming();
  return { currentBlock: BigInt(t.currentBlock), currentBlockTime: Number(t.currentBlockTime), blockDuration: Number(t.blockDuration) };
}

export type WriterStatus = {
  configured: boolean;
  address?: Hex;
  /** Native GLM balance, formatted; undefined when the RPC is unreachable. */
  balance?: string;
  funded?: boolean;
  /** The owner every read trusts (`NEXT_PUBLIC_ARKIV_WRITER_ADDRESS` or the shipped default). */
  trustedOwner: Hex;
  /** True when the writer key signs as a different address than reads trust: writes would be invisible. */
  ownerMismatch: boolean;
  chainId: number;
  /** Tiramisu block explorer: balance + transactions of the writer. */
  explorerUrl?: string;
  /** Arkiv Data Explorer: every entity the writer owns. */
  dataExplorerUrl?: string;
  faucetUrl: string;
};

export const ARKIV_FAUCET_URL = "https://hub.arkiv.network/faucet";

/** Health of the app-owned writer (no secrets). Used by the provider dashboard. */
export async function getWriterStatus(): Promise<WriterStatus> {
  const chain = resolveChain();
  const address = writerAddress();
  const trustedOwner = trustedWriterAddress();
  if (!address) return { configured: false, trustedOwner, ownerMismatch: false, chainId: chain.id, faucetUrl: ARKIV_FAUCET_URL };
  const ownerMismatch = address.toLowerCase() !== trustedOwner.toLowerCase();
  if (ownerMismatch) console.error(`[arkiv] ARKIV_WRITER_PRIVATE_KEY signs as ${address} but reads trust ${trustedOwner}: set NEXT_PUBLIC_ARKIV_WRITER_ADDRESS=${address}`);
  let balance: string | undefined;
  let funded: boolean | undefined;
  try {
    const wei = await reader().getBalance({ address });
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
    trustedOwner,
    ownerMismatch,
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
  const client = walletClient();

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
    // Commercial terms of one access pass. Kept on Arkiv, not in the Swarm manifest,
    // because they are discovery metadata and may change.
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
    // Service listings never expire. Only access passes (what a client buys) carry a TTL.
    expires: ExpirationTime.permanent(),
  });

  return { entityKey, txHash, serviceId: input.serviceId };
}

/**
 * Issue an access pass after the USDC payment has been verified on-chain.
 *
 * Two entities land in ONE Arkiv transaction (`executeBatch`), so a payment
 * either gets both or neither and a retry can never mint a second pass:
 *  1. `access_pass` — expires after `service.accessSeconds`. Its entity key is
 *     the API key the buyer presents to the bot. Arkiv deletes it on expiry.
 *  2. `sale` — permanent receipt (tx hash, amount, pass key) so provider
 *     revenue survives the pass expiring. It is also the replay guard.
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
  // Arkiv counts lifetimes in 2-second blocks; the publish schema enforces this, the guard keeps a
  // verified payment from ever reaching a write that must throw.
  if (service.accessSeconds % 2 !== 0) throw new Error(`Access duration ${service.accessSeconds}s is not a multiple of 2 seconds; the listing cannot be sold.`);
  const client = walletClient();
  const txHash = params.txHash.toLowerCase();
  const purchasedAt = new Date().toISOString();

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

  // The sale references the pass key, so the pass key must be known before the batch is sent.
  const [passSlot, saleSlot] = await reader().predictEntityKeys({ owner: client.account.address, count: 2 });
  const batch = await client.executeBatch({
    creates: [
      {
        salt: passSlot.salt,
        payload: jsonToPayload({ serviceName: service.name, purchasedAt, encryptedSecret: params.encryptedSecret }),
        contentType: "application/json",
        attributes: { ...common, [ATTR.entityType]: str(ACCESS_PASS_ENTITY_TYPE), [ATTR.secretHash]: str(params.secretHash.toLowerCase()) },
        expires: ExpirationTime.fromSeconds(service.accessSeconds),
      },
      {
        salt: saleSlot.salt,
        payload: jsonToPayload({ serviceName: service.name, purchasedAt }),
        contentType: "application/json",
        attributes: { ...common, [ATTR.entityType]: str(SALE_ENTITY_TYPE), [ATTR.passKey]: str(passSlot.key) },
        expires: ExpirationTime.permanent(),
      },
    ],
  });
  // The engine reports the keys it minted; prefer them over the prediction.
  const passKey = batch.createdEntities[0] ?? passSlot.key;
  const saleKey = batch.createdEntities[1] ?? saleSlot.key;

  const [pass, timing] = await Promise.all([getAccessPass(passKey), writeBlockTiming()]);
  const expiresAtBlock = pass?.expiresAtBlock ?? (timing.currentBlock + BigInt(service.accessSeconds / timing.blockDuration)).toString();

  return {
    passKey,
    saleKey,
    txHash,
    paidUsdc: params.paidUsdc,
    expiresAtBlock,
    expiresAt: estimateBlockDate(expiresAtBlock, timing).toISOString(),
    arkivTxHashes: [batch.txHash],
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
