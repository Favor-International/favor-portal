import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/access/sky";
import { manageRecurringGift, givingGatewayConfigured } from "@/lib/blackbaud/gateway";
import { refreshGivingSnapshot } from "@/lib/giving/snapshot";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError, logInfo } from "@/lib/logger";

export const runtime = "nodejs";

// PATCH /api/giving/recurring-live/:id
// Body: { action: "pause" | "resume" | "cancel" } or { amount: number }
// Ownership is enforced twice: the gateway matches the gift's constituent to
// this user's email, and nothing here trusts client-provided identity.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const { id } = await params;

    // Guard against write-spam against Blackbaud.
    const { env } = getCloudflareContext();
    const rl = await checkRateLimit(env.RATE_LIMIT, `giving:mutate:${ctx.userId}`, 20, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many changes at once. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    if (!givingGatewayConfigured()) {
      return NextResponse.json({ error: "Giving management is not configured" }, { status: 503 });
    }
    const userRow = await getUserById(getDb(), ctx.userId);
    if (!userRow?.email) {
      return NextResponse.json({ error: "No email on account" }, { status: 400 });
    }

    const body = (await request.json()) as { action?: string; amount?: unknown; card_token?: unknown };
    let input:
      | { action: "pause" | "resume" | "cancel" }
      | { action: "update_card"; card_token: string }
      | { amount: number };
    if (body.action === "pause" || body.action === "resume" || body.action === "cancel") {
      input = { action: body.action };
    } else if (body.action === "update_card") {
      // Blackbaud Checkout already vaulted the new card in the browser; all
      // that crosses this boundary is the token, never card data.
      const token = typeof body.card_token === "string" ? body.card_token.trim() : "";
      if (!/^[0-9a-f-]{36}$/i.test(token)) {
        return NextResponse.json({ error: "Card was not saved. Please try again." }, { status: 400 });
      }
      input = { action: "update_card", card_token: token };
    } else if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
      const amount = Math.round(body.amount * 100) / 100;
      if (amount < 1 || amount > 250000) {
        return NextResponse.json({ error: "Amount must be between $1 and $250,000" }, { status: 400 });
      }
      input = { amount };
    } else {
      return NextResponse.json({ error: "Provide an action or an amount" }, { status: 400 });
    }

    const result = await manageRecurringGift(userRow.email.toLowerCase(), id, input);

    // Refresh the cached snapshot so every surface reflects the change now.
    try {
      await refreshGivingSnapshot(ctx.userId, userRow.email.toLowerCase());
    } catch (refreshError) {
      logError({ event: "giving.recurring_live.refresh_failed", route: "/api/giving/recurring-live/[id]", error: refreshError });
    }

    logInfo({
      event: "giving.recurring_live.updated",
      route: "/api/giving/recurring-live/[id]",
      userId: ctx.userId,
      details: { giftId: id, input },
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logError({ event: "giving.recurring_live.update_failed", route: "/api/giving/recurring-live/[id]", error });
    const message = error instanceof Error ? error.message : "The change could not be completed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
