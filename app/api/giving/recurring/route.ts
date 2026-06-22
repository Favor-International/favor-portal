import { NextRequest, NextResponse } from 'next/server';
import { authedRoute } from '@/lib/api/route-auth';
import { getDb } from '@/lib/db/client';
import { listRecurringGifts, createRecurringGift } from '@/lib/db/access/giving';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await authedRoute();
    if ('error' in auth) return auth.error;
    const { ctx } = auth;

    const gifts = await listRecurringGifts(getDb(), ctx);

    return NextResponse.json({ success: true, gifts: gifts || [] }, { status: 200 });
  } catch (error) {
    logError({ event: 'giving.recurring.fetch_failed', route: '/api/giving/recurring', error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, frequency } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    if (!frequency || !['monthly', 'quarterly', 'annual'].includes(frequency)) {
      return NextResponse.json({ error: 'Valid frequency is required' }, { status: 400 });
    }

    const auth = await authedRoute();
    if ('error' in auth) return auth.error;
    const { ctx } = auth;

    // Calculate next charge date based on frequency
    const now = new Date();
    const nextChargeDate = new Date();

    switch (frequency) {
      case 'monthly':
        nextChargeDate.setMonth(now.getMonth() + 1);
        break;
      case 'quarterly':
        nextChargeDate.setMonth(now.getMonth() + 3);
        break;
      case 'annual':
        nextChargeDate.setFullYear(now.getFullYear() + 1);
        break;
    }

    const gift = await createRecurringGift(getDb(), ctx, {
      amount,
      frequency,
      nextChargeDate: nextChargeDate.toISOString(),
      stripeSubscriptionId: `pending-${Date.now()}`, // Will be updated by Stripe webhook
      status: 'active',
    });

    logInfo({
      event: 'giving.recurring.created',
      route: '/api/giving/recurring',
      userId: ctx.userId,
      details: { frequency, amount },
    });

    return NextResponse.json({ success: true, gift }, { status: 201 });
  } catch (error) {
    logError({ event: 'giving.recurring.create_failed', route: '/api/giving/recurring', error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
