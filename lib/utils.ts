import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Gift/receipt dates arrive as either a plain calendar date ("2026-06-01") or a
// zone-less datetime ("2026-07-21T00:00:00"). Both represent a CALENDAR day, not
// an instant. Using `new Date(str)` parses the date-only form as UTC midnight,
// which then renders as the PREVIOUS day in negative-offset timezones (US
// Eastern), e.g. 2026-06-01 -> "5/31/2026" and 2026-02-01 -> "1/31/2026". These
// helpers read the Y-M-D fields directly so the calendar day never shifts.
function calendarParts(input: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!input) return null;
  const match = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const dt = new Date(input);
    if (Number.isNaN(dt.getTime())) return null;
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Local Date at noon for the calendar day (noon avoids any DST edge). */
export function calendarDate(input: string | null | undefined): Date | null {
  const p = calendarParts(input);
  return p ? new Date(p.y, p.m - 1, p.d, 12, 0, 0) : null;
}

/** Year of the calendar day, never shifted by timezone. */
export function giftYear(input: string | null | undefined): number | null {
  return calendarParts(input)?.y ?? null;
}

/** Long form, e.g. "July 21, 2026". */
export function formatDate(input: string | null | undefined): string {
  const d = calendarDate(input);
  return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
}

/** Short form, e.g. "7/21/2026". */
export function formatDateShort(input: string | null | undefined): string {
  const d = calendarDate(input);
  return d ? d.toLocaleDateString('en-US') : '';
}
