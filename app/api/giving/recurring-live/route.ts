import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/access/sky";
import { givingGatewayConfigured } from "@/lib/blackbaud/gateway";
import { getGivingSnapshot } from "@/lib/giving/snapshot";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

// Live recurring schedules for the signed-in donor, served from the shared
// per-user giving snapshot (the gateway response already includes recurring
// gifts). Pass ?fresh=1 to force a refetch (used right after an edit).
export async function GET(request: Request) {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    if (!givingGatewayConfigured()) {
      return NextResponse.json({ success: true, configured: false, schedules: [] });
    }

    const userRow = await getUserById(getDb(), ctx.userId);
    if (!userRow?.email) {
      return NextResponse.json({ success: true, configured: true, schedules: [] });
    }

    const force = new URL(request.url).searchParams.get("fresh") === "1";
    const live = await getGivingSnapshot(ctx.userId, userRow.email.toLowerCase(), {
      notBefore: userRow.lastLogin,
      force,
    });
    if (!live) {
      return NextResponse.json({ success: true, configured: true, available: false, schedules: [] });
    }

    const schedules = live.gifts
      .filter((g) => g.is_recurring)
      .map((g) => ({
        id: g.id,
        amount: g.amount,
        frequency: g.frequency ?? "MONTHLY",
        status: g.status ?? "Active",
        designation: g.designation ?? "Where Needed Most",
        date: g.date,
      }));

    return NextResponse.json({ success: true, configured: true, available: true, schedules });
  } catch (error) {
    logError({ event: "giving.recurring_live.fetch_failed", route: "/api/giving/recurring-live", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
