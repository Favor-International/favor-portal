# Favor Portal — Cloudflare-Native Migration Design

- **Date:** 2026-06-22
- **Status:** Approved (design) — pending implementation plan
- **Repo:** `Favor-International/favor-portal` (cloned to `favor-portal-cloudflare`)
- **Baseline commit:** `d9d1638`

---

## 1. Context & Goal

The Favor International Partner Portal is a Next.js 16 + Supabase app (`portal.favorintl.org`)
serving seven constituent types (individual, major_donor, church, foundation, daf, ambassador,
volunteer) with giving history, an LMS, content, support, and admin surfaces.

**Goal:** Re-platform the portal so that all first-party infrastructure is Cloudflare-native —
D1 for the database, R2 for storage, KV for sessions/rate-limiting, Workers for hosting — removing
the Supabase dependency entirely. External system-of-record and delivery services that have no
Cloudflare equivalent are retained unchanged.

This document is the **design/spec only**. No code is changed by this document. Implementation is
planned and executed in a later pass.

---

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Session scope | Re-plan + write spec/plan; implement later | User directive |
| Data starting point | **Greenfield** — fresh D1 schema, no data migration | Portal is pre-launch (mock data) |
| Auth replacement | **Cloudflare-native magic-link** (Workers + D1 + KV) | Preserves passwordless UX, fully native |
| Hosting | **OpenNext on Workers** (`@opennextjs/cloudflare`) | Least rewrite; keeps Next.js app intact |
| DB access layer | **Drizzle ORM** (D1 driver) | Type safety + first-class SQLite migrations |
| Sessions | **KV opaque session tokens** | Revocable (force-logout); admin can kill sessions |
| Rate limiting | **KV** with TTL counters | Simple, edge-distributed; DO deferred unless needed |
| AI gateway | **Cloudflare AI Gateway** in front of OpenRouter | Free caching/observability, zero vendor change |

---

## 3. Scope

**In scope (v1):**
- Replace Supabase Auth with native magic-link auth (Workers + D1 + KV + Resend email).
- Replace Supabase Postgres with D1 (SQLite) + Drizzle; translate all 7 migrations.
- Replace Postgres RLS with app-layer authorization (per-user scoping + admin guards).
- Replace Supabase Storage with R2 (LMS resource uploads, certificate PDFs).
- Move in-memory rate limiting to KV.
- Configure OpenNext build + `wrangler.toml` bindings (D1, R2, KV) + secrets.
- Rewrite `proxy.ts` session gating against the new auth.
- Establish a shared brand/design-token layer for portal + Astro site, with cross-links.
- Preserve passing validation: ESLint, typecheck, production build, Playwright E2E (39 tests).

**Out of scope (v1, designed-for-not-blocked):**
- Migrating live production data (none exists yet).
- Shared content/data API feeding the Astro site (architected for, shipped later).
- Scheduled background Blackbaud sync via Cron/Queues (kept on-demand for now).
- Payment processing (already out of scope upstream).
- Dark mode, full onboarding UX (pre-existing gaps, unchanged).

---

## 4. Target architecture (service mapping)

| Concern | Today (Supabase / Vercel) | Target (Cloudflare-native) |
|---|---|---|
| Hosting | Next.js on Vercel | Workers via `@opennextjs/cloudflare` |
| Database | Postgres + RLS | D1 (SQLite) + app-layer auth |
| DB access | `@supabase/supabase-js` query builder | Drizzle ORM (D1 binding) |
| Auth | Supabase Auth magic-link | Custom magic-link on Workers |
| Sessions | Supabase cookies | KV (opaque session tokens) + HttpOnly cookie |
| File storage | Supabase Storage | R2 binding |
| Rate limiting | in-memory `lib/rate-limit.ts` | KV counters |
| Video | Cloudflare Stream | unchanged (already native) |
| Email | Resend | unchanged (no native equivalent) |
| SMS | Twilio | unchanged (no native equivalent) |
| CRM | Blackbaud SKY | unchanged (system of record) |
| AI | OpenRouter / DeepSeek V3 | unchanged + Cloudflare AI Gateway in front |
| Secrets/config | `.env` + Vercel | Wrangler secrets + `wrangler.toml` bindings |

---

## 5. Hosting & runtime

