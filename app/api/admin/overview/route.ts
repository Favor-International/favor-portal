import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getOverviewStats } from "@/lib/db/access/admin";
import { logError } from "@/lib/logger";
import type { ActivityEvent, Gift, SupportTicket, User } from "@/types";

export const runtime = "nodejs";

type Overview = Awaited<ReturnType<typeof getOverviewStats>>;

function mapUser(row: Overview["users"][number]): User {
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

function mapGift(row: Overview["gifts"][number]): Gift {
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

function mapActivity(row: Overview["activity"][number]): ActivityEvent {
  return {
    id: row.id,
    type: row.type as ActivityEvent["type"],
    userId: row.userId ?? "",
    metadata: (row.metadata as ActivityEvent["metadata"]) ?? {},
    createdAt: row.createdAt,
  };
}

function mapSupportTicket(row: Overview["tickets"][number]): SupportTicket {
  return {
    id: row.id,
    requesterUserId: row.requesterUserId ?? undefined,
    category: row.category,
    subject: row.subject,
    message: row.message,
    status: row.status as SupportTicket["status"],
    priority: row.priority as SupportTicket["priority"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt ?? undefined,
    requesterName: row.requesterName ?? undefined,
    requesterEmail: row.requesterEmail ?? undefined,
  };
}

export async function GET() {
  try {
    const auth = await adminRoute("admin:access");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const overview = await getOverviewStats(getDb(), ctx);

    return NextResponse.json({
      success: true,
      users: overview.users.map(mapUser),
      gifts: overview.gifts.map(mapGift),
      activity: overview.activity.map(mapActivity).filter((event) => Boolean(event.userId)),
      tickets: overview.tickets.map(mapSupportTicket),
      coursesCount: overview.coursesCount,
      contentCount: overview.contentCount,
    });
  } catch (error) {
    logError({ event: "admin.overview.fetch_failed", route: "/api/admin/overview", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
