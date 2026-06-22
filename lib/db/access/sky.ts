import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import { users, givingCache, communicationPreferences } from "../schema";
import { canManage, AuthorizationError } from "./authz";
import type { BlackbaudConstituent, BlackbaudGift } from "@/types";

// ---------------------------------------------------------------------------
// Blackbaud SKY <-> D1 sync helpers.
//
// External SKY API + Supabase Storage calls live in the route handlers; this
// module owns the D1 reads/writes that used to go through `supabase.from(...)`
// against the `users` / `giving_cache` / `communication_preferences` tables.
//
// Admin writes are guarded with canManage (mirrors the giving/foundation-grant
// access modules). Roles permitted to manage users match the "users:manage"
// admin permission surface.
// ---------------------------------------------------------------------------

const USER_MANAGER_ROLES = ["super_admin", "support_manager"];

// ---------------------------------------------------------------------------
// users (reads)
// ---------------------------------------------------------------------------
export async function getUserById(db: Db, userId: string) {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  return user ?? null;
}

export async function getUserByConstituentId(db: Db, constituentId: string) {
  if (!constituentId) return null;
  const user = await db
    .select()
    .from(users)
    .where(eq(users.blackbaudConstituentId, constituentId))
    .get();
  return user ?? null;
}

// ---------------------------------------------------------------------------
// users (admin write): upsert the local user row from a SKY constituent record.
// Matches on the blackbaud constituent id, falling back to email.
// ---------------------------------------------------------------------------
export async function upsertUserFromConstituent(
  db: Db,
  ctx: AuthContext,
  constituent: BlackbaudConstituent,
) {
  if (!canManage(ctx, USER_MANAGER_ROLES)) throw new AuthorizationError();

  const existing =
    (await db
      .select()
      .from(users)
      .where(eq(users.blackbaudConstituentId, constituent.id))
      .get()) ??
    (await db.select().from(users).where(eq(users.email, constituent.email)).get());

  if (existing) {
    await db
      .update(users)
      .set({
        firstName: constituent.firstName,
        lastName: constituent.lastName,
        phone: constituent.phone ?? existing.phone,
        blackbaudConstituentId: constituent.id,
        constituentType: constituent.constituentCode,
        lifetimeGivingTotal: constituent.lifetimeGiving,
        rddAssignment: constituent.rddAssignment ?? existing.rddAssignment,
      })
      .where(eq(users.id, existing.id));
    return { ...existing, id: existing.id };
  }

  const id = crypto.randomUUID();
  const row = {
    id,
    email: constituent.email,
    firstName: constituent.firstName,
    lastName: constituent.lastName,
    phone: constituent.phone ?? null,
    blackbaudConstituentId: constituent.id,
    constituentType: constituent.constituentCode,
    lifetimeGivingTotal: constituent.lifetimeGiving,
    rddAssignment: constituent.rddAssignment ?? null,
  };
  await db.insert(users).values(row);
  return row;
}

// ---------------------------------------------------------------------------
// giving_cache (reads)
// ---------------------------------------------------------------------------
export async function listGivingCacheForUser(db: Db, userId: string) {
  return db
    .select()
    .from(givingCache)
    .where(eq(givingCache.userId, userId))
    .orderBy(desc(givingCache.giftDate))
    .all();
}

// Owner-scoped single-gift lookup for the donation receipt route.
export async function getOwnedGift(db: Db, ctx: AuthContext, giftId: string) {
  const gift = await db
    .select()
    .from(givingCache)
    .where(and(eq(givingCache.id, giftId), eq(givingCache.userId, ctx.userId)))
    .get();
  return gift ?? null;
}

// ---------------------------------------------------------------------------
// giving_cache (admin write): upsert SKY gifts for a local user, keyed by the
// blackbaud gift id. Roles permitted to manage users may write.
// ---------------------------------------------------------------------------
export async function upsertGivingCacheRows(
  db: Db,
  ctx: AuthContext,
  userId: string,
  gifts: BlackbaudGift[],
) {
  if (!canManage(ctx, USER_MANAGER_ROLES)) throw new AuthorizationError();
  const now = new Date().toISOString();
  let written = 0;
  for (const gift of gifts) {
    const existing = gift.id
      ? await db
          .select()
          .from(givingCache)
          .where(eq(givingCache.blackbaudGiftId, gift.id))
          .get()
      : null;
    if (existing) {
      await db
        .update(givingCache)
        .set({
          userId,
          giftDate: gift.date,
          amount: gift.amount,
          designation: gift.designation,
          isRecurring: gift.type === "recurring",
          syncedAt: now,
        })
        .where(eq(givingCache.id, existing.id));
    } else {
      await db.insert(givingCache).values({
        id: crypto.randomUUID(),
        userId,
        giftDate: gift.date,
        amount: gift.amount,
        designation: gift.designation,
        blackbaudGiftId: gift.id || null,
        isRecurring: gift.type === "recurring",
        receiptSent: false,
        syncedAt: now,
        source: "imported" as const,
        note: null,
        createdAt: now,
      });
    }
    written += 1;
  }
  return written;
}

// ---------------------------------------------------------------------------
// communication_preferences (owner-scoped write): persist the solicit codes
// last pushed to SKY for the calling user.
// ---------------------------------------------------------------------------
export async function upsertSolicitCodePrefs(
  db: Db,
  userId: string,
  solicitCodes: string[],
  syncedAt: string,
) {
  const existing = await db
    .select()
    .from(communicationPreferences)
    .where(eq(communicationPreferences.userId, userId))
    .get();
  if (existing) {
    await db
      .update(communicationPreferences)
      .set({
        blackbaudSolicitCodes: solicitCodes,
        lastSyncedAt: syncedAt,
        updatedAt: syncedAt,
      })
      .where(eq(communicationPreferences.userId, userId));
  } else {
    await db.insert(communicationPreferences).values({
      id: crypto.randomUUID(),
      userId,
      blackbaudSolicitCodes: solicitCodes,
      lastSyncedAt: syncedAt,
      updatedAt: syncedAt,
    });
  }
}
