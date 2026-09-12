/**
 * Share one in-flight request between the components that need the same
 * value at the same time (writer status, Swarm drive, provider stats). The
 * first caller starts the request, the others await it; the result stays
 * fresh for `ttlMs` so a page mounting five readers costs one round trip.
 */

type Entry = { promise: Promise<unknown>; at: number };

const entries = new Map<string, Entry>();

export function sharedRequest<T>(key: string, fn: () => Promise<T>, ttlMs = 2_000, now = Date.now()): Promise<T> {
  const hit = entries.get(key);
  if (hit && now - hit.at < ttlMs) return hit.promise as Promise<T>;
  const promise = fn().catch((err) => {
    entries.delete(key);
    throw err;
  });
  entries.set(key, { promise, at: now });
  return promise;
}

/** Forget a cached value so the next read goes to the network (refresh buttons). */
export function invalidateRequest(prefix: string): void {
  for (const key of entries.keys()) if (key === prefix || key.startsWith(`${prefix}:`)) entries.delete(key);
}

/** Test hook. */
export function resetSharedRequests(): void {
  entries.clear();
}
