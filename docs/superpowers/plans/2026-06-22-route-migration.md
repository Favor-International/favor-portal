# API Route Migration Implementation Plan (Plan 4 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Migrate routes by domain; verify centrally.

**Goal:** Move the ~43 API routes off Supabase onto `getAuthContext()` + the Plan-2 `lib/db/access/*` modules + the Plan-3 auth, then (final step) delete `lib/supabase/*` and the `@supabase/*` packages.

**The migration pattern (apply per route):**
1. Delete `@/lib/supabase/server` import and the `isDevBypass` / `@/lib/mock-store` branches (real local D1 now serves dev too).
2. Auth: replace `createClient()` + `supabase.auth.getSession()` with the shared helper `lib/api/route-auth.ts`:
   ```ts
   const auth = await authedRoute();           // or: adminRoute("content:manage")
   if ("error" in auth) return auth.error;
   const { ctx } = auth;
   ```
3. Data: replace `supabase.from(...)...` with the matching `lib/db/access/*` function, passing `getDb()` + `ctx`. Map the returned Drizzle row (already camelCase) to the existing response shape (e.g. `description: row.description ?? undefined`).
4. Preserve response JSON shapes, status codes, and `logInfo`/`logError` events exactly.

**Auth helper:** `lib/api/route-auth.ts` → `authedRoute()` (401 if no session) / `adminRoute(permission)` (401/403). Public routes (`/api/auth/*`, `/api/certificates/verify/[token]`) skip auth.

## Wave 1 (this push) — user-facing portal routes
Map cleanly to existing access modules; no new admin helpers needed.

| Route(s) | Access module fn(s) |
|---|---|
| `giving/goals`, `giving/goals/[id]` | giving-goals: list/create/update/delete |
| `giving/history` | giving: listGivingHistory |
| `giving/one-time` | giving: createOneTimeGift |
| `giving/recurring`, `/[id]`, `/[id]/status`, `/[id]/cancel` | giving: listRecurringGifts / updateRecurringGiftStatus / cancelRecurringGift |
| `profile` | profile: getProfile / updateProfile |
| `content` | content: listContent / getContent |
| `courses` | courses: listCourses |
| `dashboard/experience` | content: listDashboardOverrides (+ role experience lib) |
| `activity` | activity: recordActivity / listMyActivity |
| `support` | support: createTicket / listMyTickets |
| `lms/cohorts` | community: listCohorts |
| `lms/discussions/threads`, `/[threadId]`, `/[threadId]/replies` | community: threads/replies fns |
| `certificates/verify/[token]` (PUBLIC) | learning: getCertificateByToken (no ctx) |

Deferred:
- `giving/receipt/[id]` — generates a PDF (R2 → Plan 5).
- `certificates/issue` — generates + stores a PDF (R2 → Plan 5).

## Wave 2 (later)
Admin routes (`admin/*`), `blackbaud/*`, `comms/*`, `ai/*` — need admin helpers (`adminRoute`) and a few new admin-scoped access functions (list-all users/gifts, overview aggregations). Also rewrite the shared admin libs (`lib/api/admin-guard.ts`, `lib/admin/permissions.ts`, `lib/admin/audit.ts`) to be AuthContext/Drizzle-based, and migrate client hooks (`hooks/use-*.ts`) + server-component pages off the Supabase browser client.

## Final step (after all routes + hooks + pages migrated)
Delete `lib/supabase/*`, remove `@supabase/ssr` + `@supabase/supabase-js` from package.json, drop `lib/dev-mode.ts` Supabase checks. Then `npm run lint`, `npm run typecheck`, `npm run test:unit`, and an OpenNext build must all pass.

## Verification (each wave)
Central gate: `npm run typecheck` (0), `npm run lint` (clean), `npm run test:unit` (pass). Spot-check 1-2 migrated routes in dev with a real session cookie.
