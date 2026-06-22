import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users, userRoles } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { normalizeAdminRoles, resolveAdminPermissions } from "@/lib/admin/roles";
import type { ConstituentType } from "@/types";

export const runtime = "nodejs";

// Returns the current user (for the client AuthProvider) or { user: null }.
export async function GET() {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return NextResponse.json({ user: null });

  const { env } = getCloudflareContext();
  const session = await getSession(env.SESSIONS, id);
  if (!session) return NextResponse.json({ user: null });

  const db = getDb();
  const u = await db.select().from(users).where(eq(users.id, session.userId)).get();
  if (!u) return NextResponse.json({ user: null });

  const roleRows = await db
    .select({ roleKey: userRoles.roleKey })
    .from(userRoles)
    .where(eq(userRoles.userId, u.id))
    .all();
  const roles = normalizeAdminRoles(roleRows.map((r) => r.roleKey));
  const permissions = resolveAdminPermissions(Boolean(u.isAdmin), roles);

  return NextResponse.json({
    user: {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone ?? undefined,
      blackbaudConstituentId: u.blackbaudConstituentId ?? undefined,
      constituentType: (u.constituentType ?? undefined) as ConstituentType | undefined,
      lifetimeGivingTotal: Number(u.lifetimeGivingTotal ?? 0),
      rddAssignment: u.rddAssignment ?? undefined,
      avatarUrl: u.avatarUrl ?? undefined,
      isAdmin: Boolean(u.isAdmin),
      roles,
      permissions,
      createdAt: u.createdAt ?? "",
      lastLogin: u.lastLogin ?? undefined,
    },
  });
}
