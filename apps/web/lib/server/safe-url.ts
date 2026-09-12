import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * The gateway forwards calls to a URL the provider wrote into its manifest.
 * A malicious manifest could point the server at itself, a cloud metadata
 * endpoint or an internal RPC, so an endpoint is only used when it is a public
 * https origin that resolves to a public address.
 */

export type EndpointCheck = { ok: true; url: URL } | { ok: false; reason: string };

export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 || // "this" network
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) || // IETF protocol assignments, 192.0.2.0 test net
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast, reserved, broadcast
  );
}

export function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("::ffff:")) return isPrivateIPv4(v.slice(7));
  return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}

export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

/** Pure part of the check: scheme, host shape, credentials, literal addresses. */
export function checkEndpointSyntax(raw: string): EndpointCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Endpoint is not a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Endpoint must use https." };
  if (url.username || url.password) return { ok: false, reason: "Endpoint must not carry credentials." };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "Endpoint must be a public host." };
  }
  if (isIP(host) && isPrivateAddress(host)) return { ok: false, reason: "Endpoint must not be a private address." };
  return { ok: true, url };
}

/** Full check: syntax, then every resolved address must be public. */
export async function checkEndpoint(raw: string): Promise<EndpointCheck> {
  const syntax = checkEndpointSyntax(raw);
  if (!syntax.ok) return syntax;
  const host = syntax.url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return syntax;
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return { ok: false, reason: "Endpoint host does not resolve." };
  }
  if (addresses.length === 0) return { ok: false, reason: "Endpoint host does not resolve." };
  if (addresses.some((a) => isPrivateAddress(a.address))) return { ok: false, reason: "Endpoint resolves to a private address." };
  return syntax;
}
