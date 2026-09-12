/**
 * In-memory sliding-window rate limit for the write routes. The app-owned
 * Arkiv writer pays gas for every publish, mint and grant, so each call is a
 * cost; this caps how fast one client can spend it.
 *
 * Per process only: on serverless every instance keeps its own window, which
 * still bounds a single hot loop. A shared store (KV, Redis) is the upgrade.
 */

type Window = { started: number; count: number };

const windows = new Map<string, Window>();
const SWEEP_EVERY = 500;
let calls = 0;

export type RateLimitRule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  /** Listings are permanent entities: a few per minute is plenty for a human. */
  publish: { limit: 5, windowMs: 60_000 },
  /** One mint per payment; a burst of retries after a 502 is fine. */
  mint: { limit: 10, windowMs: 60_000 },
  /** Grants are one per buyer; a provider approving a queue needs a few. */
  grant: { limit: 20, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(bucket: string, key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  if (++calls % SWEEP_EVERY === 0) sweep(now);
  const id = `${bucket}:${key}`;
  const current = windows.get(id);
  if (!current || now - current.started >= rule.windowMs) {
    windows.set(id, { started: now, count: 1 });
    return { ok: true };
  }
  if (current.count < rule.limit) {
    current.count += 1;
    return { ok: true };
  }
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((current.started + rule.windowMs - now) / 1000)) };
}

function sweep(now: number): void {
  for (const [id, w] of windows) {
    if (now - w.started > 10 * 60_000) windows.delete(id);
  }
}

/** Test hook. */
export function resetRateLimits(): void {
  windows.clear();
}
