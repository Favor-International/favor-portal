import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/access/sky";
import { givingGatewayConfigured } from "@/lib/blackbaud/gateway";
import { getGivingSnapshot } from "@/lib/giving/snapshot";
import { logError } from "@/lib/logger";
import { ORG } from "@/lib/constants";
import { formatDate, giftYear } from "@/lib/utils";

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

    let gifts: Array<{ date: string | null; amount: number; designation: string | null; is_recurring: boolean; receipted: boolean }> = [];
    if (givingGatewayConfigured()) {
      const live = await getGivingSnapshot(ctx.userId, user.email.toLowerCase(), { notBefore: user.lastLogin });
      gifts = (live?.gifts ?? [])
        .filter((g) => !g.is_recurring && giftYear(g.date) === year)
        .map((g) => ({ date: g.date, amount: g.amount, designation: g.designation, is_recurring: g.is_recurring, receipted: g.receipted }))
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    }

    const total = gifts.reduce((s, g) => s + g.amount, 0);
    const donorName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Valued Partner";
    const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

    const rows = gifts
      .map(
        (g) => `<tr>
          <td>${formatDate(g.date)}</td>
          <td>${escapeHtml(g.designation ?? "Where Needed Most")}</td>
          <td class="ta-r">${money(g.amount)}</td>
        </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${year} Giving Statement — ${ORG.legalName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #f5f5f0; padding: 32px; line-height: 1.55; }
  .doc { max-width: 760px; margin: 0 auto; background: #fff; padding: 56px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px; }
  .head { text-align: center; border-bottom: 3px solid #2b4d24; padding-bottom: 22px; margin-bottom: 28px; }
  .logo { font-size: 26px; font-weight: bold; color: #2b4d24; letter-spacing: 2px; }
  .tagline { font-style: italic; color: #666; font-size: 13px; margin-top: 4px; }
  h1 { font-size: 22px; color: #2b4d24; text-align: center; margin: 24px 0 4px; }
  .sub { text-align: center; color: #666; font-size: 13px; margin-bottom: 28px; }
  .who { margin-bottom: 24px; font-size: 14px; }
  .label { text-transform: uppercase; letter-spacing: 1px; font-size: 11px; color: #999; }
  table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px; }
  th { text-align: left; border-bottom: 2px solid #2b4d24; padding: 8px 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #2b4d24; }
  td { padding: 8px 6px; border-bottom: 1px solid #eee; }
  .ta-r { text-align: right; }
  .total { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg,#2b4d24,#3d6633); color: #fff; padding: 18px 22px; border-radius: 8px; margin: 20px 0; }
  .total .t-label { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
  .total .t-value { font-size: 24px; font-weight: bold; }
  .tax { background: #f7f6f1; border-left: 4px solid #e1a730; padding: 16px 18px; border-radius: 0 6px 6px 0; font-size: 13px; color: #444; margin: 22px 0; }
  .foot { text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 18px; margin-top: 26px; }
  .foot strong { color: #1a1a1a; }
  .empty { text-align: center; color: #888; padding: 24px; font-style: italic; }
  @media print { body { background: #fff; padding: 0; } .doc { box-shadow: none; border-radius: 0; } .noprint { display: none; } }
  .noprint { text-align: center; margin-bottom: 18px; }
  .btn { display: inline-block; background: #2b4d24; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-family: system-ui, sans-serif; font-size: 14px; border: 0; cursor: pointer; }
</style></head>
<body>
  <div class="noprint"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>
  <div class="doc">
    <div class="head">
      <div class="logo">FAVOR INTERNATIONAL</div>
      <div class="tagline">Transformed Hearts Transform Nations</div>
    </div>
    <h1>${year} Annual Giving Statement</h1>
    <p class="sub">For the tax year January 1 – December 31, ${year}</p>

    <div class="who">
      <p class="label">Donor</p>
      <p><strong>${escapeHtml(donorName)}</strong></p>
      <p>${escapeHtml(user.email)}</p>
    </div>

    ${
      gifts.length
        ? `<table>
        <thead><tr><th>Date</th><th>Designation</th><th class="ta-r">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total"><span class="t-label">Total tax-deductible contributions in ${year}</span><span class="t-value">${money(total)}</span></div>`
        : `<p class="empty">No gifts are recorded for ${year}.</p>`
    }

    <div class="tax">
      ${ORG.legalName} is a ${ORG.classification} (EIN ${ORG.ein}). No goods or services were
      provided in exchange for these contributions. This statement serves as your written
      acknowledgement for tax purposes. Please retain it for your records and consult your tax
      advisor regarding deductibility.
    </div>

    <div class="foot">
      <p><strong>${ORG.legalName}</strong></p>
      <p>${ORG.address}</p>
      <p>Email: ${ORG.email} &middot; Phone: ${ORG.phone} &middot; ${ORG.website}</p>
    </div>
  </div>
</body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="favor-giving-statement-${year}.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logError({ event: "giving.statement.failed", route: "/api/giving/statement/[year]", error });
    return NextResponse.json({ error: "Could not generate the statement" }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c));
}
