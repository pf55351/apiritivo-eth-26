/**
 * Swarm ID adapter. BROWSER ONLY (the SDK talks to an iframe).
 *
 * The exported names are OUR adapter API. Internally we call the exact
 * `@snaha/swarm-id` `SwarmIdClient` methods: initialize, connect, disconnect,
 * connectionInfo, uploadData, downloadData, destroy.
 */
import type { SwarmIdClient, ConnectionInfo as SdkConnectionInfo } from "@snaha/swarm-id";
import {
  manifestFromBytes,
  manifestToBytes,
  type ManifestValidation,
  type ServiceManifest,
} from "@apiritivo/shared";

export type SwarmIdentity = {
  id: string;
  name: string;
  address: string;
  avatarUrl?: string;
  /** Compressed public key of the identity, when the proxy exposes it. */
  publicKey?: string;
  /** Account-wide sharing key: what other users grant ACT access to. */
  sharingPublicKey?: string;
};

export type UploadMode = "user-stamp" | "subsidised" | "unavailable";

export type SwarmConnectionInfo = {
  identity: SwarmIdentity | null;
  /** Public key of this identity's app-scoped key (valid as ACT grantee in this app). */
  appPublicKey?: string;
  canUpload: boolean;
  uploadMode?: UploadMode;
  uploadUnavailableReason?: "no-stamp" | "stamper-failed";
};

export type SwarmAdapterConfig = {
  iframeOrigin: string;
  appName: string;
  appDescription?: string;
  /** Optional public Bee/gateway URL used as a download fallback. */
  gatewayUrl?: string;
  /**
   * Subsidised gateway: a Bee endpoint that stamps uploads on behalf of users
   * without a postage stamp. When set, identities with no drive still get
   * `canUpload = true` with `uploadMode = "subsidised"` (exactly what the
   * official Swarm ID demo does with `https://api.gateway.ethswarm.org/`).
   */
  subsidisedGatewayUrl?: string;
  /**
   * Id of a DOM element that will host the Swarm ID iframe. Without it the SDK
   * pins its own "Login with Swarm ID" widget fixed in the bottom-right corner
   * of the page. The app keeps this host mounted and reveals it in a dialog
   * so the user can sign in directly through the SDK button.
   */
  containerId?: string;
  /** Log SDK connection events to the console (dev only). */
  debug?: boolean;
  onConnectionChange?: (info: SwarmConnectionInfo) => void;
};

export class SwarmError extends Error {
  readonly code:
    | "not-initialized"
    | "login-failed"
    | "upload-unavailable"
    | "upload-failed"
    | "download-failed"
    | "invalid-manifest"
    | "act-failed";
  readonly cause?: unknown;
  constructor(code: SwarmError["code"], message: string, cause?: unknown) {
    super(message);
    this.name = "SwarmError";
    this.code = code;
    this.cause = cause;
  }
}

export const DISCONNECTED: SwarmConnectionInfo = { identity: null, canUpload: false };

let client: SwarmIdClient | undefined;
let initPromise: Promise<void> | undefined;
let config: SwarmAdapterConfig | undefined;
let lastInfo: SwarmConnectionInfo = DISCONNECTED;

function log(...args: unknown[]): void {
  if (config?.debug) console.info("[swarm]", ...args);
}

function normalise(info: SdkConnectionInfo): SwarmConnectionInfo {
  return {
    identity: info.identity
      ? {
          id: info.identity.id,
          name: info.identity.name,
          address: info.identity.address,
          avatarUrl: info.identity.avatar?.url,
          publicKey: info.identity.publicKey,
          sharingPublicKey: info.identity.sharingPublicKey,
        }
      : null,
    appPublicKey: info.appKey?.publicKey,
    canUpload: Boolean(info.canUpload),
    uploadMode: info.uploadMode,
    uploadUnavailableReason: info.uploadUnavailableReason,
  };
}

/**
 * Create the hidden Swarm ID iframe. Idempotent; safe to call from React
 * effects. Rejects with SwarmError("login-failed") when the iframe cannot
 * be initialised (offline, wrong origin…).
 */