- Adopt `@opennextjs/cloudflare` to run the existing Next.js 16 app on Workers.
- Requirements: `nodejs_compat` compatibility flag; compatibility date ≥ `2024-09-23`.
- **Known caveat (must be designed around):** Next.js 16's new **Proxy** architecture
  (this repo's `proxy.ts`) currently conflicts with the OpenNext Cloudflare adapter
  ("Route segment config is not allowed in Proxy file" — Proxy is forced to the Node runtime).
  Since `proxy.ts` is rewritten anyway to drop Supabase, the implementation plan must validate the
  OpenNext build with the rewritten Proxy early, and pin compatible `next` / `@opennextjs/cloudflare`
  versions. Fallback if blocked: move gating logic out of Proxy into per-route/server-component guards.
- Bindings exposed to the app: `DB` (D1), `R2` (bucket), `SESSIONS` (KV), `RATE_LIMIT` (KV).
- Local dev via `wrangler dev` against local D1 + Miniflare; `.dev.vars` for secrets.

---

## 6. Authentication (native magic-link)

Replaces **all** of Supabase Auth. Two clients (`lib/supabase/client.ts`, `lib/supabase/server.ts`)
are removed; a new `lib/auth/*` module owns sessions.

**Data:**
- `auth_tokens` (D1): `id`, `email`, `token_hash`, `scope` (`portal` | `admin`), `expires_at`,
  `consumed_at`. Single-use, ~15-minute TTL. Token is random; only its hash is stored.
- Session store (KV): key `session:<opaque-id>` → `{ userId, scope, permissions, expiresAt }`,
  with KV TTL. Opaque id set in an HttpOnly, Secure, SameSite cookie scoped to `portal.favorintl.org`.

**Flows:**
1. `POST /api/auth/magic-link` — rate-limited (KV); generate token, store hash in `auth_tokens`,
   send link via Resend. Admin path uses `scope=admin`.
2. `POST /api/auth/verify` — rate-limited; validate + consume token; if no local user but SKY match
   by email, provision the user (preserve existing behavior); mint KV session; set cookie.
3. `proxy.ts` (rewritten) — read cookie → KV session lookup → attach `userId`/`scope`/`permissions`;
   enforce the existing public-routes allowlist, portal gating, and the admin per-route permission map
   (`users:manage`, `lms:manage`, `content:manage`, `support:manage`, `admin:access`).
4. Logout / admin revocation — delete the KV session key (a concrete win over stateless JWTs).

**Preserved behavior:** separate admin sign-in (`/admin/login`, `scope=admin`), rate limiting on
auth endpoints, SKY-provisioning-on-verify, dev-bypass when bindings absent in non-production.

---

## 7. Data layer (D1 + Drizzle)

**Surface:** 28 tables across 7 migrations; **76 RLS policies**; one seed file.

Tables: `users`, `user_roles`, `user_profile_details`, `communication_preferences`,
`giving_cache`, `recurring_gifts`, `user_giving_goals`, `foundation_grants`, `onboarding_surveys`,
`courses`, `course_modules`, `course_versions`, `course_cohorts`, `course_cohort_members`,
`course_discussion_threads`, `course_discussion_replies`, `course_module_events`,
`user_course_progress`, `user_course_notes`, `user_quiz_attempts`, `user_course_certificates`,
`portal_content`, `portal_activity_events`, `portal_dashboard_overrides`,
`communication_templates`, `communication_send_logs`, `support_tickets`, `support_messages`,
`admin_audit_logs`.

### 7.1 Schema translation (Postgres → SQLite/D1)

| Postgres construct | Count seen | D1/SQLite target |
|---|---|---|
| `uuid` | 106 | `TEXT` (app-generated UUID v4 via `crypto.randomUUID()`) |
| `now()` / `timestamptz` | 50 | `TEXT` ISO-8601 or `INTEGER` epoch ms; app sets values |
| `boolean` | 31 | `INTEGER` (0/1) |
| `jsonb` | 22 | `TEXT` (JSON string; parsed/serialized in the data layer) |
| `text[]` | 5 | `TEXT` (JSON array) |
| `gen_random_uuid()` defaults | — | app-side id generation (no DB default) |
| sequences / `SERIAL` | — | app UUIDs or `INTEGER PRIMARY KEY AUTOINCREMENT` |

Migrations are re-authored as Drizzle/SQLite migrations under a new D1 migrations directory; the
existing seed (`database/seed/001_courses.sql`) is translated alongside.

### 7.2 RLS → app-layer authorization

D1 has no row-level security. The observed policy patterns are regular and map to three rules:

1. **Owner-scoped** (dominant — `auth.uid()::text = user_id::text`, and `= id::text` on `users`):
   every read/write is scoped by the authenticated `userId` in the data-access layer. No query
   touching an owned table may run without a `userId` filter.
2. **Authenticated-read** (`USING (true)` for `authenticated`): catalog-style tables (e.g. courses)
   readable by any signed-in user; enforced by requiring a valid session.
3. **Public-by-token** (`verification_token IS NOT NULL`): certificate verification stays public via
   the existing `/api/certificates/verify` allowlisted route.

Admin overrides use the existing permission guards (`lib/api/admin-guard.ts`, `lib/admin/*`).
**The implementation plan will produce a per-table ownership matrix** (table → rule → owning column)
so no policy is lost in translation; this is the most security-sensitive part of the migration and
gets explicit test coverage (a user cannot read/write another user's rows).

### 7.3 Query rewrite

Supabase query-builder calls (`.from(...).select/insert/update/delete`) across the API routes are
replaced with Drizzle queries routed through a central data-access layer that injects the `userId`
scope. Centralizing here is what makes the RLS replacement enforceable and testable.

---

## 8. File storage (R2)

Only two code paths use Supabase Storage:
- `app/api/admin/lms/upload/resource/route.ts` — LMS resource uploads.
- `app/api/certificates/issue/route.ts` — generated certificate PDFs.

Both move to an **R2 binding**. Public assets (e.g. LMS resources) use an R2 public bucket or a
read Worker route; certificate PDFs are served through an **auth-gated** route (not public-by-URL),
with public *verification* remaining via the existing verify endpoint. A helper in `lib/storage/r2.ts`
wraps put/get/delete and URL generation.

---

## 9. Supporting concerns

- **Rate limiting:** replace in-memory `lib/rate-limit.ts` with KV TTL counters (`RATE_LIMIT` binding),
  keyed by IP/email per endpoint. Durable Object counters deferred unless accuracy demands it.
- **Secrets / config:** `wrangler.toml` declares D1/R2/KV bindings; secrets via `wrangler secret put`
  and `.dev.vars` locally. Retained secrets: `BLACKBAUD_*`, `RESEND_API_KEY`, `TWILIO_*`,
  `OPENROUTER_API_KEY` (+ AI Gateway config). New: none required for D1/R2/KV (binding-based).
- **Env / dev-mode:** replace `NEXT_PUBLIC_SUPABASE_*` checks in `proxy.ts` and `lib/dev-mode.ts`
  with binding presence checks; keep an offline dev-bypass.
- **AI Gateway:** route OpenRouter calls in `lib/openrouter/client.ts` through Cloudflare AI Gateway
  for caching/observability; no model or vendor change.
- **Background sync:** `/api/blackbaud/sync` stays on-demand for v1; Cron Trigger + Queue noted as a
  future enhancement.

---

## 10. External services retained (no Cloudflare-native equivalent)

Cloudflare has no transactional email send and no SMS, and the CRM/AI are systems of record:
- **Resend** — transactional/marketing email (also sends the magic-link).
- **Twilio** — SMS notifications.
- **Blackbaud SKY** — constituent/giving system of record (bi-directional sync).
- **OpenRouter / DeepSeek V3** — AI (now fronted by AI Gateway).
- **Cloudflare Stream** — video, already native; unchanged.

---

## 11. Cross-app integration (favorintl.org family)

The favorintl.org properties (public Astro site → `favorintl.org`, currently a Pages dev site;
internal hub → `hub.favorintl.org`; this portal → `portal.favorintl.org`) share one parent domain.

- **Auth boundary — portal owns sign-in.** The portal is the single place users log in. The public
  site stays public and deep-links *into* the portal ("Log into the portal" → `portal.favorintl.org`);
  the portal links back. No cross-domain session sharing is built (keeps §6 simple). Revisit only if
  the site itself ever needs gated content.
- **Shared brand / design system.** Extract the brand into a shared layer both apps consume: design
  **tokens** (green `#2b4d24`, gold `#e1a730`, cream canvas; Cormorant Garamond + Montserrat) as CSS
  variables **+ a Tailwind preset**, packaged (e.g. `@favor/brand`) or synced. Both the Next.js portal
  and the Astro site import it, plus a standardized header/footer with two-way cross-links. Tokens +
  preset travel across React and Astro; full React/shadcn component sharing stays portal-only.
- **Shared content/data (future phase).** Design the portal's content/testimonials/courses tables +
  a read API so the Astro site can later pull them — at build time (SSG fetch) or via a Cloudflare
  service binding / shared R2 media bucket (same account). First concrete step when picked up: move
  brand media (logo currently on `storage.googleapis.com`) into a shared R2 bucket both apps use.

---

## 12. Migration approach & phases

Greenfield, so the sequence is build-and-validate rather than data-migrate:

1. **Infra scaffold** — add OpenNext, `wrangler.toml`, D1/R2/KV bindings; app builds and boots on
   Workers locally with a stub route.
2. **Data layer** — Drizzle schema + translated migrations + seed; D1 created; data-access layer with
   per-user scoping; ownership matrix encoded.
3. **Auth** — magic-link tokens (D1) + KV sessions + rewritten `proxy.ts`; Resend wiring; rate limit
   on KV.
4. **Route migration** — swap Supabase query-builder calls to Drizzle, route by route, behind the new
   guards.
5. **Storage** — R2 for the two upload paths.
6. **Integrations** — AI Gateway in front of OpenRouter; confirm Resend/Twilio/SKY env via Wrangler.
7. **Brand layer + cross-links** — shared tokens/preset; portal header/footer links.
8. **Validate** — ESLint, typecheck, OpenNext production build, Playwright E2E green; manual smoke on
   a Workers preview.

---

## 13. Testing strategy

- Keep the Playwright E2E suite (39 tests); update auth helpers to the new magic-link/session flow.
- Add targeted tests for the **authorization boundary**: a user cannot read or mutate another user's
  rows (per the ownership matrix); admin guards enforce per-route permissions.
- Local D1 seeded from the translated seed; tests run against `wrangler dev` / Miniflare.
- Gate completion on: lint pass, typecheck pass, OpenNext build pass, E2E pass, manual Workers-preview
  smoke of login → portal → admin.

---

## 14. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Next 16 Proxy × OpenNext incompatibility | Build blocked | Validate rewritten Proxy on OpenNext early; pin versions; fallback to per-route guards |
| RLS → app-layer gaps (data leak) | High (security) | Explicit ownership matrix + boundary tests; central scoped data layer; no unscoped owned-table queries |
| Postgres→SQLite semantic drift (json, dates, arrays) | Correctness | Encode types in Drizzle; serialize JSON/arrays in the data layer; app-side timestamps |
| D1 limits (size/row/query) | Scaling | Pre-launch volume is small; review D1 limits during scaffold; index hot paths |
| Hidden Supabase coupling beyond known files | Schedule | Plan starts with a full `@supabase` / `lib/supabase` reference sweep before rewrites |

---

## 15. Open questions (non-blocking; resolve during planning)

- Exact `next` / `@opennextjs/cloudflare` versions that build cleanly together with a Proxy file.
- Cookie domain in dev/preview (per-subdomain vs `.favorintl.org`) — production scoped to portal.
- Whether any LMS resource truly needs public-by-URL access vs auth-gated (affects R2 bucket policy).
- Packaging mechanism for the shared brand layer (published package vs synced file in a monorepo-lite).

---

## 16. Success criteria

- Zero `@supabase/*` dependencies; no `lib/supabase/*`; no Supabase env vars required.
- Portal runs on Cloudflare Workers (OpenNext) using D1, R2, and KV bindings only for first-party infra.
- Magic-link login + admin login work end-to-end with revocable KV sessions.
- All 28 tables on D1 with enforced per-user authorization; boundary tests pass.
- Lint, typecheck, OpenNext build, and Playwright E2E all green.
- Public Astro site links into the portal; shared brand tokens consumed by both.

---

## 17. Affected code inventory (first-pass)

- **Remove:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `@supabase/*` deps.
- **Rewrite:** `proxy.ts`; `lib/rate-limit.ts`; `lib/dev-mode.ts`; auth routes
  (`app/api/auth/magic-link`, `app/api/auth/verify`); storage routes
  (`app/api/admin/lms/upload/resource`, `app/api/certificates/issue`).
- **Migrate (query layer):** all `app/api/**` routes performing DB reads/writes → Drizzle via the
  scoped data-access layer.
- **Add:** `wrangler.toml`; OpenNext config; `lib/auth/*` (tokens, sessions); `lib/db/*` (Drizzle
  schema, client, data-access); `lib/storage/r2.ts`; D1 migrations dir; shared brand tokens/preset.
- **Adjust:** `next.config.ts` (image domains, OpenNext needs); `package.json` scripts
  (build/deploy via Wrangler/OpenNext); `lib/openrouter/client.ts` (AI Gateway base URL).
- **Unchanged:** `lib/blackbaud/*`, `lib/resend/*`, `lib/twilio/*`, `lib/cloudflare/*` (Stream).
