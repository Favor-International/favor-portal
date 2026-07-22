import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/access/sky";
import { givingGatewayConfigured } from "@/lib/blackbaud/gateway";
import { refreshGivingSnapshot } from "@/lib/giving/snapshot";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

// POST /api/giving/refresh — force a fresh pull of the signed-in donor's
// giving from Blackbaud (bypassing the cache) and return a short summary.
// Rate-limited per user so a logged-in client cannot hammer Blackbaud and
// burn the shared 1,000-calls/day budget.
export async function POST() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const { env } = getCloudflareContext();
    const rl = await checkRateLimit(env.RATE_LIMIT, `giving:force:${ctx.userId}`, 12, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "You are refreshing too often. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

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
