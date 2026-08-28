import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { listGivingHistory } from "@/lib/db/access/giving";
import { getUserById, linkOwnConstituent, syncOwnGivingCache } from "@/lib/db/access/sky";
import { givingGatewayConfigured, type GatewayHistory } from "@/lib/blackbaud/gateway";
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
    const userRow = await getUserById(db, ctx.userId);

    let live: GatewayHistory | null = null;

    // Live-first: pull the caller's history straight from Raiser's Edge NXT
    // through the favor-astro giving gateway (the single owner of the SKY
    // OAuth token), refresh the local giving_cache, then serve from the
    // cache so gift ids stay stable for receipt links. Any gateway problem
    // falls through to the cache alone.
    if (givingGatewayConfigured() && userRow?.email) {
      // Cached per user; refetches only after a new login or past the TTL.
      live = await getGivingSnapshot(ctx.userId, userRow.email.toLowerCase(), {
        notBefore: userRow.lastLogin,
      });
      if (live) {
        const snap = live; // const capture for use inside the map closure
        try {
          if (snap.constituent && !userRow.blackbaudConstituentId) {
            await linkOwnConstituent(db, ctx, snap.constituent.id);
          }
          const moneyRows = snap.gifts
            .filter((g) => !g.is_recurring) // schedules are not received money
            .map(
              (g): BlackbaudGift & { receiptSent?: boolean } => ({
                id: g.id,
                constituentId: snap.constituent?.id ?? "",
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

    const rows = await listGivingHistory(db, ctx);

    // Receipt details keyed by Blackbaud gift id (read-only enrichment from the
    // live snapshot; falls back to no receipt info if the gateway was down).
    const receiptByGiftId = new Map(
      (live?.gifts ?? []).map((g) => [g.id, { receipted: g.receipted, number: g.receipt_number ?? null, date: g.receipt_date ?? null }])
    );

    const gifts = rows.map((row) => {
      const g = mapGiftRow(row);
      const r = row.blackbaudGiftId ? receiptByGiftId.get(row.blackbaudGiftId) : undefined;
      return {
        ...g,
        receipted: r?.receipted ?? g.receiptSent,
        receiptNumber: r?.number ?? null,
        receiptDate: r?.date ?? null,
      };
    });

    const currentYear = new Date().getFullYear();
    const years = gifts.map((gift) => new Date(gift.date).getFullYear());

    const computedTotal = gifts.reduce((sum, gift) => sum + gift.amount, 0);
    const ytdGiven = gifts
      .filter((gift) => new Date(gift.date).getFullYear() === currentYear)
      .reduce((sum, gift) => sum + gift.amount, 0);

    // Never let a live $0 (email not in the sync DB yet) hide gifts we already
    // wrote into giving_cache from the post-gift hook.
    const liveLifetime = Number(live?.summary.lifetime_total ?? 0);
    const totalGiven = Math.max(liveLifetime, computedTotal);
    const createdMs = userRow?.createdAt ? Date.parse(userRow.createdAt) : NaN;
    const pendingSync =
      gifts.length === 0 && Number.isFinite(createdMs) && Date.now() - createdMs < 2 * 60 * 60 * 1000;

    const oldest = gifts.length ? [...gifts].sort((a, b) => a.date.localeCompare(b.date))[0] : null;
    const summary = {
      // Authoritative lifetime (server-computed by Blackbaud, not capped by the
      // 200-gift page) when available; otherwise the sum of loaded gifts.
      totalGiven,
      loadedTotal: computedTotal,
      ytdGiven,
      giftCount: gifts.length,
      yearsActive: years.length > 0 ? currentYear - Math.min(...years) + 1 : 1,
      lifetimeTotal: totalGiven > 0 ? totalGiven : live?.summary.lifetime_total ?? null,
      consecutiveYearsGiven: live?.summary.consecutive_years_given ?? null,
      totalYearsGiven: live?.summary.total_years_given ?? null,
      firstGiftDate: live?.summary.first_gift_date ?? oldest?.date ?? null,
      firstGiftAmount: live?.summary.first_gift_amount ?? oldest?.amount ?? null,
    };

    return NextResponse.json({ success: true, gifts, summary, pendingSync });
  } catch (error) {
    logError({ event: "giving.history.fetch_failed", route: "/api/giving/history", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
