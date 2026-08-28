import { describe, it, expect } from "vitest";
import { formatDate, formatDateShort, giftYear, calendarDate } from "@/lib/utils";

// Regression: gift dates must render on their true calendar day regardless of
// the viewer's timezone. Date-only strings ("2026-06-01") were being parsed as
// UTC midnight and rendered as the previous day in US Eastern (June 1 -> "5/31",
// Feb 1 -> "1/31"). These helpers read Y-M-D directly, so no day shift occurs.
describe("timezone-safe gift dates", () => {
  it("keeps a date-only string on its calendar day", () => {
    expect(formatDateShort("2026-06-01")).toBe("6/1/2026");
    expect(formatDateShort("2026-02-01")).toBe("2/1/2026");
    expect(formatDate("2026-02-01")).toBe("February 1, 2026");
  });

  it("keeps a zone-less datetime on its calendar day", () => {
    expect(formatDateShort("2026-07-21T00:00:00")).toBe("7/21/2026");
    expect(formatDate("2026-07-21T00:00:00")).toBe("July 21, 2026");
  });

  it("extracts the year without shifting", () => {
    expect(giftYear("2026-01-01")).toBe(2026); // would be 2025 if parsed as UTC in Eastern
    expect(giftYear("2026-07-21T00:00:00")).toBe(2026);
    expect(giftYear(null)).toBeNull();
  });

  it("returns empty/null for missing input", () => {
    expect(formatDateShort(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(calendarDate("")).toBeNull();
  });

  it("does not shift across month/year boundaries", () => {
    // 2026-01-01 must never render as Dec 31 2025.
    expect(formatDateShort("2026-01-01")).toBe("1/1/2026");
    expect(giftYear("2026-01-01")).toBe(2026);
  });
});
