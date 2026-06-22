# Data Layer (D1 + Drizzle + Authorization) Implementation Plan (Plan 2 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase Postgres + RLS with Cloudflare D1 (SQLite) accessed through Drizzle ORM, and reproduce every Row-Level-Security rule as enforced application-layer authorization.

**Architecture:** One Drizzle schema (split by domain) maps all 28 tables to SQLite. A `getDb()` helper builds a Drizzle client over the `DB` binding. All data access goes through a `lib/db/access/*` layer that takes an explicit `AuthContext` (`userId`, `isAdmin`, `roleKeys`, `constituentType`) and applies the ownership / role / constituent-type / public-token rules from the migrations — there is no unscoped query against an owned table. Postgres RLS is therefore enforced in code and covered by authorization boundary tests.

**Tech Stack:** Drizzle ORM (`drizzle-orm`), `drizzle-kit` (SQLite/D1 dialect), Cloudflare D1, Vitest (unit) + Playwright (existing E2E), Wrangler for local D1.

**Prerequisites:** Plan 1 complete (D1 `favor-portal` bound as `DB`, `getCloudflareContext` works in `next dev`). Branch `cloudflare-migration`.

**Source of truth for columns:** the Postgres DDL in `database/migrations/001..007_*.sql`. Each schema task below cites the exact source file(s); translate columns per the type-mapping table in §A. This is a deterministic mechanical translation, not a placeholder — the SQL is the authoritative column spec.

