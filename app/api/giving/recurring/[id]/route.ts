import { NextRequest, NextResponse } from 'next/server';
import { authedRoute } from '@/lib/api/route-auth';
import { getDb } from '@/lib/db/client';
import { updateRecurringGift, deleteRecurringGift, type UpdateRecurringGift } from '@/lib/db/access/giving';
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
    const { amount, frequency, nextChargeDate } = body;

    const auth = await authedRoute();
    if ('error' in auth) return auth.error;
    const { ctx } = auth;

    const fields: UpdateRecurringGift = {
      ...(amount && { amount }),
      ...(frequency && { frequency }),
      ...(nextChargeDate && { nextChargeDate }),
    };

    let gift;
    try {
      gift = await updateRecurringGift(getDb(), ctx, id, fields);
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
      event: 'giving.recurring.updated',
      route: '/api/giving/recurring/[id]',
      userId: ctx.userId,
      details: { recurringGiftId: id },
    });

    return NextResponse.json({ success: true, gift }, { status: 200 });
  } catch (error) {
    logError({ event: 'giving.recurring.update_failed', route: '/api/giving/recurring/[id]', error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await authedRoute();
    if ('error' in auth) return auth.error;
    const { ctx } = auth;

    let removed;
    try {
      removed = await deleteRecurringGift(getDb(), ctx, id);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: 'Gift not found' }, { status: 404 });
      }
      throw error;
    }

    if (!removed) {
      return NextResponse.json({ error: 'Gift not found' }, { status: 404 });
    }

    logInfo({
      event: 'giving.recurring.deleted',
      route: '/api/giving/recurring/[id]',
      userId: ctx.userId,
      details: { recurringGiftId: id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logError({ event: 'giving.recurring.delete_failed', route: '/api/giving/recurring/[id]', error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
