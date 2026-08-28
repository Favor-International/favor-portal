import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/access/sky";
import { givingGatewayConfigured } from "@/lib/blackbaud/gateway";
import { getGivingSnapshot } from "@/lib/giving/snapshot";
import { logError } from "@/lib/logger";
import { giftYear } from "@/lib/utils";
import { renderAnnualSummary } from "@/lib/receipts/render";

export const runtime = "nodejs";

// GET /api/giving/statement/:year
// The donor's official year-end giving statement (the standard tax document):
// every receipted gift in the calendar year, the annual total, org details,
// and the IRS contemporaneous-acknowledgement language. Rendered as a clean,
// printable HTML page (print to PDF). Data comes from the live Blackbaud
// snapshot; strictly owner-scoped (the signed-in donor's own giving only).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ year: string }> }) {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const { year: yearParam } = await params;

    const year = Number(yearParam);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const db = getDb();
    const user = await getUserById(db, ctx.userId);
    if (!user?.email) {
      return NextResponse.json({ error: "No email on account" }, { status: 400 });
    }

    let gifts: Array<{ date: string | null; amount: number; designation: string | null; is_recurring: boolean; is_recurring_payment: boolean; receipted: boolean }> = [];
    if (givingGatewayConfigured()) {
      const live = await getGivingSnapshot(ctx.userId, user.email.toLowerCase(), { notBefore: user.lastLogin });
      gifts = (live?.gifts ?? [])
        .filter((g) => !g.is_recurring && giftYear(g.date) === year)
        .map((g) => ({ date: g.date, amount: g.amount, designation: g.designation, is_recurring: g.is_recurring, is_recurring_payment: g.is_recurring_payment, receipted: g.receipted }))
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    }

    // Recurring SCHEDULE rows are filtered out above (they are not money
    // received); recurring PAYMENTS stay and are labelled as monthly gifts.
    const html = renderAnnualSummary(
      year,
      gifts.map((g) => ({
        id: "",
        date: g.date ?? "",
        amount: g.amount,
        designation: g.designation ?? "Where Needed Most",
        isRecurring: g.is_recurring_payment,
      })),
      {
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Valued Partner",
        email: user.email ?? null,
      }
    );

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="favor-giving-statement-${year}.html"`,
      },
    });
  } catch (error) {
    logError({ event: "giving.statement_failed", route: "/api/giving/statement/[year]", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