**Milestone (done when):** all 28 tables exist in D1 via Drizzle migrations; the seed loads; the access layer enforces the ownership matrix (§C); authorization boundary tests pass (a user cannot read/write another user's rows; non-managers cannot reach admin tables); lint + typecheck green.

---

## A. Postgres -> SQLite/Drizzle type mapping (apply everywhere)

| Postgres | Drizzle (SQLite) | Notes |
|---|---|---|
| `UUID PRIMARY KEY DEFAULT uuid_generate_v4()` | `text("id").primaryKey().$defaultFn(() => crypto.randomUUID())` | app-generated UUID |
| `UUID REFERENCES x(id)` | `text("...").references(() => x.id)` | FK; add `{ onDelete: "cascade" }` / `"set null"` to match source |
| `TEXT` / `TEXT NOT NULL` | `text("...")` / `.notNull()` | |
| `TEXT CHECK (x IN (...))` | `text("...", { enum: [...] })` | Drizzle enum-typed text |
| `TEXT[]` | `text("...", { mode: "json" }).$type<string[]>()` | JSON array; default via `.$defaultFn(() => [])` |
| `JSONB` | `text("...", { mode: "json" }).$type<...>()` | JSON string |
| `BOOLEAN` (default TRUE/FALSE) | `integer("...", { mode: "boolean" }).default(true/false)` | 0/1 |
| `INTEGER` | `integer("...")` | |
| `DECIMAL` | `real("...")` | money is small-scale here; `real` acceptable (precision caveat noted) |
| `DATE` | `text("...")` | ISO `YYYY-MM-DD` string |
| `TIMESTAMP WITH TIME ZONE DEFAULT NOW()` | `text("...").$defaultFn(() => new Date().toISOString())` | ISO-8601 text; app sets value |
| `UNIQUE(a,b)` | `unique().on(t.a, t.b)` in table extra config | |
| partial unique index `WHERE col IS NOT NULL` | `uniqueIndex(...).on(t.col).where(sql\`${t.col} is not null\`)` | certificate tokens |
| `update_updated_at` trigger | none — set `updatedAt` in the access-layer update methods | no DB triggers in D1 |

`crypto.randomUUID()` and `new Date()` are available in the Workers runtime and in `next dev`.

---

## B. File structure

```
drizzle.config.ts                      # drizzle-kit config (dialect sqlite, schema + out dir)
lib/db/
  client.ts                            # getDb(): DrizzleD1Database over env.DB
  schema/
    index.ts                           # re-exports all tables
    _shared.ts                         # pk()/timestamp helpers
    users.ts                           # users, user_roles, user_profile_details, onboarding_surveys
    giving.ts                          # giving_cache, recurring_gifts, user_giving_goals, foundation_grants, communication_preferences
    lms.ts                             # courses, course_modules, user_course_progress, user_course_notes,
                                       #   user_course_certificates, course_versions, user_quiz_attempts, course_module_events
    community.ts                       # course_cohorts, course_cohort_members, course_discussion_threads, course_discussion_replies
    portal.ts                          # portal_content, support_tickets, support_messages, communication_templates,
                                       #   communication_send_logs, portal_activity_events, portal_dashboard_overrides, admin_audit_logs
  auth-context.ts                      # AuthContext type + buildAuthContext(db, userId)
  access/
    authz.ts                           # rule helpers: assertOwner, canManage(roleKeys), constituent visibility
    giving-goals.ts                    # worked example owner-scoped access module (template for the rest)
    ...                                # one access module per domain, added incrementally
db/migrations/                         # generated SQL migrations (drizzle-kit)
db/seed/courses.sql                    # seed translated from database/seed/001_courses.sql
tests/db/                              # Vitest authorization boundary tests
```

Keep `database/migrations/*.sql` (Postgres originals) as historical reference; live migrations are the generated D1 ones under `db/migrations/`.

---

## C. Ownership / authorization matrix (the RLS rules to reproduce)

`AuthContext = { userId: string; isAdmin: boolean; roleKeys: string[]; constituentType: string | null }`.
Manager check `canManage(ctx, roles[])` = `ctx.isAdmin || ctx.roleKeys.some(r => roles.includes(r))`.

| Table | Read rule | Write rule | Source |
|---|---|---|---|
| `users` | own row (`id == userId`); admin/analyst | own row; insert own | 001,002,006 |
| `user_roles` | own rows; admin manage | admin only | 003 |
| `user_profile_details` | own (`user_id`) | own | 006 |
| `onboarding_surveys` | own | own | 001 |
| `communication_preferences` | own | own | 001,006 |
| `giving_cache` | own; admin/analyst | server/admin only (SKY/portal flows) | 001,005 |
| `recurring_gifts` | own | own (status/cancel) | 001 |
| `user_giving_goals` | own | own CRUD | 006 |
| `foundation_grants` | own; admin | admin only | 001 |
| `courses` | constituent-type + published/window visibility, or admin/lms | admin/lms manage | 001-003 |
| `course_modules` | via parent course visibility | admin/lms manage | 001-003 |
| `user_course_progress` | own | own | 001 |
| `user_course_notes` | own | own | 002 |
| `user_course_certificates` | own; admin; **public by `verification_token`** | own insert/update; admin manage | 002,003 |
| `course_versions` | admin/lms/analyst | lms create | 003 |
| `user_quiz_attempts` | own; admin/lms/analyst | own insert | 003 |
| `course_module_events` | own; admin/lms/analyst | own insert | 003 |
| `course_cohorts` | any authenticated (course exists); admin/lms manage | admin/lms manage | 004 |
| `course_cohort_members` | own; cohort-visible; admin/lms/analyst | own join active cohort; admin/lms manage | 004 |
| `course_discussion_threads` | course/cohort-visible | author create; author/lms update/delete | 004 |
| `course_discussion_replies` | thread-visible | author create (thread unlocked); author/lms update/delete | 004 |
| `portal_content` | published + access_level/constituent-type; admin | content_manager/lms manage | 005 |
| `support_tickets` | own (`requester_user_id`); admin/support/analyst | own create; support manager update | 005 |
| `support_messages` | via accessible ticket | partner on own ticket / staff manager | 005 |
| `communication_templates` | comms managers | comms managers | 005 |
| `communication_send_logs` | managers/analyst | managers insert | 005 |
| `portal_activity_events` | own; admin/analyst/support | own insert | 005 |
| `portal_dashboard_overrides` | any authenticated | content_manager manage | 007 |
| `admin_audit_logs` | admin/analyst/lms | managers insert | 003 |

Role keys: `super_admin, lms_manager, content_manager, support_manager, analyst, viewer` (from `user_roles`). Reuse `lib/admin/roles.ts` / `lib/admin/permissions.ts` for role->permission resolution where it already exists.

---

## Task 1: Install Drizzle + drizzle-kit + Vitest

**Files:** Modify `package.json`

- [ ] **Step 1: Install**
```bash
npm install drizzle-orm
npm install -D drizzle-kit vitest better-sqlite3 @types/better-sqlite3
```
Expected: added to dependencies/devDependencies, no ERESOLVE.

- [ ] **Step 2: Add scripts to `package.json`** (in `"scripts"`):
```json
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply favor-portal --local",
    "db:migrate:remote": "wrangler d1 migrations apply favor-portal --remote",
    "db:seed:local": "wrangler d1 execute favor-portal --local --file db/seed/courses.sql",
    "test:unit": "vitest run"
```

- [ ] **Step 3: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore: add drizzle, drizzle-kit, vitest, better-sqlite3"
```

---

## Task 2: drizzle-kit config + DB client

**Files:** Create `drizzle.config.ts`, `lib/db/client.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema/index.ts",
  out: "./db/migrations",
});
```

- [ ] **Step 2: Create `lib/db/client.ts`**
```typescript
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
```

- [ ] **Step 3: Commit**
```bash
git add drizzle.config.ts lib/db/client.ts
git commit -m "feat: add drizzle-kit config and D1 client"
```

---

## Task 3: Core/users schema (worked reference for the type rules)

**Files:** Create `lib/db/schema/users.ts`, `lib/db/schema/index.ts`

Translate `users`, `user_roles`, `user_profile_details`, `onboarding_surveys` from `001` (+ `002` is_admin, `006` onboarding/profile) per the §A rules.

- [ ] **Step 1: Create `lib/db/schema/users.ts`**
```typescript
import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";

