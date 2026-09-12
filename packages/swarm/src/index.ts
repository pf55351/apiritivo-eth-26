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
} from "@apiperitivo/shared";

export type SwarmIdentity = {
  id: string;
  name: string;
  address: string;
  avatarUrl?: string;
};

export type UploadMode = "user-stamp" | "subsidised" | "unavailable";

export type SwarmConnectionInfo = {
  identity: SwarmIdentity | null;
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
   * of the page. We drive login with our own UI (`connect()`), so the app
   * passes a zero-size hidden container.
   */
  containerId?: string;
  onConnectionChange?: (info: SwarmConnectionInfo) => void;
};

export class SwarmError extends Error {
  readonly code:
    | "not-initialized"
    | "login-failed"
    | "upload-unavailable"
    | "upload-failed"
    | "download-failed"
    | "invalid-manifest";
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

function normalise(info: SdkConnectionInfo): SwarmConnectionInfo {
  return {
    identity: info.identity
      ? {
          id: info.identity.id,
          name: info.identity.name,
          address: info.identity.address,
          avatarUrl: info.identity.avatar?.url,
        }
      : null,
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
    const { SwarmIdClient } = await import("@snaha/swarm-id");
    const instance = new SwarmIdClient({
      iframeOrigin: cfg.iframeOrigin,
      subsidisedGatewayUrl: cfg.subsidisedGatewayUrl,
      containerId: cfg.containerId,
      metadata: { name: cfg.appName, description: cfg.appDescription },
      onConnectionChange: (info) => {
        lastInfo = normalise(info);
        config?.onConnectionChange?.(lastInfo);
      },
    });
    try {
      await instance.initialize();
    } catch (err) {
      initPromise = undefined;
      throw new SwarmError("login-failed", "Swarm ID login failed.", err);
    }
    client = instance;
    lastInfo = normalise(instance.connectionInfo);
    config?.onConnectionChange?.(lastInfo);
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
    await c.connect({ popupMode: "popup" });
  } catch (err) {
    throw new SwarmError("login-failed", "Swarm ID login failed.", err);
  }
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
export async function deriveWalletSecret(label = "apiperitivo:wallet:v1"): Promise<Uint8Array> {
  const c = requireClient();
  if (!getConnectionInfo().identity) throw new SwarmError("login-failed", "Sign in with Swarm ID first.");
  const secret = await c.deriveAppSecret(label);
  if (!(secret instanceof Uint8Array) || secret.byteLength !== 32) {
    throw new SwarmError("login-failed", "Swarm ID returned an unexpected secret length.");
  }
  return secret;
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
