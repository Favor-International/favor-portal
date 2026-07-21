import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { listGivingHistory } from "@/lib/db/access/giving";
import { getUserById, linkOwnConstituent, syncOwnGivingCache } from "@/lib/db/access/sky";
import { givingGatewayConfigured } from "@/lib/blackbaud/gateway";
import { getGivingSnapshot } from "@/lib/giving/snapshot";
import { logError } from "@/lib/logger";
import type { BlackbaudGift, Gift } from "@/types";

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
    const db = getDb();

    // Live-first: pull the caller's history straight from Raiser's Edge NXT
    // through the favor-astro giving gateway (the single owner of the SKY
    // OAuth token), refresh the local giving_cache, then serve from the
    // cache so gift ids stay stable for receipt links. Any gateway problem
    // falls through to the cache alone.
    if (givingGatewayConfigured()) {
      const userRow = await getUserById(db, ctx.userId);
      if (userRow?.email) {
        // Cached per user; refetches only after a new login or past the TTL.
        const live = await getGivingSnapshot(ctx.userId, userRow.email.toLowerCase(), {
          notBefore: userRow.lastLogin,
        });
        if (live) {
          try {
            if (live.constituent && !userRow.blackbaudConstituentId) {
              await linkOwnConstituent(db, ctx, live.constituent.id);
            }
            const moneyRows = live.gifts
              .filter((g) => !g.is_recurring) // schedules are not received money
              .map(
                (g): BlackbaudGift & { receiptSent?: boolean } => ({
                  id: g.id,
                  constituentId: live.constituent?.id ?? "",
                  amount: g.amount,
                  date: g.date ?? new Date().toISOString(),
                  designation: g.designation ?? "Where Needed Most",
                  type: g.is_recurring_payment ? "recurring" : "one_time",
                  receiptSent: g.receipted,
                })
              );
            await syncOwnGivingCache(db, ctx, moneyRows);
          } catch (error) {
            logError({ event: "giving.history.sync_failed", route: "/api/giving/history", error });
          }
        }
      }
    }

    const rows = await listGivingHistory(db, ctx);

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
