/** Turn any thrown value into a friendly message + optional raw detail for the dev debug area. */
export type FriendlyError = { message: string; detail?: string };

/** Errors whose message is written for the user and can be shown as-is. */
const USER_FACING = new Set(["SwarmError", "WalletError", "GatewayError"]);

function stringify(value: unknown): string {
  if (value instanceof Error) {
    const cause = (value as Error & { cause?: unknown }).cause;
    const base = `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
    return cause ? `${base}\n\nCaused by:\n${stringify(cause)}` : base;
  }
  try {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function isUserFacingError(err: unknown): err is Error {
  return Boolean(err && typeof err === "object" && "name" in err && USER_FACING.has(String((err as { name?: string }).name)) && (err as Error).message);
}

/**
 * `fallback` is what the user sees unless the error is one of ours (Swarm,
 * wallet, gateway) whose message is already meant for people. The raw error
 * always lands in `detail` for the dev disclosure.
 */
export function toFriendlyError(err: unknown, fallback: string): FriendlyError {
  const detail = stringify(err);
  if (isUserFacingError(err)) return { message: err.message, detail };
  return { message: fallback, detail };
}

/** For prose that already has a subject: the user-facing message, else the fallback. */
export function friendlyMessage(err: unknown, fallback: string): string {
  return toFriendlyError(err, fallback).message;
}
