import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { listAllUsers } from "@/lib/db/access/admin";
import { logError } from "@/lib/logger";
import type { User } from "@/types";

export const runtime = "nodejs";

type UserRow = Awaited<ReturnType<typeof listAllUsers>>[number];

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone ?? undefined,
    blackbaudConstituentId: row.blackbaudConstituentId ?? undefined,
    constituentType: row.constituentType as User["constituentType"],
    lifetimeGivingTotal: Number(row.lifetimeGivingTotal ?? 0),
    rddAssignment: row.rddAssignment ?? undefined,
    avatarUrl: row.avatarUrl ?? undefined,
    isAdmin: Boolean(row.isAdmin),
    createdAt: row.createdAt ?? "",
    lastLogin: row.lastLogin ?? undefined,
  };
}

export async function GET() {
  try {
    const auth = await adminRoute("users:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const rows = await listAllUsers(getDb(), ctx);

    return NextResponse.json({
      success: true,
      users: rows.map(mapUser),
    });
  } catch (error) {
    logError({ event: "admin.users.fetch_failed", route: "/api/admin/users", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
