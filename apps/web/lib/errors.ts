/** Turn any thrown value into a friendly message + optional raw detail for the dev debug area. */
export type FriendlyError = { message: string; detail?: string };

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

export function toFriendlyError(err: unknown, fallback: string): FriendlyError {
  const detail = stringify(err);
  if (err && typeof err === "object" && "name" in err && (err as { name?: string }).name === "SwarmError") {
    return { message: (err as Error).message, detail };
  }
  return { message: fallback, detail };
}
