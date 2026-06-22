import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { updateUser } from "@/lib/db/access/admin";
import { logAdminAudit } from "@/lib/admin/audit";
import { logError, logInfo } from "@/lib/logger";
import type { User } from "@/types";

export const runtime = "nodejs";

const VALID_TYPES: User["constituentType"][] = [
  "individual",
  "major_donor",
  "church",
  "foundation",
  "daf",
  "ambassador",
  "volunteer",
];

type UpdatedRow = NonNullable<Awaited<ReturnType<typeof updateUser>>>;

function mapUser(row: UpdatedRow): User {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const constituentType = String(body?.constituentType ?? "") as User["constituentType"];
    const isAdmin = Boolean(body?.isAdmin);

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "First name, last name, and email are required" }, { status: 400 });
    }

    if (!VALID_TYPES.includes(constituentType)) {
      return NextResponse.json({ error: "Invalid constituent type" }, { status: 400 });
    }

    const auth = await adminRoute("users:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();
    const updated = await updateUser(db, ctx, id, {
      firstName,
      lastName,
      email,
      constituentType: constituentType as NonNullable<User["constituentType"]>,
      isAdmin,
    });

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "users.updated",
      entityType: "user",
      entityId: id,
      details: { firstName, lastName, email, constituentType, isAdmin },
    });

    logInfo({
      event: "admin.users.updated",
      route: "/api/admin/users/[id]",
      userId: ctx.userId,
      details: { targetUserId: id },
    });

    return NextResponse.json({ success: true, user: mapUser(updated) });
  } catch (error) {
    logError({ event: "admin.users.update_failed", route: "/api/admin/users/[id]", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
