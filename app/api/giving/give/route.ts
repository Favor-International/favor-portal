// POST /api/giving/give
//
// A gift started inside the portal. The browser has already run Blackbaud
// Checkout and holds an authorization token; this route forwards the gift to
// favor-astro, which owns the Blackbaud credentials and the giving logic.
//
// Forwarding server-side rather than posting from the browser buys three
// things: no cross-origin exposure of the giving endpoints, no Turnstile
// widget for someone who is already signed in, and no spurious "here is your
// login link" welcome email to a partner who is by definition logged in.
//
// The donor identity comes from the SESSION, never from the request body, so a
// partner cannot record a gift against somebody else's record.

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { authedRoute } from '@/lib/api/route-auth';
import { getDb } from '@/lib/db/client';
import { getUserById } from '@/lib/db/access/sky';
import { refreshGivingSnapshot } from '@/lib/giving/snapshot';
import { checkRateLimit } from '@/lib/rate-limit';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await authedRoute();
    if ('error' in auth) return auth.error;
    const { ctx } = auth;

    const { env } = getCloudflareContext();
    const rl = await checkRateLimit(env.RATE_LIMIT, `giving:create:${ctx.userId}`, 8, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const base = process.env.GIVING_API_BASE;
    const key = process.env.PORTAL_GIVING_API_KEY;
    if (!base || !key) {
      return NextResponse.json({ error: 'Giving is not configured' }, { status: 503 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const frequency = body.frequency === 'monthly' ? 'monthly' : 'once';
    const amount = Number(body.amount);
    const fundId = typeof body.designation_fund_id === 'string' ? body.designation_fund_id : '';
    const transactionToken = typeof body.transaction_token === 'string' ? body.transaction_token : '';
    const cardToken = typeof body.card_token === 'string' ? body.card_token : '';

    if (!Number.isFinite(amount) || amount < 1 || amount > 250000) {
      return NextResponse.json({ error: 'Enter an amount between $1 and $250,000.' }, { status: 400 });
    }
    if (!fundId) return NextResponse.json({ error: 'Choose where your gift should go.' }, { status: 400 });
    if (!transactionToken) return NextResponse.json({ error: 'The payment did not complete.' }, { status: 400 });
    if (frequency === 'monthly' && !cardToken) {
      return NextResponse.json({ error: 'The card was not saved. Please try again.' }, { status: 400 });
    }

    const user = await getUserById(getDb(), ctx.userId);
    if (!user?.email) return NextResponse.json({ error: 'No email on account' }, { status: 400 });

    const res = await fetch(`${base.replace(/\/$/, '')}/api/portal/give`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frequency,
        idempotency_key: crypto.randomUUID(),
        amount,
        designation_fund_id: fundId,
        // Identity from the session, not the client.
        donor: {
          first: user.firstName ?? '',
          last: user.lastName ?? '',
          email: user.email.toLowerCase(),
        },
        checkout: { transaction_token: transactionToken },
        ...(frequency === 'monthly' ? { card_token: cardToken } : {}),
      }),
      signal: AbortSignal.timeout(25000),
    });

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; gift_id?: string };
    if (!res.ok || !data.ok) {
      logError({ event: 'giving.create_failed', route: '/api/giving/give', error: data.message ?? res.status });
      return NextResponse.json(
        { error: data.message ?? 'The gift could not be completed. Your card was not charged twice.' },
        { status: res.status === 400 ? 400 : 502 }
      );
    }

    // The new gift should appear on the dashboard immediately, not after the
    // next sync.
    try {
      await refreshGivingSnapshot(ctx.userId, user.email.toLowerCase());
    } catch {
      /* the gift is recorded; a stale panel is not worth failing the response */
    }

    logInfo({ event: 'giving.created', route: '/api/giving/give', userId: ctx.userId, details: { frequency } });
    return NextResponse.json({ success: true, giftId: data.gift_id });
  } catch (error) {
    logError({ event: 'giving.create_error', route: '/api/giving/give', error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