export function initSwarm(cfg: SwarmAdapterConfig): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new SwarmError("not-initialized", "Swarm ID is only available in the browser."));
  }
  config = cfg;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let instance: SwarmIdClient | undefined;
    try {
      const { SwarmIdClient } = await import("@snaha/swarm-id");
      instance = new SwarmIdClient({
        iframeOrigin: cfg.iframeOrigin,
        subsidisedGatewayUrl: cfg.subsidisedGatewayUrl,
        containerId: cfg.containerId,
        popupMode: "popup",
        metadata: { name: cfg.appName, description: cfg.appDescription },
        onConnectionChange: (info) => {
          lastInfo = normalise(info);
          log("connection changed", lastInfo);
          config?.onConnectionChange?.(lastInfo);
        },
      });
      await instance.initialize();
      instance.getAuthIframe().title = "Swarm ID sign-in";
      client = instance;
      lastInfo = normalise(instance.connectionInfo);
      log("initialised", { iframeOrigin: cfg.iframeOrigin, origin: window.location.origin }, lastInfo);
      config?.onConnectionChange?.(lastInfo);
    } catch (err) {
      instance?.destroy();
      client = undefined;
      initPromise = undefined;
      throw new SwarmError("login-failed", "Swarm ID login failed.", err);
    }
  })();

  return initPromise;
}

function requireClient(): SwarmIdClient {
  if (!client) throw new SwarmError("not-initialized", "Swarm ID is not ready yet.");
  return client;
}

export function isSwarmReady(): boolean {
  return client !== undefined;
}

/** Synchronous snapshot of the current session. */
export function getConnectionInfo(): SwarmConnectionInfo {
  if (!client) return lastInfo;
  try {
    lastInfo = normalise(client.connectionInfo);
  } catch {
    /* not initialised yet */
  }
  return lastInfo;
}

/** Opens the Swarm ID popup. Resolves when the popup was opened; the
 * identity arrives through `onConnectionChange`. */
export async function connect(): Promise<void> {
  const c = requireClient();
  try {
    log("connect(): opening popup");
    await c.connect({ popupMode: "popup" });
    log("connect(): popup opened, waiting for the session handover");
  } catch (err) {
    log("connect(): failed", err);
    throw new SwarmError("login-failed", "Swarm ID login failed.", err);
  }
  void watchHandover(c);
}

const HANDOVER_POLL_MS = 3_000;
const HANDOVER_POLL_MAX = 40;

/**
 * After the popup opens, poll the proxy's auth status so the console shows
 * whether the popup's session ever reaches the iframe (it does not when the
 * browser partitions third-party storage, e.g. Brave Shields). If the proxy
 * reports a session that `onConnectionChange` missed, publish it.
 */
async function watchHandover(c: SwarmIdClient): Promise<void> {
  for (let i = 0; i < HANDOVER_POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, HANDOVER_POLL_MS));
    if (client !== c) return;
    if (lastInfo.identity) {
      log("handover complete", lastInfo.identity);
      return;
    }
    try {
      const status = await c.checkAuthStatus();
      log(`handover poll ${i + 1}/${HANDOVER_POLL_MAX}`, status);
      if (status.authenticated) {
        const info = normalise(c.connectionInfo);
        if (info.identity) {
          lastInfo = info;
          config?.onConnectionChange?.(info);
          return;
        }
      }
    } catch (err) {
      log(`handover poll ${i + 1}/${HANDOVER_POLL_MAX} failed`, err);
    }
  }
  log("handover never arrived: the popup's session is not visible to the iframe (third-party storage blocked?)");
}

export async function disconnect(): Promise<void> {
  const c = requireClient();
  await c.disconnect();
  lastInfo = DISCONNECTED;
  config?.onConnectionChange?.(lastInfo);
}

export type UploadedManifest = {
  reference: string;
  bytes: number;
  /** Which path stored the bytes: the Swarm ID proxy, or a direct POST to the public gateway. */
  via: "swarm-id" | "gateway";
};

async function uploadViaGateway(bytes: Uint8Array): Promise<string | null> {
  const gateway = config?.gatewayUrl?.replace(/\/+$/, "");
  if (!gateway) return null;
  const res = await fetch(`${gateway}/bytes`, {
    method: "POST",
    // Only headers on the gateway's CORS allow-list. No Swarm-Pin: it is not allowed and
    // makes the preflight fail ("Failed to fetch").
    headers: { "content-type": "application/octet-stream" },
    body: bytes as BodyInit,
  });
  if (!res.ok) throw new Error(`Gateway upload responded ${res.status}`);
  const json = (await res.json()) as { reference?: string };
  if (!json.reference) throw new Error("Gateway upload returned no reference");
  return json.reference;
}

