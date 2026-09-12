/**
 * Plain HTTP access to a Bee gateway. No Swarm ID SDK, no `window`: safe on
 * the server (API routes, tools) and in the browser alike.
 */
import { type ManifestValidation, manifestFromBytes } from "@apiritivo/shared";

/** A manifest is a few hundred bytes; anything bigger than this is not ours. */
export const MANIFEST_MAX_BYTES = 64 * 1024;

export type GatewayFetchOptions = {
  /** Bee API base, e.g. `https://api.gateway.ethswarm.org`. */
  gatewayUrl: string;
  timeoutMs?: number;
  maxBytes?: number;
};

export class GatewayError extends Error {
  constructor(
    readonly code: "unreachable" | "not-found" | "too-large" | "bad-status",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

/** `GET <gateway>/bytes/<reference>` with a timeout and a byte cap. */
export async function fetchBytesFromGateway(reference: string, options: GatewayFetchOptions): Promise<Uint8Array> {
  const base = options.gatewayUrl.replace(/\/+$/, "");
  const maxBytes = options.maxBytes ?? MANIFEST_MAX_BYTES;
  let res: Response;
  try {
    res = await fetch(`${base}/bytes/${reference}`, { cache: "no-store", signal: AbortSignal.timeout(options.timeoutMs ?? 10_000) });
  } catch (err) {
    throw new GatewayError("unreachable", "Swarm gateway did not answer.", err);
  }
  if (res.status === 404) throw new GatewayError("not-found", "Reference not found on the Swarm gateway.");
  if (!res.ok) throw new GatewayError("bad-status", `Swarm gateway responded ${res.status}.`);
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new GatewayError("too-large", `Reference is ${declared} bytes, more than the ${maxBytes} byte limit.`);
  return readCapped(res, maxBytes);
}

/** Download and validate a technical manifest by reference. */
export async function fetchManifestFromGateway(reference: string, options: GatewayFetchOptions): Promise<ManifestValidation> {
  return manifestFromBytes(await fetchBytesFromGateway(reference, options));
}

/** Read a body while enforcing `maxBytes`, even when no Content-Length was sent. */
export async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new GatewayError("too-large", `Response exceeds the ${maxBytes} byte limit.`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
