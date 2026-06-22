import { NextRequest, NextResponse } from 'next/server';
import { authedRoute } from '@/lib/api/route-auth';
import { getDb } from '@/lib/db/client';
import { updateRecurringGiftStatus } from '@/lib/db/access/giving';
import { AuthorizationError } from '@/lib/db/access/authz';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['active', 'paused', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });
    }

    const auth = await authedRoute();
    if ('error' in auth) return auth.error;
    const { ctx } = auth;

    let gift;
    try {
      gift = await updateRecurringGiftStatus(getDb(), ctx, id, status);
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
      event: 'giving.recurring.status_changed',
      route: '/api/giving/recurring/[id]/status',
      userId: ctx.userId,
      details: { recurringGiftId: id, status },
    });

    return NextResponse.json({ success: true, gift }, { status: 200 });
  } catch (error) {
    logError({
      event: 'giving.recurring.status_change_failed',
      route: '/api/giving/recurring/[id]/status',
      error,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