/**
 * Upload the reduced manifest as raw JSON bytes. Returns the Swarm reference.
 *
 * Preferred path: Swarm ID `uploadData` (user stamp or subsidised gateway).
 * Fallback: direct POST to the configured public gateway, which stamps on
 * our behalf. Both store the same bytes, so the reference is equivalent.
 */
export async function uploadServiceManifest(manifest: ServiceManifest): Promise<UploadedManifest> {
  const c = requireClient();
  const info = getConnectionInfo();
  if (!info.identity) throw new SwarmError("login-failed", "Sign in with Swarm ID before publishing.");
  const bytes = manifestToBytes(manifest);

  let primaryError: unknown;
  if (info.canUpload) {
    try {
      const result = await c.uploadData(bytes);
      return { reference: result.reference, bytes: bytes.byteLength, via: "swarm-id" };
    } catch (err) {
      primaryError = err;
    }
  }

  try {
    const reference = await uploadViaGateway(bytes);
    if (reference) return { reference, bytes: bytes.byteLength, via: "gateway" };
  } catch (err) {
    primaryError = primaryError ?? err;
  }

  if (!info.canUpload && !primaryError) {
    throw new SwarmError("upload-unavailable", "Swarm upload unavailable for this identity.");
  }
  throw new SwarmError("upload-failed", "Manifest upload failed.", primaryError);
}

