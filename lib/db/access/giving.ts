import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import { givingCache, recurringGifts, foundationGrants } from "../schema";
import { AuthorizationError } from "./authz";

export type NewOneTimeGift = {
  amount: number;
  designation: string;
  giftDate: string;
  note?: string;
};

export type RecurringGiftStatus = "active" | "paused" | "cancelled";

export type RecurringGiftFrequency = "monthly" | "quarterly" | "annual";

export type NewRecurringGift = {
  amount: number;
  frequency: RecurringGiftFrequency;
  nextChargeDate: string;
  stripeSubscriptionId: string;
  status?: RecurringGiftStatus;
};

export type UpdateRecurringGift = {
  amount?: number;
  frequency?: RecurringGiftFrequency;
  nextChargeDate?: string;
};

export type NewFoundationGrant = {
  userId: string;
  grantName: string;
  amount: number;
  startDate: string;
  endDate?: string;
  status?: "pending" | "approved" | "active" | "completed" | "rejected";
  nextReportDue?: string;
  notes?: string;
};

export type UpdateFoundationGrant = {
  grantName?: string;
  amount?: number;
  startDate?: string;
  endDate?: string;
  status?: "pending" | "approved" | "active" | "completed" | "rejected";
  nextReportDue?: string;
  notes?: string;
};

// giving_cache (owner-scoped)
export async function listGivingHistory(db: Db, ctx: AuthContext) {
  return db
    .select()
    .from(givingCache)
    .where(eq(givingCache.userId, ctx.userId))
    .orderBy(desc(givingCache.giftDate))
    .all();
}

export async function createOneTimeGift(db: Db, ctx: AuthContext, input: NewOneTimeGift) {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    userId: ctx.userId,
    giftDate: input.giftDate,
    amount: input.amount,
    designation: input.designation,
    blackbaudGiftId: null,
    isRecurring: false,
    receiptSent: false,
    syncedAt: now,
    source: "portal" as const,
    note: input.note ?? null,
    createdAt: now,
  };
  await db.insert(givingCache).values(row);
  return row;
}

// recurring_gifts (owner-scoped)
export async function listRecurringGifts(db: Db, ctx: AuthContext) {
  return db.select().from(recurringGifts).where(eq(recurringGifts.userId, ctx.userId)).all();
}

export async function createRecurringGift(db: Db, ctx: AuthContext, input: NewRecurringGift) {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    userId: ctx.userId,
    amount: input.amount,
    frequency: input.frequency,
    nextChargeDate: input.nextChargeDate,
    stripeSubscriptionId: input.stripeSubscriptionId,
    status: input.status ?? ("active" as const),
    createdAt: now,
  };
  await db.insert(recurringGifts).values(row);
  return row;
}

export async function updateRecurringGift(
  db: Db,
  ctx: AuthContext,
  id: string,
  fields: UpdateRecurringGift,
) {
  const existing = await db.select().from(recurringGifts).where(eq(recurringGifts.id, id)).get();
  if (!existing) return null;
  if (existing.userId !== ctx.userId) throw new AuthorizationError();
  const updated = {
    ...existing,
    ...(fields.amount !== undefined ? { amount: fields.amount } : {}),
    ...(fields.frequency !== undefined ? { frequency: fields.frequency } : {}),
    ...(fields.nextChargeDate !== undefined ? { nextChargeDate: fields.nextChargeDate } : {}),
  };
  await db
    .update(recurringGifts)
    .set(updated)
    .where(and(eq(recurringGifts.id, id), eq(recurringGifts.userId, ctx.userId)));
  return updated;
}

export async function deleteRecurringGift(db: Db, ctx: AuthContext, id: string) {
  const existing = await db.select().from(recurringGifts).where(eq(recurringGifts.id, id)).get();
  if (!existing) return false;
  if (existing.userId !== ctx.userId) throw new AuthorizationError();
  await db
    .delete(recurringGifts)
    .where(and(eq(recurringGifts.id, id), eq(recurringGifts.userId, ctx.userId)));
  return true;
}

export async function updateRecurringGiftStatus(
  db: Db,
  ctx: AuthContext,
  id: string,
  status: RecurringGiftStatus,
) {
  const existing = await db.select().from(recurringGifts).where(eq(recurringGifts.id, id)).get();
  if (!existing) return null;
  if (existing.userId !== ctx.userId) throw new AuthorizationError();
  await db
    .update(recurringGifts)
    .set({ status })
    .where(and(eq(recurringGifts.id, id), eq(recurringGifts.userId, ctx.userId)));
  return { ...existing, status };
}

export async function cancelRecurringGift(db: Db, ctx: AuthContext, id: string) {
  const existing = await db.select().from(recurringGifts).where(eq(recurringGifts.id, id)).get();
  if (!existing) return null;
  if (existing.userId !== ctx.userId) throw new AuthorizationError();
  await db
    .update(recurringGifts)
    .set({ status: "cancelled" })
    .where(and(eq(recurringGifts.id, id), eq(recurringGifts.userId, ctx.userId)));
  return { ...existing, status: "cancelled" as const };
}

// foundation_grants (owner-scoped reads, admin-only writes)
export async function listFoundationGrants(db: Db, ctx: AuthContext) {
  return db.select().from(foundationGrants).where(eq(foundationGrants.userId, ctx.userId)).all();
}

export async function createFoundationGrant(db: Db, ctx: AuthContext, input: NewFoundationGrant) {
  if (!ctx.isAdmin) throw new AuthorizationError();
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    userId: input.userId,
    grantName: input.grantName,
    amount: input.amount,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    status: input.status ?? null,
    nextReportDue: input.nextReportDue ?? null,
    notes: input.notes ?? null,
    createdAt: now,
  };
  await db.insert(foundationGrants).values(row);
  return row;
}

export async function updateFoundationGrant(
  db: Db,
  ctx: AuthContext,
  id: string,
  input: UpdateFoundationGrant,
) {
  if (!ctx.isAdmin) throw new AuthorizationError();
  await db
    .update(foundationGrants)
    .set({
      ...(input.grantName !== undefined ? { grantName: input.grantName } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.nextReportDue !== undefined ? { nextReportDue: input.nextReportDue } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    })
    .where(eq(foundationGrants.id, id));
}
