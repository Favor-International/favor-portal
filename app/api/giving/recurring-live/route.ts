import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/access/sky";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { givingGatewayConfigured } from "@/lib/blackbaud/gateway";
import { getGivingSnapshot } from "@/lib/giving/snapshot";
import { checkRateLimit } from "@/lib/rate-limit";
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

    // A forced refetch shares the per-user Blackbaud budget with /refresh; if
    // the budget is spent, fall back to the cached snapshot instead of erroring.
    let force = new URL(request.url).searchParams.get("fresh") === "1";
    if (force) {
      const { env } = getCloudflareContext();
      const rl = await checkRateLimit(env.RATE_LIMIT, `giving:force:${ctx.userId}`, 12, 5 * 60 * 1000);
      if (!rl.allowed) force = false;
    }
    const live = await getGivingSnapshot(ctx.userId, userRow.email.toLowerCase(), {
      notBefore: userRow.lastLogin,
      force,
    });
    if (!live) {
      return NextResponse.json({ success: true, configured: true, available: false, schedules: [] });
    }

    const schedules = live.gifts
      // Active and Held only. Terminated schedules used to render as normal
      // rows, so a partner with an old cancelled gift saw two identical
      // entries and could try to edit the dead one, which Blackbaud rejects
      // ("something went wrong", Jennifer Morris, 2026-08-07). Held stays
      // visible so pause/resume works.
      .filter((g) => g.is_recurring && (g.status ?? 'Active') !== 'Terminated')
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
