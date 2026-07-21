import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/access/sky";
import { manageRecurringGift, givingGatewayConfigured } from "@/lib/blackbaud/gateway";
import { refreshGivingSnapshot } from "@/lib/giving/snapshot";
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

    if (!givingGatewayConfigured()) {
      return NextResponse.json({ error: "Giving management is not configured" }, { status: 503 });
    }
    const userRow = await getUserById(getDb(), ctx.userId);
    if (!userRow?.email) {
      return NextResponse.json({ error: "No email on account" }, { status: 400 });
    }

    const body = (await request.json()) as { action?: string; amount?: unknown };
    let input: { action: "pause" | "resume" | "cancel" } | { amount: number };
    if (body.action === "pause" || body.action === "resume" || body.action === "cancel") {
      input = { action: body.action };
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
