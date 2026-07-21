// Real giving happens on the favor-astro site, which owns Blackbaud Checkout
// (the only place a card is ever entered). The portal NEVER processes payment
// itself; it links out to the real, secure form. Monthly is the lead path.

export const GIVE_BASE = "https://favor-astro.pages.dev/give/donate/";

export function giveUrl(
  frequency: "monthly" | "once" = "monthly",
  opts: { amount?: number; designation?: string } = {}
): string {
  const params = new URLSearchParams({ frequency });
  if (opts.amount && opts.amount >= 1) params.set("amount", String(opts.amount));
  if (opts.designation) params.set("designation", opts.designation);
  return `${GIVE_BASE}?${params.toString()}`;
}

export const FIELD_FEED_URL = "https://favor-astro.pages.dev/field-updates.json";
