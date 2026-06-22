import { count, desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import {
  users,
  userRoles,
  givingCache,
  portalActivityEvents,
  supportTickets,
  courses,
  portalContent,
  CONSTITUENT_TYPES,
  USER_ROLE_KEYS,
} from "../schema";
import { canManage, AuthorizationError } from "./authz";

// Roles permitted to manage users (mirrors users:manage gate).
const USER_MANAGE_ROLES = ["super_admin"];
// Roles permitted to read admin overview / gifts (mirrors admin:access read access).
const OVERVIEW_READ_ROLES = ["super_admin", "analyst"];

export type UpdateUserFields = {
  firstName: string;
  lastName: string;
  email: string;
  constituentType: (typeof CONSTITUENT_TYPES)[number];
  isAdmin: boolean;
};

export async function listAllUsers(db: Db, ctx: AuthContext) {
  if (!canManage(ctx, USER_MANAGE_ROLES)) throw new AuthorizationError();
  return db.select().from(users).orderBy(desc(users.createdAt)).all();
}

export async function getUserDetail(db: Db, ctx: AuthContext, userId: string) {
  if (!canManage(ctx, USER_MANAGE_ROLES)) throw new AuthorizationError();
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return null;
  const roles = await db
    .select({ roleKey: userRoles.roleKey })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .all();
  return { ...user, roleKeys: roles.map((r) => r.roleKey) };
}

export async function updateUser(db: Db, ctx: AuthContext, userId: string, fields: UpdateUserFields) {
  if (!canManage(ctx, USER_MANAGE_ROLES)) throw new AuthorizationError();
  const existing = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!existing) return null;
  await db
    .update(users)
    .set({
      firstName: fields.firstName,
      lastName: fields.lastName,
      email: fields.email,
      constituentType: fields.constituentType,
      isAdmin: fields.isAdmin,
    })
    .where(eq(users.id, userId));
  return db.select().from(users).where(eq(users.id, userId)).get();
}

export async function setUserRoles(db: Db, ctx: AuthContext, userId: string, roleKeys: string[]) {
  if (!canManage(ctx, USER_MANAGE_ROLES)) throw new AuthorizationError();
  const valid = roleKeys.filter((k): k is (typeof USER_ROLE_KEYS)[number] =>
    (USER_ROLE_KEYS as readonly string[]).includes(k)
  );
  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  if (valid.length > 0) {
    await db.insert(userRoles).values(valid.map((roleKey) => ({ userId, roleKey })));
  }
}

// Read-only user list for overview/gifts dashboards (allows analysts, unlike listAllUsers).
export async function listUsersForOverview(db: Db, ctx: AuthContext) {
  if (!canManage(ctx, OVERVIEW_READ_ROLES)) throw new AuthorizationError();
  return db.select().from(users).orderBy(desc(users.createdAt)).all();
}

export async function listAllGifts(db: Db, ctx: AuthContext) {
  if (!canManage(ctx, OVERVIEW_READ_ROLES)) throw new AuthorizationError();
  return db.select().from(givingCache).orderBy(desc(givingCache.giftDate)).all();
}

export async function getOverviewStats(db: Db, ctx: AuthContext) {
  if (!canManage(ctx, OVERVIEW_READ_ROLES)) throw new AuthorizationError();

  const [
    userRows,
    giftRows,
    activityRows,
    ticketRows,
    coursesCountRows,
    contentCountRows,
  ] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)).all(),
    db.select().from(givingCache).orderBy(desc(givingCache.giftDate)).all(),
    db
      .select()
      .from(portalActivityEvents)
      .orderBy(desc(portalActivityEvents.createdAt))
      .limit(200)
      .all(),
    db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(200).all(),
    db.select({ value: count() }).from(courses).all(),
    db.select({ value: count() }).from(portalContent).all(),
  ]);

  return {
    users: userRows,
    gifts: giftRows,
    activity: activityRows,
    tickets: ticketRows,
    coursesCount: coursesCountRows[0]?.value ?? 0,
    contentCount: contentCountRows[0]?.value ?? 0,
  };
}