export const CONSTITUENT_TYPES = ["individual","major_donor","church","foundation","daf","ambassador","volunteer"] as const;
export const USER_ROLE_KEYS = ["super_admin","lms_manager","content_manager","support_manager","analyst","viewer"] as const;

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  blackbaudConstituentId: text("blackbaud_constituent_id"),
  constituentType: text("constituent_type", { enum: CONSTITUENT_TYPES }),
  lifetimeGivingTotal: real("lifetime_giving_total").default(0),
  rddAssignment: text("rdd_assignment"),
  avatarUrl: text("avatar_url"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  onboardingRequired: integer("onboarding_required", { mode: "boolean" }).notNull().default(false),
  onboardingCompletedAt: text("onboarding_completed_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  lastLogin: text("last_login"),
});

export const userRoles = sqliteTable("user_roles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleKey: text("role_key", { enum: USER_ROLE_KEYS }).notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => [unique().on(t.userId, t.roleKey)]);

export const userProfileDetails = sqliteTable("user_profile_details", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  street: text("street"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const onboardingSurveys = sqliteTable("onboarding_surveys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  howHeard: text("how_heard"),
  rddContact: text("rdd_contact"),
  interests: text("interests", { mode: "json" }).$type<string[]>().$defaultFn(() => []),
  churchConnection: integer("church_connection", { mode: "boolean" }).default(false),
  completedAt: text("completed_at").$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 2: Create `lib/db/schema/index.ts`**
```typescript
export * from "./users";
```

- [ ] **Step 3: Typecheck** : `npm run typecheck` -> Expected 0 errors.

- [ ] **Step 4: Commit**
```bash
git add lib/db/schema/users.ts lib/db/schema/index.ts
git commit -m "feat(db): users/roles/profile/onboarding schema"
```

---

## Task 4: Shared helpers + remaining domain schemas

**Files:** Create `lib/db/schema/_shared.ts`, `giving.ts`, `lms.ts`, `community.ts`, `portal.ts`; update `index.ts`

- [ ] **Step 1: Create `lib/db/schema/_shared.ts`**
```typescript
import { text } from "drizzle-orm/sqlite-core";

export const pk = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
export const tsDefault = (name: string) => text(name).$defaultFn(() => new Date().toISOString());
```

- [ ] **Step 2: Create `lib/db/schema/giving.ts`** — translate `giving_cache` (001,005), `recurring_gifts` (001), `user_giving_goals` (006), `foundation_grants` (001), `communication_preferences` (001,006). Owner tables use `userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" })`. Enum CHECK lists become `{ enum: [...] }`: recurring `frequency` `["monthly","quarterly","annual"]` / `status` `["active","paused","cancelled"]`; goals `category` `["annual","project","monthly","custom"]`; giving_cache `source` `["portal","imported","admin"]`; prefs `report_period` `["quarterly","annual"]`. `blackbaud_solicit_codes` is json string[]. Money cols `real`. Dates `text`. Booleans `integer({mode:"boolean"})` with matching defaults.

- [ ] **Step 3: Create `lib/db/schema/lms.ts`** — translate `courses` (001+002+003 incl. `status` `["draft","published"]`, `is_locked`,`is_paid`,`price` real,`tags` json, `cover_image`,`enforce_sequential`,`publish_at`,`unpublish_at`,`updated_at`, `access_level` `["partner","major_donor","church","foundation","ambassador"]`), `course_modules` (001+002 incl. `module_type` `["video","reading","quiz"]`,`resource_url`,`notes`,`quiz_payload` json,`pass_threshold` int), `user_course_progress` (001, `unique(userId,moduleId)`), `user_course_notes` (002, `unique(userId,moduleId)`), `user_course_certificates` (002+003 incl. `verification_token`,`certificate_number`,`metadata` json, `unique(userId,courseId)`), `course_versions` (003, `snapshot` json, `unique(courseId,versionNumber)`), `user_quiz_attempts` (003, `answers`/`option_order`/`metadata` json, `question_order` json string[], `unique(userId,moduleId,attemptNumber)`), `course_module_events` (003, `event_type` enum per source).

- [ ] **Step 4: Create `lib/db/schema/community.ts`** — translate `course_cohorts` (004, `unique(courseId,name)`), `course_cohort_members` (004, `membership_role` `["learner","mentor","instructor"]`, `unique(cohortId,userId)`), `course_discussion_threads` (004, incl. `pinned`,`locked`,`reply_count` int,`last_activity_at`), `course_discussion_replies` (004, `is_instructor_reply` bool). The Postgres reply-count/last-activity trigger is reproduced in the community access module (Task 8), not the DB.

- [ ] **Step 5: Create `lib/db/schema/portal.ts`** — translate `portal_content` (005: `type` `["report","update","resource","prayer","story"]`, `access_level` `["all","partner","major_donor","church","foundation","daf","ambassador","volunteer"]`, `status` `["draft","published"]`, `tags` json), `support_tickets` (005: `status` `["open","in_progress","resolved"]`, `priority` `["low","normal","high","urgent"]`), `support_messages` (005: `sender` `["partner","staff"]`), `communication_templates` (005: `channel` `["email","sms","direct_mail"]`, `status` `["active","draft"]`), `communication_send_logs` (005: `status` `["queued","sent","failed"]`, `metadata` json), `portal_activity_events` (005: `type` `["gift_created","course_completed","course_progress","content_viewed","support_ticket","profile_updated","login"]`, `metadata` json), `portal_dashboard_overrides` (007: `role_key` unique constituent enum, `highlights`/`actions` json arrays), `admin_audit_logs` (003: `details` json).

- [ ] **Step 6: Update `lib/db/schema/index.ts`**
```typescript
export * from "./users";
export * from "./giving";
export * from "./lms";
export * from "./community";
export * from "./portal";
```

- [ ] **Step 7: Typecheck** : `npm run typecheck` -> 0 errors.

- [ ] **Step 8: Commit**
```bash
git add lib/db/schema
git commit -m "feat(db): full Drizzle schema for all 28 tables"
```

---

## Task 5: Generate + apply D1 migrations (local)

**Files:** Generates `db/migrations/*.sql`; Modify `wrangler.jsonc`

- [ ] **Step 1: Generate** : `npm run db:generate`
Expected: a `db/migrations/0000_*.sql` with `CREATE TABLE` for all 28 tables. Inspect: every table present; FKs and unique constraints correct.

- [ ] **Step 2: Point wrangler at the migrations dir** — add to `wrangler.jsonc`: `"migrations_dir": "db/migrations",`

- [ ] **Step 3: Apply locally** : `npm run db:migrate:local` -> "Migrations applied".

- [ ] **Step 4: Verify** : `npx wrangler d1 execute favor-portal --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"`
Expected: all 28 tables listed.

- [ ] **Step 5: Commit**
```bash
git add db/migrations wrangler.jsonc
git commit -m "feat(db): generate and apply initial D1 migration"
```

---

## Task 6: AuthContext + authorization helpers (TDD)

**Files:** Create `lib/db/auth-context.ts`, `lib/db/access/authz.ts`; Test `tests/db/authz.test.ts`

- [ ] **Step 1: Write failing test `tests/db/authz.test.ts`**
```typescript
import { describe, it, expect } from "vitest";
import { canManage, canViewCourseAccessLevel } from "@/lib/db/access/authz";

const base = { userId: "u1", isAdmin: false, roleKeys: [] as string[], constituentType: "individual" as string | null };

describe("authz helpers", () => {
  it("admin can manage anything", () => {
    expect(canManage({ ...base, isAdmin: true }, ["lms_manager"])).toBe(true);
  });
  it("role match grants manage", () => {
    expect(canManage({ ...base, roleKeys: ["lms_manager"] }, ["lms_manager"])).toBe(true);
  });
  it("no role denies manage", () => {
    expect(canManage(base, ["lms_manager"])).toBe(false);
  });
  it("partner course visible to individual", () => {
    expect(canViewCourseAccessLevel(base, "partner")).toBe(true);
  });
  it("major_donor course hidden from individual", () => {
    expect(canViewCourseAccessLevel(base, "major_donor")).toBe(false);
  });
  it("admin sees any access level", () => {
    expect(canViewCourseAccessLevel({ ...base, isAdmin: true }, "major_donor")).toBe(true);
  });
});
```

- [ ] **Step 2: Run -> fail** : `npm run test:unit` -> FAIL (module not found).

- [ ] **Step 3: Create `lib/db/auth-context.ts`**
```typescript
import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { users, userRoles } from "./schema";

export type AuthContext = {
  userId: string;
  isAdmin: boolean;
  roleKeys: string[];
  constituentType: string | null;
};

export async function buildAuthContext(db: Db, userId: string): Promise<AuthContext | null> {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return null;
  const roles = await db.select({ roleKey: userRoles.roleKey }).from(userRoles).where(eq(userRoles.userId, userId)).all();
  return {
    userId,
    isAdmin: Boolean(user.isAdmin),
    roleKeys: roles.map((r) => r.roleKey),
    constituentType: user.constituentType ?? null,
  };
}
```

- [ ] **Step 4: Create `lib/db/access/authz.ts`**
```typescript
import type { AuthContext } from "../auth-context";

export class AuthorizationError extends Error {
  constructor(message = "Forbidden") { super(message); this.name = "AuthorizationError"; }
}

export function canManage(ctx: AuthContext, roles: string[]): boolean {
  return ctx.isAdmin || ctx.roleKeys.some((r) => roles.includes(r));
}

export function assertOwner(ctx: AuthContext, ownerId: string): void {
  if (ctx.userId !== ownerId) throw new AuthorizationError();
}

// Course/content access-level visibility by constituent type (mirrors migrations 002/003/005).
const ACCESS_LEVEL_MATRIX: Record<string, string[]> = {
  partner: ["individual","major_donor","church","foundation","daf","ambassador","volunteer"],
  major_donor: ["major_donor","foundation"],
  church: ["church"],
  foundation: ["foundation"],
  ambassador: ["ambassador"],
  daf: ["daf"],
  volunteer: ["volunteer"],
  all: ["individual","major_donor","church","foundation","daf","ambassador","volunteer"],
};

export function canViewCourseAccessLevel(ctx: AuthContext, accessLevel: string): boolean {
  if (ctx.isAdmin) return true;
  if (accessLevel === "all") return true;
  const allowed = ACCESS_LEVEL_MATRIX[accessLevel] ?? [];
  return ctx.constituentType != null && allowed.includes(ctx.constituentType);
}
```

- [ ] **Step 5: Run -> pass** : `npm run test:unit` -> PASS.

- [ ] **Step 6: Commit**
```bash
git add lib/db/auth-context.ts lib/db/access/authz.ts tests/db/authz.test.ts
git commit -m "feat(db): auth context + authorization helpers (RLS in code)"
```

---

## Task 7: Worked owner-scoped access module — giving goals (template)

**Files:** Create `lib/db/access/giving-goals.ts`; Test `tests/db/giving-goals.test.ts`; Create `tests/db/helpers.ts`

This is the **template every owner-scoped access module follows**: every method takes `ctx: AuthContext`, filters by `ctx.userId`, and verifies ownership before mutating. Tests run against an in-memory better-sqlite3 Drizzle db with the **real generated migrations** applied (no hand-written DDL).

- [ ] **Step 1: Create `tests/db/helpers.ts`** (shared in-memory db builder)
```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";

export function makeTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "db/migrations" });
  return db;
}

export const ctxFor = (userId: string, over: Partial<{ isAdmin: boolean; roleKeys: string[]; constituentType: string | null }> = {}) => ({
  userId, isAdmin: false, roleKeys: [] as string[], constituentType: "individual" as string | null, ...over,
});
```

- [ ] **Step 2: Write failing test `tests/db/giving-goals.test.ts`**
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, ctxFor } from "./helpers";
import { listGivingGoals, createGivingGoal, deleteGivingGoal } from "@/lib/db/access/giving-goals";
import { AuthorizationError } from "@/lib/db/access/authz";

let db: ReturnType<typeof makeTestDb>;
const ctxA = ctxFor("userA");
const ctxB = ctxFor("userB");
beforeEach(() => { db = makeTestDb(); });

describe("giving goals access (owner-scoped)", () => {
  it("a user only lists their own goals", async () => {
    await createGivingGoal(db, ctxA, { name: "A goal", targetAmount: 100, deadline: "2026-12-31", category: "custom" });
    await createGivingGoal(db, ctxB, { name: "B goal", targetAmount: 200, deadline: "2026-12-31", category: "custom" });
    const a = await listGivingGoals(db, ctxA);
    expect(a).toHaveLength(1);
    expect(a[0].name).toBe("A goal");
  });

  it("a user cannot delete another user's goal", async () => {
    const g = await createGivingGoal(db, ctxA, { name: "A goal", targetAmount: 100, deadline: "2026-12-31", category: "custom" });
    await expect(deleteGivingGoal(db, ctxB, g.id)).rejects.toBeInstanceOf(AuthorizationError);
    expect(await listGivingGoals(db, ctxA)).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run -> fail** : `npm run test:unit` -> FAIL (module not found).

- [ ] **Step 4: Create `lib/db/access/giving-goals.ts`**
```typescript
import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import { userGivingGoals } from "../schema";
import { AuthorizationError } from "./authz";

export type NewGivingGoal = {
  name: string; targetAmount: number; deadline: string;
  category: "annual" | "project" | "monthly" | "custom"; description?: string;
};

export async function listGivingGoals(db: Db, ctx: AuthContext) {
  return db.select().from(userGivingGoals).where(eq(userGivingGoals.userId, ctx.userId)).all();
}

export async function createGivingGoal(db: Db, ctx: AuthContext, input: NewGivingGoal) {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(), userId: ctx.userId, name: input.name,
    targetAmount: input.targetAmount, currentAmount: 0, deadline: input.deadline,
    category: input.category, description: input.description ?? null, createdAt: now, updatedAt: now,
  };
  await db.insert(userGivingGoals).values(row);
  return row;
}

export async function deleteGivingGoal(db: Db, ctx: AuthContext, id: string) {
  const existing = await db.select().from(userGivingGoals).where(eq(userGivingGoals.id, id)).get();
  if (!existing) return;
  if (existing.userId !== ctx.userId) throw new AuthorizationError();
  await db.delete(userGivingGoals).where(and(eq(userGivingGoals.id, id), eq(userGivingGoals.userId, ctx.userId)));
}
```
(Note: the in-memory test db is typed as `better-sqlite3` Drizzle while production uses D1 Drizzle. Access functions accept the shared `Db` type; the better-sqlite3 db is structurally compatible for these query builders. If a type mismatch arises, widen the access-fn db param to `BaseSQLiteDatabase<any, any, typeof schema>`.)

- [ ] **Step 5: Run -> pass** : `npm run test:unit` -> PASS.

- [ ] **Step 6: Commit**
```bash
git add lib/db/access/giving-goals.ts tests/db/giving-goals.test.ts tests/db/helpers.ts
git commit -m "feat(db): giving-goals access module (owner-scoped template) + tests"
```

---

## Task 8: Remaining access modules by domain (follow the Task 7 template)

For each module: methods take `ctx: AuthContext`; owner tables filter/verify by `ctx.userId` (or `requesterUserId`/`authorUserId` per the matrix); manager-gated tables call `canManage(ctx, [...])` and throw `AuthorizationError` otherwise; catalog tables filter by `canViewCourseAccessLevel`. Write a boundary test per module proving cross-user/role denial (mirror Task 7). Create -> test (fail->pass) -> commit each module separately:

- [ ] `lib/db/access/profile.ts` — users (own read/update, insert-own), user_profile_details, onboarding_surveys, communication_preferences.
- [ ] `lib/db/access/giving.ts` — giving_cache (read own; writes manager/SKY), recurring_gifts (own), foundation_grants (own read; admin write).
- [ ] `lib/db/access/courses.ts` — courses + course_modules read via `canViewCourseAccessLevel` + published/window check; manage via `canManage(ctx, ["lms_manager"])`.
- [ ] `lib/db/access/learning.ts` — user_course_progress, user_course_notes (own); user_quiz_attempts, course_module_events (own write; own+lms/analyst read); user_course_certificates (own + admin; plus a ctx-free `getCertificateByToken(db, token)` for public verification).
- [ ] `lib/db/access/community.ts` — cohorts (read course-scoped; manage lms), cohort_members (own join active/leave; manage lms), threads/replies (author writes, course/cohort-scoped reads). Reproduce reply-count/last-activity in `createReply`/`deleteReply`.
- [ ] `lib/db/access/content.ts` — portal_content (read published+access-level; manage content_manager), portal_dashboard_overrides (read all; manage content_manager).
- [ ] `lib/db/access/support.ts` — support_tickets (own + support manager), support_messages (ticket-scoped; partner-on-own vs staff-manager).
- [ ] `lib/db/access/comms.ts` — communication_templates (comms managers), communication_send_logs (managers insert; managers/analyst read).
- [ ] `lib/db/access/activity.ts` — portal_activity_events (own insert; own+analyst/support read), admin_audit_logs (managers insert; admin/analyst/lms read), course_versions (lms create; admin/lms/analyst read).

---

## Task 9: Seed translation

**Files:** Create `db/seed/courses.sql`

- [ ] **Step 1: Create `db/seed/courses.sql`** — copy the INSERT statements from `database/seed/001_courses.sql` (the 4 courses + their modules). They are plain `INSERT INTO courses (...) VALUES (...)` / `INSERT INTO course_modules (...)` and are SQLite-compatible as-is. Keep the same UUIDs/values.
- [ ] **Step 2: Run** `npm run db:seed:local`; verify `npx wrangler d1 execute favor-portal --local --command "SELECT count(*) AS n FROM courses"` -> 4.
- [ ] **Step 3: Commit**
```bash
git add db/seed
git commit -m "feat(db): seed courses into local D1"
```

---

## Task 10: Health-route DB extension + full gate

**Files:** Modify `app/api/health/route.ts`, Test `tests/e2e/health.spec.ts`

- [ ] **Step 1: Extend health route** to also count tables via Drizzle: query `SELECT count(*) AS n FROM sqlite_master WHERE type='table'` through `env.DB.prepare(...)`, return `tableCount`. Update `tests/e2e/health.spec.ts` to assert `body.tableCount >= 28`.
- [ ] **Step 2: Migrate + seed local, run E2E** : `npm run db:migrate:local && npm run db:seed:local && npx playwright test tests/e2e/health.spec.ts` -> PASS.
- [ ] **Step 3: Gate** — `npm run lint` (clean), `npm run typecheck` (0), `npm run test:unit` (pass), health E2E (pass).
- [ ] **Step 4: Commit**
```bash
git add app/api/health/route.ts tests/e2e/health.spec.ts
git commit -m "feat(db): health route reports D1 table count"
```

---

## Self-review checklist (run before execution)
- Every table in §C maps to a schema task (Tasks 3-4) and an access module (Tasks 7-8). ✓
- No owned-table query without a `ctx.userId` filter; every mutating method verifies ownership or `canManage`. ✓
- Public-by-token certificate read is the only ctx-free read (Task 8 learning.ts). ✓
- Types `AuthContext`, `Db`, `canManage`, `assertOwner`, `canViewCourseAccessLevel`, `AuthorizationError` are defined in Task 6 and reused verbatim in Tasks 7-8. ✓

## Notes for next plans
- **Plan 3 (auth):** `buildAuthContext` + the access layer here are what the magic-link session attaches to each request; `users` is the identity store.
- **Plan 4 (routes):** each API route swaps Supabase calls for the matching `lib/db/access/*` module, passing the request's `AuthContext`.
- Remote D1 (`db:migrate:remote`) is applied at first cloud deploy, not locally.
