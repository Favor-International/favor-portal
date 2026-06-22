import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { listAllGifts, listUsersForOverview } from "@/lib/db/access/admin";
import { logError } from "@/lib/logger";
import type { Gift, User } from "@/types";

export const runtime = "nodejs";

type GiftRow = Awaited<ReturnType<typeof listAllGifts>>[number];
type UserRow = Awaited<ReturnType<typeof listUsersForOverview>>[number];

function mapGift(row: GiftRow): Gift {
  return {
    id: row.id,
    userId: row.userId,
    amount: Number(row.amount),
    date: row.giftDate,
    designation: row.designation,
    blackbaudGiftId: row.blackbaudGiftId ?? undefined,
    isRecurring: Boolean(row.isRecurring),
    receiptSent: Boolean(row.receiptSent),
    source: (row.source ?? "imported") as Gift["source"],
  };
}

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
    const auth = await adminRoute("admin:access");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();
    const [gifts, users] = await Promise.all([listAllGifts(db, ctx), listUsersForOverview(db, ctx)]);

    return NextResponse.json({
      success: true,
      gifts: gifts.map(mapGift),
      users: users.map(mapUser),
    });
  } catch (error) {
    logError({ event: "admin.gifts.fetch_failed", route: "/api/admin/gifts", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
