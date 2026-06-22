import type { NextRequest } from "next/server";
import type { KVNamespace } from "@cloudflare/workers-types";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
};

type State = { count: number; resetAt: number };

// KV-backed fixed-window rate limit. `now` is injectable for tests.
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const k = "rl:" + key;
  const raw = await kv.get(k);
  const state: State | null = raw ? (JSON.parse(raw) as State) : null;

  if (!state || state.resetAt <= now) {
    const next: State = { count: 1, resetAt: now + windowMs };
    await kv.put(k, JSON.stringify(next), { expirationTtl: Math.ceil(windowMs / 1000) });
    return { allowed: true, remaining: Math.max(limit - 1, 0), retryAfterSeconds: 0, limit };
  }

  if (state.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(Math.ceil((state.resetAt - now) / 1000), 1),
      limit,
    };
  }

  state.count += 1;
  await kv.put(k, JSON.stringify(state), {
    expirationTtl: Math.max(Math.ceil((state.resetAt - now) / 1000), 1),
  });
  return { allowed: true, remaining: Math.max(limit - state.count, 0), retryAfterSeconds: 0, limit };
}

export function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