async function downloadViaGateway(reference: string): Promise<Uint8Array | null> {
  const gateway = config?.gatewayUrl?.replace(/\/+$/, "");
  if (!gateway) return null;
  const res = await fetch(`${gateway}/bytes/${reference}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Download + validate a manifest by Swarm reference. */
export async function downloadServiceManifest(reference: string): Promise<ServiceManifest> {
  let bytes: Uint8Array | null = null;
  let primaryError: unknown;

  if (client) {
    try {
      bytes = await client.downloadData(reference, { timeoutMs: 30_000 });
    } catch (err) {
      primaryError = err;
    }
  }

  if (!bytes) {
    try {
      bytes = await downloadViaGateway(reference);
    } catch (err) {
      primaryError = primaryError ?? err;
    }
  }

  if (!bytes) {
    throw new SwarmError("download-failed", "Manifest could not be downloaded.", primaryError);
  }

  const validation: ManifestValidation = manifestFromBytes(bytes);
  if (!validation.ok) {
    throw new SwarmError("invalid-manifest", `Manifest is invalid: ${validation.errors.join("; ")}`);
  }
  return validation.manifest;
}

/**
 * Derive a 32-byte secret bound to this identity + app origin, via the SDK's
 * `deriveAppSecret`. Used as the private key of the provider/client "Swarm
 * wallet": same identity → same secret → same EVM address on every device.
 * The secret never leaves the browser.
 */
// The label is a derivation seed, not a brand string: it stays "apiperitivo" so that
// wallets derived before the rename to APIritivo keep the same address.
export async function deriveWalletSecret(label = "apiperitivo:wallet:v1"): Promise<Uint8Array> {
  const c = requireClient();
  if (!getConnectionInfo().identity) throw new SwarmError("login-failed", "Sign in with Swarm ID first.");
  const secret = await c.deriveAppSecret(label);
  if (!(secret instanceof Uint8Array) || secret.byteLength !== 32) {
    throw new SwarmError("login-failed", "Swarm ID returned an unexpected secret length.");
  }
  return secret;
}

/**
 * The postage stamp ("drive") Swarm ID resolved for this app. Read-only: the
 * dApp cannot pick a stamp, the user selects the default drive (or a per-app
 * override) inside Swarm ID. Uses the SDK's `getPostageBatch`.
 */
export type SwarmDrive = {
  batchId: string;
  label: string;
  /** Storage used, 0-100. */
  usedPercent: number;
  /** Seconds of prepaid lifetime left, if the proxy reports it. */
  ttlSeconds?: number;
  usable: boolean;
};

type RawBatch = {
  batchID: string;
  label: string;
  utilization: number;
  depth: number;
  bucketDepth: number;
  batchTTL?: number;
  usable: boolean;
};

/** Pure mapping from the SDK batch shape (exported for tests). Bee semantics:
 * usage = utilization / 2^(depth - bucketDepth). */
export function driveFromBatch(batch: RawBatch): SwarmDrive {
  const slots = Math.pow(2, Math.max(0, batch.depth - batch.bucketDepth));
  const used = slots > 0 ? (batch.utilization / slots) * 100 : 0;
  return {
    batchId: batch.batchID,
    label: batch.label,
    usedPercent: Math.min(100, Math.max(0, Math.round(used * 10) / 10)),
    ttlSeconds: typeof batch.batchTTL === "number" && Number.isFinite(batch.batchTTL) ? Math.max(0, batch.batchTTL) : undefined,
    usable: Boolean(batch.usable),
  };
}

/** Null when signed out, on the subsidised gateway, or when no drive is configured. */
export async function getSwarmDrive(): Promise<SwarmDrive | null> {
  const c = requireClient();
  if (!getConnectionInfo().identity) return null;
  const batch = await c.getPostageBatch();
  if (!batch) return null;
  return driveFromBatch(batch);
}

/**
 * 32-byte key that encrypts access-pass secrets for this identity (AES-GCM,
 * see packages/arkiv pass-secret.ts). Different label than the wallet, so the
 * wallet key never doubles as an encryption key. Same identity → same key on
 * every device; never leaves the browser.
 */
export function derivePassEncryptionKey(): Promise<Uint8Array> {
  return deriveWalletSecret("apiritivo:pass-crypt:v1");
}

/* ---------- Private files: Swarm ACT (Access Control Trie) ---------- */

/**
 * The key another user must grant to let this identity read ACT content:
 * the account-wide sharing key when available, else the app key.
 */
export function getGranteeKey(): string | undefined {
  const info = getConnectionInfo();
  return info.identity?.sharingPublicKey ?? info.appPublicKey ?? info.identity?.publicKey;
}

export type PrivateUpload = {
  /** Reference of the encrypted content; stays the same across grants. */
  encryptedRef: string;
  /** History reference right after upload; every grant produces a newer one. */
  historyRef: string;
  /** The publisher's compressed public key: readers need it to decrypt. */
  publisherPubKey: string;
  bytes: number;
};

/**
 * Upload a private file with ACT. Nobody but the publisher can read it until
 * `grantPrivateFile` adds a buyer. Uses the SDK's `actUploadData`.
 */
export async function uploadPrivateFile(bytes: Uint8Array): Promise<PrivateUpload> {
  const c = requireClient();
  const info = getConnectionInfo();
  if (!info.identity) throw new SwarmError("login-failed", "Sign in with Swarm ID before publishing.");
  if (!info.canUpload) throw new SwarmError("upload-unavailable", "Swarm upload unavailable for this identity.");
  try {
    const result = await c.actUploadData(bytes, []);
    return { encryptedRef: result.encryptedReference, historyRef: result.historyReference, publisherPubKey: result.publisherPubKey, bytes: bytes.byteLength };
  } catch (err) {
    throw new SwarmError("act-failed", "Private file upload failed.", err);
  }
}

/** Add a reader. Only the publisher can do this. Returns the new history reference to publish. */
export async function grantPrivateFile(historyRef: string, granteeKey: string): Promise<{ historyRef: string }> {
  const c = requireClient();
  try {
    const result = await c.actAddGrantees(historyRef, [granteeKey]);
    return { historyRef: result.historyReference };
  } catch (err) {
    throw new SwarmError("act-failed", "Granting access failed.", err);
  }
}

/** Download and decrypt a private file. Fails unless this identity is the publisher or a grantee. */
export async function downloadPrivateFile(params: { encryptedRef: string; historyRef: string; publisherPubKey: string }): Promise<Uint8Array> {
  const c = requireClient();
  if (!getConnectionInfo().identity) throw new SwarmError("login-failed", "Sign in with Swarm ID first.");
  try {
    return await c.actDownloadData(params.encryptedRef, params.historyRef, params.publisherPubKey, undefined, { timeout: 60_000 });
  } catch (err) {
    throw new SwarmError("act-failed", "Private file could not be downloaded.", err);
  }
}

/** Tear down the iframe (used on hot reload / unmount). */
export function destroySwarm(): void {
  try {
    client?.destroy();
  } finally {
    client = undefined;
    initPromise = undefined;
    lastInfo = DISCONNECTED;
  }
}

/** Link to a public Swarm resource for the proof chip (informational). */
export function swarmReferenceUrl(reference: string): string | undefined {
  const gateway = config?.gatewayUrl?.replace(/\/+$/, "");
  return gateway ? `${gateway}/bytes/${reference}` : undefined;
}
