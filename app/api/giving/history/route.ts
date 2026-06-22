import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { listGivingHistory } from "@/lib/db/access/giving";
import { logError } from "@/lib/logger";
import type { Gift } from "@/types";

export const runtime = "nodejs";

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

export async function GET() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const rows = await listGivingHistory(getDb(), ctx);

    const gifts = rows.map(mapGiftRow);
    const currentYear = new Date().getFullYear();
    const years = gifts.map((gift) => new Date(gift.date).getFullYear());

    const summary = {
      totalGiven: gifts.reduce((sum, gift) => sum + gift.amount, 0),
      ytdGiven: gifts
        .filter((gift) => new Date(gift.date).getFullYear() === currentYear)
        .reduce((sum, gift) => sum + gift.amount, 0),
      giftCount: gifts.length,
      yearsActive: years.length > 0 ? currentYear - Math.min(...years) + 1 : 1,
    };

    return NextResponse.json({ success: true, gifts, summary });
  } catch (error) {
    logError({ event: "giving.history.fetch_failed", route: "/api/giving/history", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
