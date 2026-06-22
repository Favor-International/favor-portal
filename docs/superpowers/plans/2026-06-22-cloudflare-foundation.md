# Cloudflare Hosting Foundation — Implementation Plan (Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the existing Next.js 16 app building and running on Cloudflare Workers via OpenNext, with D1, KV (×2), and R2 bindings created and verified reachable through a health endpoint.

**Architecture:** Add the `@opennextjs/cloudflare` adapter and `wrangler` config so the unchanged Next.js app deploys to Workers. Create the four first-party bindings (`DB`=D1, `SESSIONS`=KV, `RATE_LIMIT`=KV, `R2`=R2 bucket). Prove the wiring with a `/api/health` route that reads each binding and runs a trivial D1 query, covered by a Playwright test. Neutralize `proxy.ts` to a pass-through (its Supabase auth is fully rebuilt in Plan 2) — this also surfaces the known Next-16 Proxy × OpenNext incompatibility early.

**Tech Stack:** Next.js 16, `@opennextjs/cloudflare`, Wrangler, Cloudflare D1 / KV / R2, Playwright.

**Prerequisites:** A Cloudflare account; run `npx wrangler login` once before Task 3 (one-time browser auth). This plan is executed on branch `cloudflare-migration`.

**Milestone (done when):** `npm run preview` builds and serves on Workers, and the Playwright health test passes with `DB`, `SESSIONS`, `RATE_LIMIT`, `R2` all `true` and `dbQueryOk: true`.

---

### Task 1: Install OpenNext + Wrangler and add scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

> **Version note (resolved during execution):** `@opennextjs/cloudflare@1.19.11` peers
> `next ">=15.5.18 <16 || >=16.2.6"` and `wrangler "^4.86.0"`. The repo's `next@16.1.6` falls in the
> unsupported gap, so Next is bumped to **16.2.9** (latest stable; React 19.2.3 stays compatible) and
> `eslint-config-next` to **16.2.9**. This is the spec §14 mitigation ("pin compatible versions") and
> also covers the Next-16 Proxy fix landed at 16.2.6.

Run (Next/eslint pinned exact to match repo style; the bump also bootstraps all deps on a fresh clone):
```bash
npm install --save-exact next@16.2.9 eslint-config-next@16.2.9
npm install --save-dev @opennextjs/cloudflare@latest wrangler@latest
```
Expected: OpenNext + Wrangler added to `devDependencies`; no `ERESOLVE` peer error.

- [ ] **Step 2: Verify versions resolved**

Run:
```bash
npx wrangler --version && node -e "console.log(require('@opennextjs/cloudflare/package.json').version)"
```
Expected: a Wrangler version (e.g. `4.x`) prints, and an `@opennextjs/cloudflare` version prints without error.

- [ ] **Step 3: Add Cloudflare scripts to `package.json`**

In the `"scripts"` block, add these three entries alongside the existing scripts:
```json
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add OpenNext Cloudflare adapter and wrangler"
```

---

### Task 2: Add OpenNext + Wrangler config and dev hook

**Files:**
- Create: `open-next.config.ts`
- Create: `wrangler.jsonc`
- Modify: `next.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `open-next.config.ts`**

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

- [ ] **Step 2: Create `wrangler.jsonc`** (binding IDs are filled in Task 3)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "favor-portal",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-03-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": ".open-next/assets"
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "favor-portal", "database_id": "PLACEHOLDER_SET_IN_TASK_3" }
  ],
  "kv_namespaces": [
    { "binding": "SESSIONS", "id": "PLACEHOLDER_SET_IN_TASK_3" },
    { "binding": "RATE_LIMIT", "id": "PLACEHOLDER_SET_IN_TASK_3" }
  ],
  "r2_buckets": [
    { "binding": "R2", "bucket_name": "favor-portal-assets" }
  ]
}
```
(The `PLACEHOLDER_SET_IN_TASK_3` strings are replaced with real IDs in Task 3 — they are not left in the final config.)

- [ ] **Step 3: Add the OpenNext dev hook to `next.config.ts`**

At the very top of `next.config.ts`, below the existing imports, add:
```typescript
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
```
Leave the rest of the file unchanged. This makes Cloudflare bindings available during `next dev`.

- [ ] **Step 4: Update `.gitignore`**

Append these lines to `.gitignore`:
```gitignore

# cloudflare / opennext
/.open-next/
/.wrangler/
.dev.vars
cloudflare-env.d.ts
```

- [ ] **Step 5: Verify the dev server still boots**

