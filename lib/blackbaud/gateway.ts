import { getCloudflareContext } from "@opennextjs/cloudflare";
import { logError } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Favor giving gateway (favor-astro Pages app).
//
// favor-astro owns the single Blackbaud SKY OAuth token (SKY refresh tokens
// are single-use, so exactly one app may refresh them). It exposes a guarded
// server-to-server endpoint that returns a constituent's normalized giving
// history straight from Raiser's Edge NXT:
//
//   GET {GIVING_API_BASE}/api/portal/giving-history?email=...
//   Authorization: Bearer {PORTAL_GIVING_API_KEY}
//
// This module is the portal-side client. It is read-only and safe to call
// per-request; the gateway caches fund names and refreshes its own tokens.
// ---------------------------------------------------------------------------

export interface GatewayGift {
  id: string;
  lookup_id?: string | null;
  date: string | null;
  amount: number;
  type: string;
  status: string | null;
  is_recurring: boolean;
  is_recurring_payment: boolean;
  frequency: string | null;
  designation: string | null;
  payment_method: string | null;
  receipted: boolean;
  anonymous: boolean;
}

export interface GatewayHistory {
  constituent: { id: string; name: string | null; email: string } | null;
  gifts: GatewayGift[];
  summary: {
    total_given: number;
    ytd_given?: number;
    gift_count: number;
    active_recurring?: number;
  };
}

function gatewayEnv(): { base: string; key: string } | null {
  let base: string | undefined;
  let key: string | undefined;
  try {
    const { env } = getCloudflareContext();
    base = (env as { GIVING_API_BASE?: string }).GIVING_API_BASE;
    key = (env as { PORTAL_GIVING_API_KEY?: string }).PORTAL_GIVING_API_KEY;
  } catch {
    // Outside the Workers runtime (next dev, vitest) fall through to process.env.
  }
  base = base ?? process.env.GIVING_API_BASE;
  key = key ?? process.env.PORTAL_GIVING_API_KEY;
  if (!base || !key) return null;
  return { base: base.replace(/\/$/, ""), key };
}

export function givingGatewayConfigured(): boolean {
  return gatewayEnv() !== null;
}

export type RecurringAction =
  | { action: "pause" | "resume" | "cancel" }
  | { amount: number };

/**
 * Manage a recurring gift (pause/resume/cancel or change amount) through the
 * gateway. The gateway verifies the gift belongs to the constituent matching
 * this email before acting. Throws on failure with a donor-safe message.
 */
export async function manageRecurringGift(
  email: string,
  giftId: string,
  input: RecurringAction
): Promise<{ ok: boolean; status?: string; amount?: number }> {
  const cfg = gatewayEnv();
  if (!cfg) throw new Error("Giving management is not configured");
  const res = await fetch(`${cfg.base}/api/portal/recurring`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, gift_id: giftId, ...input }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    status?: string;
    amount?: number;
    message?: string;
  };
  if (!res.ok || !data.ok) {
    logError({
      event: "giving.gateway.recurring_action_failed",
      route: "gateway:/api/portal/recurring",
      error: new Error(`gateway ${res.status}: ${data.message ?? "unknown"}`),
    });
    throw new Error(data.message ?? "The change could not be completed");
  }
  return { ok: true, status: data.status, amount: data.amount };
}

/**
 * Fetch live giving history for an email. Returns null when the gateway is
 * not configured or unavailable so callers can fall back to the local
 * giving_cache rows.
 */
export async function fetchGivingHistoryByEmail(email: string): Promise<GatewayHistory | null> {
  const cfg = gatewayEnv();
  if (!cfg) return null;
  try {
    const res = await fetch(
      `${cfg.base}/api/portal/giving-history?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!res.ok) {
      logError({
        event: "giving.gateway.http_error",
        route: "gateway:/api/portal/giving-history",
        error: new Error(`gateway responded ${res.status}`),
      });
      return null;
    }
    const data = (await res.json()) as { ok?: boolean } & GatewayHistory;
    if (!data.ok) return null;
    return { constituent: data.constituent, gifts: data.gifts ?? [], summary: data.summary };
  } catch (error) {
    logError({ event: "giving.gateway.fetch_failed", route: "gateway:/api/portal/giving-history", error });
    return null;
  }
}
