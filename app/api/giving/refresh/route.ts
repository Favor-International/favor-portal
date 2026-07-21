import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/access/sky";
import { givingGatewayConfigured } from "@/lib/blackbaud/gateway";
import { refreshGivingSnapshot } from "@/lib/giving/snapshot";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

// POST /api/giving/refresh — force a fresh pull of the signed-in donor's
// giving from Blackbaud (bypassing the cache) and return a short summary.
// Wired to a manual "Refresh" affordance so a donor can pull the very latest
// on demand without waiting for the login/TTL refresh.
export async function POST() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    if (!givingGatewayConfigured()) {
      return NextResponse.json({ success: true, configured: false });
    }
    const userRow = await getUserById(getDb(), ctx.userId);
    if (!userRow?.email) {
      return NextResponse.json({ success: true, refreshed: false });
    }

    const data = await refreshGivingSnapshot(ctx.userId, userRow.email.toLowerCase());
    return NextResponse.json({
      success: true,
      refreshed: true,
      summary: data?.summary ?? null,
    });
  } catch (error) {
    logError({ event: "giving.refresh.failed", route: "/api/giving/refresh", error });
    return NextResponse.json({ error: "Could not refresh right now" }, { status: 502 });
  }
}
