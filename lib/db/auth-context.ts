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
  const roles = await db
    .select({ roleKey: userRoles.roleKey })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .all();
  return {
    userId,
    isAdmin: Boolean(user.isAdmin),
    roleKeys: roles.map((r) => r.roleKey),
    constituentType: user.constituentType ?? null,
  };
}
