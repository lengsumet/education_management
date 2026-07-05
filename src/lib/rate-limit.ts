import { NextRequest } from "next/server";

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Scope: single-process only. This app runs as one Next.js instance with no
 * Redis, so a process-local Map is the pragmatic choice. If this is ever scaled
 * to multiple instances, move the counter to a shared store (Redis) — otherwise
 * each instance keeps its own window and the effective limit multiplies.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let opsSinceSweep = 0;

// Opportunistically drop expired buckets so the Map can't grow unbounded.
function sweep(now: number): void {
  for (const [key, b] of buckets) {
    if (now > b.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number; // seconds until the window resets (0 when ok)
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (++opsSinceSweep >= 500) {
    opsSinceSweep = 0;
    sweep(now);
  }

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count++;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

// Best-effort client IP from proxy headers, with a stable fallback so the
// limiter still works locally (where x-forwarded-for is often absent).
export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "local";
}
