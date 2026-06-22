import { NextRequest, NextResponse } from 'next/server';
import { authedRoute } from '@/lib/api/route-auth';
import { getDb } from '@/lib/db/client';
import { cancelRecurringGift } from '@/lib/db/access/giving';
import { AuthorizationError } from '@/lib/db/access/authz';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await authedRoute();
    if ('error' in auth) return auth.error;
    const { ctx } = auth;

    let gift;
    try {
      gift = await cancelRecurringGift(getDb(), ctx, id);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: 'Gift not found' }, { status: 404 });
      }
      throw error;
    }

    if (!gift) {
      return NextResponse.json({ error: 'Gift not found' }, { status: 404 });
    }

    logInfo({
      event: 'giving.recurring.cancelled',
      route: '/api/giving/recurring/[id]/cancel',
      userId: ctx.userId,
      details: { recurringGiftId: id },
    });

    return NextResponse.json({ success: true, gift }, { status: 200 });
  } catch (error) {
    logError({
      event: 'giving.recurring.cancel_failed',
      route: '/api/giving/recurring/[id]/cancel',
      error,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
