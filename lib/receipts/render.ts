// Branded, print-ready receipts.
//
// Replaces the plain .txt Blob a partner used to download. These render as
// real HTML documents that open in a new tab and print cleanly to PDF, which
// is what donors actually do with a receipt (attach it to a tax return, hand
// it to a bookkeeper).
//
// Two documents share one shell:
//   renderGiftReceipt   a single gift
//   renderAnnualSummary every gift in a tax year, with the year total
//
// The IRS substantiation language belongs on both: a donor claiming a
// deduction of $250 or more needs a written acknowledgment stating whether
// goods or services were provided.

import { ORG } from '@/lib/constants';

export interface ReceiptGift {
  id: string;
  date: string;
  amount: number;
  designation: string;
  isRecurring?: boolean;
  receiptNumber?: string | null;
  receiptDate?: string | null;
  paymentMethod?: string | null;
}

export interface ReceiptDonor {
  name: string;
  email?: string | null;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatUSD = (n: number) => usd.format(Number.isFinite(n) ? n : 0);

const longDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Gift dates are calendar dates; read them in UTC so a date-only value
  // cannot slide back a day for a partner in a western timezone.
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
};

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TAX_LANGUAGE = `${ORG.legalName} is a tax-exempt organization under Section 501(c)(3) of the Internal Revenue Code, EIN ${ORG.ein}. No goods or services were provided in exchange for this contribution. Your gift is tax-deductible to the fullest extent allowed by law. Please keep this receipt with your tax records.`;

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  :root { --green:#2b4d24; --gold:#e1a730; --ink:#1a1a1a; --muted:#6f7766; --line:#e4e7e1; }
  *{box-sizing:border-box}
  body{margin:0;background:#f4f5f2;color:var(--ink);
       font-family:Montserrat,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
  .sheet{max-width:760px;margin:24px auto;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
  .head{background:var(--green);color:#fff;padding:28px 36px}
  .wordmark{font-size:20px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin:0}
  .tagline{margin:4px 0 0;font-size:12px;opacity:.85;font-style:italic}
  .rule{height:3px;background:var(--gold)}
  .body{padding:32px 36px}
  h1{font-size:19px;margin:0 0 4px;font-weight:700}
  .sub{margin:0 0 24px;color:var(--muted);font-size:13px}
  .meta{width:100%;border-collapse:collapse;margin-bottom:24px}
  .meta td{padding:7px 0;vertical-align:top;font-size:14px;border-bottom:1px solid var(--line)}
  .meta td:first-child{color:var(--muted);width:42%}
  .meta td:last-child{text-align:right;font-weight:600}
  table.gifts{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:14px}
  table.gifts th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.07em;
       color:var(--muted);border-bottom:2px solid var(--line);padding:0 8px 8px 0;font-weight:600}
  table.gifts td{padding:10px 8px 10px 0;border-bottom:1px solid var(--line)}
  table.gifts td.amt,table.gifts th.amt{text-align:right;padding-right:0;font-variant-numeric:tabular-nums}
  .total{display:flex;justify-content:space-between;align-items:baseline;
       border-top:3px solid var(--gold);margin-top:6px;padding-top:14px}
  .total .label{font-weight:700}
  .total .value{font-size:24px;font-weight:700;color:var(--green);font-variant-numeric:tabular-nums}
  .tax{margin-top:28px;padding:16px 18px;background:#f7f8f5;border-left:3px solid var(--gold);
       font-size:12.5px;color:var(--muted);line-height:1.6}
  .foot{padding:20px 36px 28px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
  .foot strong{color:var(--ink)}
  .print{position:fixed;top:16px;right:16px;background:var(--green);color:#fff;border:0;
       border-radius:7px;padding:11px 18px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer}
  .print:hover{background:#24401e}
  @media print{
    @page{margin:.75in}
    body{background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .sheet{margin:0;border:0;border-radius:0;max-width:none}
    .print{display:none}
  }
</style>
</head>
<body>
<button class="print" onclick="window.print()">Print or save as PDF</button>
<div class="sheet">
  <div class="head">
    <p class="wordmark">Favor International</p>
    <p class="tagline">Transformed Hearts, Transform Nations</p>
  </div>
  <div class="rule"></div>
  <div class="body">
${body}
    <div class="tax">${escapeHtml(TAX_LANGUAGE)}</div>
  </div>
  <div class="foot">
    <strong>${escapeHtml(ORG.legalName)}</strong><br />
    ${escapeHtml(ORG.address)}<br />
    ${escapeHtml(ORG.phone)} &middot; ${escapeHtml(ORG.email)} &middot; ${escapeHtml(ORG.website)}<br />
    EIN ${escapeHtml(ORG.ein)} &middot; ${escapeHtml(ORG.classification)}
  </div>
</div>
</body>
</html>`;
}

export function renderGiftReceipt(gift: ReceiptGift, donor: ReceiptDonor): string {
  const reference = gift.receiptNumber || gift.id;
  const rows = [
    ['Receipt number', escapeHtml(reference)],
    ['Gift date', escapeHtml(longDate(gift.date))],
    ['Donor', escapeHtml(donor.name)],
    ['Designation', escapeHtml(gift.designation)],
    ['Gift type', gift.isRecurring ? 'Monthly partner gift' : 'One-time gift'],
    // Only state a payment method when the record actually carries one.
    ...(gift.paymentMethod ? [['Payment method', escapeHtml(gift.paymentMethod)]] : []),
    ...(gift.receiptDate ? [['Receipted', escapeHtml(longDate(gift.receiptDate))]] : []),
  ];
  const body = `    <h1>Gift receipt</h1>
    <p class="sub">Thank you for standing with the people Favor serves.</p>
    <table class="meta">
${rows.map(([k, v]) => `      <tr><td>${k}</td><td>${v}</td></tr>`).join('\n')}
    </table>
    <div class="total"><span class="label">Amount received</span><span class="value">${formatUSD(gift.amount)}</span></div>`;
  return shell(`Gift receipt ${reference} | Favor International`, body);
}

export function renderAnnualSummary(year: number, gifts: ReceiptGift[], donor: ReceiptDonor): string {
  const total = gifts.reduce((sum, g) => sum + (Number(g.amount) || 0), 0);
  const rows = gifts.length
    ? gifts
        .map(
          (g) => `      <tr>
        <td>${escapeHtml(longDate(g.date))}</td>
        <td>${escapeHtml(g.designation)}</td>
        <td>${g.isRecurring ? 'Monthly' : 'One-time'}</td>
        <td class="amt">${formatUSD(g.amount)}</td>
      </tr>`
        )
        .join('\n')
    : `      <tr><td colspan="4" style="color:var(--muted);padding:18px 0">No gifts recorded in ${year}.</td></tr>`;

  const body = `    <h1>${year} giving summary</h1>
    <p class="sub">A record of every gift ${escapeHtml(donor.name)} gave to Favor International in ${year}.</p>
    <table class="gifts">
      <thead><tr><th>Date</th><th>Designation</th><th>Type</th><th class="amt">Amount</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
    <div class="total"><span class="label">Total contributions in ${year}</span><span class="value">${formatUSD(total)}</span></div>`;
  return shell(`${year} giving summary | Favor International`, body);
}
