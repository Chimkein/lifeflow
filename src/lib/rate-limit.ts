// Best-effort in-process rate limiter (fixed window).
//
// On serverless (Vercel) each instance keeps its own counter map, so this is
// NOT a globally exact limit — it throttles bursts hitting a single warm
// instance and stops runaway client loops from stampeding the paid AI / Gmail
// APIs. The primary gate on who can consume quota is the sign-in allow-list
// (ALLOWED_EMAILS) in auth.ts; this is cheap defense-in-depth on top of it.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfter: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Opportunistic prune so the map can't grow without bound on a long-lived
  // instance. Cheap: only sweeps once the map gets sizeable.
  if (buckets.size > 5_000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { ok: true, retryAfter: 0 };
}
