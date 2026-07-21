import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/access/sky";
import { fetchGivingHistoryByEmail, givingGatewayConfigured } from "@/lib/blackbaud/gateway";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

// Live recurring schedules for the signed-in donor, straight from Raiser's
// Edge NXT via the giving gateway. These are the rows the donor can manage
// (change amount, pause, resume, cancel).
export async function GET() {
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

    const live = await fetchGivingHistoryByEmail(userRow.email.toLowerCase());
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
