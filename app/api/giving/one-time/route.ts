import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { createOneTimeGift, createRecurringGift } from "@/lib/db/access/giving";
import { recordActivity } from "@/lib/db/access/activity";
import { logError, logInfo } from "@/lib/logger";
import type { Gift } from "@/types";

export const runtime = "nodejs";

const FREQUENCIES = ["one-time", "monthly", "quarterly", "annual"] as const;
type Frequency = (typeof FREQUENCIES)[number];

function computeNextChargeDate(frequency: Exclude<Frequency, "one-time">): string {
  const now = new Date();
  const next = new Date(now);
  if (frequency === "monthly") next.setMonth(now.getMonth() + 1);
  if (frequency === "quarterly") next.setMonth(now.getMonth() + 3);
  if (frequency === "annual") next.setFullYear(now.getFullYear() + 1);
  return next.toISOString().split("T")[0];
}

function mapGiftRow(row: {
  id: string;
  userId: string;
  amount: number;
  giftDate: string;
  designation: string;
  blackbaudGiftId: string | null;
  isRecurring: boolean | null;
  receiptSent: boolean | null;
  source: string | null;
}): Gift {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const amount = Number(body?.amount ?? 0);
    const designation = String(body?.designation ?? "Where Most Needed");
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    const frequency = (String(body?.frequency ?? "one-time") as Frequency);

    if (!FREQUENCIES.includes(frequency)) {
      return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();
    const userId = ctx.userId;

    const giftRow = await createOneTimeGift(db, ctx, {
      amount,
      designation,
      giftDate: new Date().toISOString().split("T")[0],
      note: note || undefined,
    });

    if (frequency !== "one-time") {
      try {
        await createRecurringGift(db, ctx, {
          amount,
          frequency,
          nextChargeDate: computeNextChargeDate(frequency),
          stripeSubscriptionId: `pending-${Date.now()}`,
          status: "active",
        });
      } catch (recurringError) {
        logError({
          event: "giving.one_time.recurring_insert_failed",
          route: "/api/giving/one-time",
          userId,
          error: recurringError,
        });
      }
    }

    await recordActivity(db, ctx, {
      type: "gift_created",
      metadata: {
        amount,
        designation,
        recurring: frequency !== "one-time",
      },
    });

    logInfo({
      event: "giving.one_time.created",
      route: "/api/giving/one-time",
      userId,
      details: { frequency, amount },
    });

    return NextResponse.json({
      success: true,
      gift: mapGiftRow(giftRow),
    }, { status: 201 });
  } catch (error) {
    logError({ event: "giving.one_time.failed", route: "/api/giving/one-time", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
