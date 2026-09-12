import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/**
 * One shape for every JSON error the API returns:
 * `{ error, reason?, issues?, ...extra }`. Clients show `reason` when present.
 */
export function jsonError(status: number, error: string, reason?: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ error, ...(reason ? { reason } : {}), ...extra }, { status });
}

/** Request bodies are small JSON documents; anything larger is not ours. */
export const MAX_BODY_BYTES = 64 * 1024;

/**
 * Parse and validate a JSON body. Returns the parsed value or a ready 400/413
 * response, so handlers stay linear.
 */
export async function readJsonBody<T>(request: Request, schema: ZodType<T>, label = "request"): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { ok: false, response: jsonError(413, `Request body too large (max ${MAX_BODY_BYTES} bytes).`) };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: jsonError(400, "Unreadable request body.") };
  }
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: jsonError(413, `Request body too large (max ${MAX_BODY_BYTES} bytes).`) };
  let body: unknown;
  try {
    body = text.trim() ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: jsonError(400, "Invalid JSON body.") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: jsonError(400, `Invalid ${label} data.`, undefined, { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }) };
  }
  return { ok: true, data: parsed.data };
}

/** First line of an error, without the viem/SDK multi-line dumps. Never a stack. */
export function shortMessage(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string } | undefined;
  return (e?.shortMessage ?? e?.message ?? String(err)).split("\n")[0] ?? "Unknown error";
}

/**
 * Wrap a handler so an unexpected throw (RPC down, SDK error) still yields the
 * JSON error shape instead of Next's HTML 500. `label` prefixes the server log.
 */
export function withJsonErrors<A extends unknown[]>(label: string, handler: (...args: A) => Promise<NextResponse>): (...args: A) => Promise<NextResponse> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`[${label}] unhandled:`, err);
      return jsonError(502, "Upstream service failed.", shortMessage(err));
    }
  };
}

/** Client IP for rate limiting: the last trusted proxy hop, or a fixed key when unknown. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
