# Native Magic-Link Auth Implementation Plan (Plan 3 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace Supabase Auth with a Cloudflare-native passwordless magic-link flow — single-use tokens in KV, revocable opaque sessions in KV, an HttpOnly cookie, and request gating via helpers (no Node middleware).

**Architecture:** `lib/auth/*` owns auth. Magic-link tokens live in the `SESSIONS` KV under an `ml:` prefix (15-min TTL, single-use via delete-on-consume, only a SHA-256 hash of the token is stored). Sessions live in the same KV under `sess:` (30-day TTL, opaque id in cookie, revocable). `getAuthContext()` reads the cookie → KV session → `buildAuthContext(getDb(), userId)` (the Plan-2 access layer). The two existing auth routes are rewritten to use these; a logout route is added; rate limiting moves from in-memory to the `RATE_LIMIT` KV. All auth helpers take their KV namespace as an argument (dependency injection) so they unit-test against an in-memory KV stub.

**Tech Stack:** Cloudflare KV, Web Crypto (SHA-256 / randomUUID), Resend (existing `sendMagicLinkEmail`), Drizzle access layer, Vitest.

**Frontend contract preserved:** POST `/api/auth/magic-link` `{email, scope, redirectTo}` → `{success, message, devLink?}`. POST `/api/auth/verify` `{token, scope, redirectTo}` → `{success, user, scope, redirectTo}` + Set-Cookie. Email link is `${APP_URL}/verify?token=<token>` (scope+redirect are stored WITH the token server-side, which is authoritative).

**Milestone (done when):** auth primitives unit-tested (tokens single-use, sessions revocable, rate-limit window); the two routes + logout rewritten with zero `@supabase` imports; `getAuthContext()` resolves a logged-in user; lint + typecheck + all unit tests green. (End-to-end login exercised in dev via `devLink` when RESEND_API_KEY is absent.)

---

## File structure
```
lib/auth/
  tokens.ts         # createMagicLinkToken / consumeMagicLinkToken (KV, sha256, single-use)
  session.ts        # createSession / getSession / destroySession (KV, opaque id)
  cookies.ts        # SESSION_COOKIE name + cookie option helpers
  current-user.ts   # getAuthContext(), requireAuth(), requireAdmin(permission)
  provision.ts      # findOrProvisionUser(db, email, {constituent, allowDevCreate})
lib/rate-limit.ts   # REWRITE: KV-backed async checkRateLimit(kv, key, limit, windowMs, now?)
app/api/auth/magic-link/route.ts   # REWRITE (no supabase)
app/api/auth/verify/route.ts       # REWRITE (no supabase)
app/api/auth/logout/route.ts       # NEW
tests/auth/kv-stub.ts              # in-memory KVNamespace for tests
tests/auth/{tokens,session,rate-limit}.test.ts
```
Update vitest.config.ts `include` to `tests/{db,auth}/**/*.test.ts`.

---

## Task 1: In-memory KV stub for tests
**Files:** Create `tests/auth/kv-stub.ts`; Modify `vitest.config.ts`
- [ ] Create `tests/auth/kv-stub.ts`:
```typescript
export function makeKv() {
  const store = new Map<string, { value: string; expireAt: number | null }>();
  return {
    async get(key: string) {
      const e = store.get(key);
      if (!e) return null;
      if (e.expireAt !== null && e.expireAt <= Date.now()) { store.delete(key); return null; }
      return e.value;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      store.set(key, { value, expireAt: opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null });
    },
    async delete(key: string) { store.delete(key); },
    _store: store,
  } as unknown as KVNamespace;
}
```
- [ ] Edit `vitest.config.ts` include → `["tests/db/**/*.test.ts", "tests/auth/**/*.test.ts"]`.
- [ ] Commit.

## Task 2: Magic-link tokens (TDD)
**Files:** Create `lib/auth/tokens.ts`; Test `tests/auth/tokens.test.ts`
- [ ] Test first: create→consume returns the payload; a second consume returns null (single-use); consuming a wrong token returns null.
- [ ] Implement:
```typescript
import type { KVNamespace } from "@cloudflare/workers-types";

const PREFIX = "ml:";
const TTL_SECONDS = 15 * 60;

export type MagicLinkPayload = { email: string; scope: "portal" | "admin"; redirectTo: string };

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createMagicLinkToken(kv: KVNamespace, payload: MagicLinkPayload): Promise<string> {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const key = PREFIX + (await sha256Hex(token));
  await kv.put(key, JSON.stringify(payload), { expirationTtl: TTL_SECONDS });
  return token;
}

export async function consumeMagicLinkToken(kv: KVNamespace, token: string): Promise<MagicLinkPayload | null> {
  if (!token) return null;
  const key = PREFIX + (await sha256Hex(token));
  const raw = await kv.get(key);
  if (!raw) return null;
  await kv.delete(key); // single-use
  return JSON.parse(raw) as MagicLinkPayload;
}
```
- [ ] Run → pass. Commit.