Run:
```bash
npm run dev
```
Expected: Next.js dev server starts on port 3000 with no module-resolution errors from the new imports. Stop it with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add open-next.config.ts wrangler.jsonc next.config.ts .gitignore
git commit -m "chore: add OpenNext and wrangler configuration"
```

---

### Task 3: Create Cloudflare resources and wire binding IDs

**Files:**
- Modify: `wrangler.jsonc`
- Create: `cloudflare-env.d.ts` (generated)

- [ ] **Step 1: Authenticate Wrangler (one-time)**

Run:
```bash
npx wrangler login
```
Expected: browser opens; after approving, terminal prints `Successfully logged in.` (Skip if already logged in — verify with `npx wrangler whoami`.)

- [ ] **Step 2: Create the D1 database**

Run:
```bash
npx wrangler d1 create favor-portal
```
Expected: prints a `database_id` (a UUID). Copy it into `wrangler.jsonc` → `d1_databases[0].database_id`, replacing the placeholder.

- [ ] **Step 3: Create the two KV namespaces**

Run:
```bash
npx wrangler kv namespace create SESSIONS
npx wrangler kv namespace create RATE_LIMIT
```
Expected: each prints an `id`. Put the SESSIONS id into `kv_namespaces[0].id` and the RATE_LIMIT id into `kv_namespaces[1].id`, replacing the placeholders.

- [ ] **Step 4: Create the R2 bucket**

Run:
```bash
npx wrangler r2 bucket create favor-portal-assets
```
Expected: prints `Created bucket 'favor-portal-assets'`. (No id needed — R2 binds by `bucket_name`.)

- [ ] **Step 5: Generate Cloudflare env types**

Run:
```bash
npm run cf-typegen
```
Expected: `cloudflare-env.d.ts` is created at the repo root declaring a `CloudflareEnv` interface containing `DB`, `SESSIONS`, `RATE_LIMIT`, `R2`, and `ASSETS`.

- [ ] **Step 6: Verify no placeholders remain**

Run:
```bash
grep -n "PLACEHOLDER_SET_IN_TASK_3" wrangler.jsonc || echo "OK: no placeholders"
```
Expected: prints `OK: no placeholders`.

- [ ] **Step 7: Commit**

```bash
git add wrangler.jsonc
git commit -m "chore: provision D1, KV, and R2 bindings"
```
(`cloudflare-env.d.ts` is gitignored and intentionally not committed.)

---

### Task 4: Health route proving all bindings (TDD)

**Files:**
- Create: `tests/e2e/health.spec.ts`
- Create: `app/api/health/route.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/health.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

test("health endpoint reports all Cloudflare bindings reachable", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.checks).toMatchObject({
    DB: true,
    SESSIONS: true,
    RATE_LIMIT: true,
    R2: true,
  });
  expect(body.dbQueryOk).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx playwright test tests/e2e/health.spec.ts
```
Expected: FAIL — the request returns 404 (no `/api/health` route yet), so `expect(res.status()).toBe(200)` fails.

- [ ] **Step 3: Implement the health route**

Create `app/api/health/route.ts`:
```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const { env } = getCloudflareContext();

  const checks = {
    DB: Boolean(env.DB),
    SESSIONS: Boolean(env.SESSIONS),
    RATE_LIMIT: Boolean(env.RATE_LIMIT),
    R2: Boolean(env.R2),
  };

  let dbQueryOk = false;
  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    dbQueryOk = row?.ok === 1;
  } catch {
    dbQueryOk = false;
  }

  const ok = Object.values(checks).every(Boolean) && dbQueryOk;
  return NextResponse.json({ ok, checks, dbQueryOk });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx playwright test tests/e2e/health.spec.ts
```
Expected: PASS. (The test drives `npm run dev`, where `initOpenNextCloudflareForDev()` exposes the local D1/KV/R2 bindings and the `SELECT 1` runs against local D1.)

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/health.spec.ts app/api/health/route.ts
git commit -m "feat: add health endpoint verifying Cloudflare bindings"
```

---

### Task 5: Neutralize `proxy.ts` and validate the OpenNext Workers build

**Files:**
- Modify: `proxy.ts` (full replacement)

- [ ] **Step 1: Replace `proxy.ts` with a pass-through**

Replace the entire contents of `proxy.ts` with:
```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth gating is reintroduced in Plan 2 (native KV-session auth).
// Foundation milestone: pass-through so the OpenNext/Workers build is exercised
// and the Next-16 Proxy x OpenNext compatibility is validated early.
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```
This removes the `@/lib/supabase/server` import that would otherwise require Supabase env at runtime.

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS (no references to the removed Supabase imports remain in `proxy.ts`).

- [ ] **Step 3: Build and preview on Workers**

Run:
```bash
npm run preview
```
Expected: `opennextjs-cloudflare build` completes and `wrangler dev` serves the worker locally (default `http://localhost:8787`).

**If the build fails** with "Route segment config is not allowed in Proxy file" (the known Next-16 Proxy × OpenNext issue): apply the documented fallback — delete `proxy.ts` entirely and record in `docs/superpowers/specs/2026-06-22-cloudflare-migration-design.md` (§14) that route gating moves to per-route/server-component guards in Plan 2. Re-run `npm run preview` and confirm it builds. Either outcome resolves this risk before Plan 2.

- [ ] **Step 4: Smoke-test the health route on the Workers preview**

With the preview running, in a second terminal run:
```bash
curl -s http://localhost:8787/api/health
```
Expected: JSON with `"ok":true` and every entry in `checks` plus `dbQueryOk` set to `true`. Stop the preview with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add proxy.ts
git commit -m "refactor: neutralize proxy to pass-through for Workers build"
```

---

### Task 6: Full validation gate

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: PASS (no new errors from added files).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run the health E2E test**

Run: `npx playwright test tests/e2e/health.spec.ts`
Expected: PASS.

- [ ] **Step 4: Confirm milestone**

The foundation is complete: the app builds and runs on Cloudflare Workers via OpenNext, and `DB`/`SESSIONS`/`RATE_LIMIT`/`R2` are all reachable. Proceed to Plan 2 (Native auth).

---

## Notes for the next plans

- **Plan 2 (Native auth)** restores route gating in `proxy.ts` (or per-route guards if the fallback was taken) using KV sessions + D1 magic-link tokens, and removes `lib/supabase/*`.
- **Plan 3 (Data layer + authz)** adds the Drizzle schema for all 28 tables, the translated migrations + seed, and the scoped data-access layer with the per-table ownership matrix.
- The `DB`/`SESSIONS`/`RATE_LIMIT`/`R2` binding names established here are the contract those plans build on — do not rename them.