## Task 3: Sessions (TDD)
**Files:** Create `lib/auth/session.ts`, `lib/auth/cookies.ts`; Test `tests/auth/session.test.ts`
- [ ] Test: createSession→getSession returns {userId, scope}; destroySession→getSession null; unknown id → null.
- [ ] `lib/auth/session.ts`:
```typescript
import type { KVNamespace } from "@cloudflare/workers-types";

const PREFIX = "sess:";
const TTL_SECONDS = 60 * 60 * 24 * 30;

export type SessionData = { userId: string; scope: "portal" | "admin"; createdAt: string };

export async function createSession(kv: KVNamespace, data: { userId: string; scope: "portal" | "admin" }): Promise<string> {
  const id = crypto.randomUUID();
  const value: SessionData = { ...data, createdAt: new Date().toISOString() };
  await kv.put(PREFIX + id, JSON.stringify(value), { expirationTtl: TTL_SECONDS });
  return id;
}

export async function getSession(kv: KVNamespace, id: string): Promise<SessionData | null> {
  if (!id) return null;
  const raw = await kv.get(PREFIX + id);
  return raw ? (JSON.parse(raw) as SessionData) : null;
}

export async function destroySession(kv: KVNamespace, id: string): Promise<void> {
  if (id) await kv.delete(PREFIX + id);
}

export const SESSION_TTL_SECONDS = TTL_SECONDS;
```
- [ ] `lib/auth/cookies.ts`:
```typescript
import { SESSION_TTL_SECONDS } from "./session";

export const SESSION_COOKIE = "favor_session";

export function sessionCookieOptions(maxAge: number = SESSION_TTL_SECONDS) {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}
```
- [ ] Run → pass. Commit.

## Task 4: Rate limit on KV (TDD)
**Files:** Rewrite `lib/rate-limit.ts`; Test `tests/auth/rate-limit.test.ts`
- [ ] Test: allows up to `limit`, blocks the next; advancing `now` past the window resets.
- [ ] Rewrite (async, KV-backed, injectable `now`; keep `getClientIp`):
```typescript
import type { NextRequest } from "next/server";
import type { KVNamespace } from "@cloudflare/workers-types";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number; limit: number };
type State = { count: number; resetAt: number };

export async function checkRateLimit(kv: KVNamespace, key: string, limit: number, windowMs: number, now: number = Date.now()): Promise<RateLimitResult> {
  const k = "rl:" + key;
  const raw = await kv.get(k);
  const state: State | null = raw ? (JSON.parse(raw) as State) : null;
  if (!state || state.resetAt <= now) {
    const next: State = { count: 1, resetAt: now + windowMs };
    await kv.put(k, JSON.stringify(next), { expirationTtl: Math.ceil(windowMs / 1000) });
    return { allowed: true, remaining: Math.max(limit - 1, 0), retryAfterSeconds: 0, limit };
  }
  if (state.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(Math.ceil((state.resetAt - now) / 1000), 1), limit };
  }
  state.count += 1;
  await kv.put(k, JSON.stringify(state), { expirationTtl: Math.max(Math.ceil((state.resetAt - now) / 1000), 1) });
  return { allowed: true, remaining: Math.max(limit - state.count, 0), retryAfterSeconds: 0, limit };
}

export function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) { const first = fwd.split(",")[0]?.trim(); if (first) return first; }
  return request.headers.get("x-real-ip") ?? "unknown";
}
```
- [ ] Run → pass. Commit.

## Task 5: getAuthContext + guards
**Files:** Create `lib/auth/current-user.ts`
```typescript
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "../db/client";
import { buildAuthContext, type AuthContext } from "../db/auth-context";
import { getSession } from "./session";
import { SESSION_COOKIE } from "./cookies";
import { AuthorizationError } from "../db/access/authz";
import { hasAdminPermission, resolveAdminPermissions } from "../admin/roles";
import type { AdminPermission } from "@/types";

export async function getAuthContext(): Promise<AuthContext | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const { env } = getCloudflareContext();
  const session = await getSession(env.SESSIONS, id);
  if (!session) return null;
  return buildAuthContext(getDb(), session.userId);
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthorizationError("Unauthorized");
  return ctx;
}

export async function requireAdmin(permission: AdminPermission = "admin:access"): Promise<AuthContext> {
  const ctx = await requireAuth();
  const permissions = resolveAdminPermissions(ctx.isAdmin, ctx.roleKeys);
  if (!hasAdminPermission(permission, permissions)) throw new AuthorizationError("Forbidden");
  return ctx;
}
```
- [ ] Typecheck. Commit. (Note: `resolveAdminPermissions` signature confirmed in `lib/admin/roles.ts` — adapt arg order if needed.)

## Task 6: User provisioning helper
**Files:** Create `lib/auth/provision.ts`
- findOrProvisionUser(db, email, opts): select `users` by lowercased email; if found return it. Else if `opts.constituent` (SKY) OR `opts.allowDevCreate`, insert a `users` row (id `crypto.randomUUID()`, email, firstName/lastName/constituentType from constituent when present else "Friend"/""/"individual", blackbaudConstituentId from constituent), plus a default `communication_preferences` row; return it. Else return null. Reuse `blackbaudClient`/types where available; keep field mapping minimal and camelCase (Drizzle).
- [ ] Typecheck. Commit.

## Task 7: Rewrite `/api/auth/magic-link`
- Keep `normalizeScope`/`sanitizeRedirectPath`. Rate-limit via `checkRateLimit(env.RATE_LIMIT, "auth:magic-link:"+ip, 6, 600000)`. Validate email. Look up user in D1 (`getDb`, users by email). If missing and scope portal, check SKY eligibility (`blackbaudClient.getConstituentByEmail`). Preserve "don't reveal existence" generic responses and admin permission gate. On success: `token = await createMagicLinkToken(env.SESSIONS, {email, scope, redirectTo})`. If `process.env.RESEND_API_KEY` → `await sendMagicLinkEmail(email, token)` and return `{success, message}`. Else (dev) return `{success, message, devLink: "/verify?token="+token}`. Remove all supabase imports.
- [ ] Typecheck. Commit.

## Task 8: Rewrite `/api/auth/verify` + logout
- verify: rate-limit (`auth:verify:`+ip, 20, 600000). `payload = await consumeMagicLinkToken(env.SESSIONS, token)`; if null → 401 "Invalid or expired token". Determine SKY constituent if user missing+portal. `user = await findOrProvisionUser(getDb(), payload.email, { constituent, allowDevCreate: !process.env.RESEND_API_KEY })`; if null → 401. If `payload.scope === "admin"`: resolve permissions from user.isAdmin + roles, if no `admin:access` → 403. Update `users.lastLogin`. `sessionId = await createSession(env.SESSIONS, { userId: user.id, scope: payload.scope })`. Build response `{success, user: {id, email}, scope: payload.scope, redirectTo: payload.redirectTo}` and set the session cookie via `response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions())`. Remove supabase.
- logout (`app/api/auth/logout/route.ts`, POST): read cookie, `destroySession(env.SESSIONS, id)`, clear cookie, return `{success:true}`.
- [ ] Typecheck. Commit.

## Task 9: Gate
- [ ] `npm run lint` clean, `npm run typecheck` 0, `npm run test:unit` all pass. Confirm no `@supabase` import remains in `app/api/auth/**` or `proxy` (proxy already removed). Commit any fixups.

## Self-review
- Tokens: only SHA-256 hash stored; single-use (delete on consume); 15-min TTL. ✓
- Sessions: opaque id; revocable (destroySession); 30-day TTL; HttpOnly+Secure cookie. ✓
- Scope/redirect are server-authoritative (stored with token), not trusted from the verify POST body. ✓
- Dev affordance (devLink + allowDevCreate) only when RESEND_API_KEY absent → never in production. ✓

## Notes for Plan 4
Every protected route calls `getAuthContext()`/`requireAuth()`/`requireAdmin()` then passes the `AuthContext` to the matching `lib/db/access/*` module. Public routes: `/login`, `/verify`, `/api/auth/*`, `/api/certificates/verify`.
