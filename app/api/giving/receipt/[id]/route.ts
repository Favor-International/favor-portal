import { NextRequest, NextResponse } from 'next/server';
import { authedRoute } from '@/lib/api/route-auth';
import { getDb } from '@/lib/db/client';
import { getOwnedGift, getUserById } from '@/lib/db/access/sky';
import type { ConstituentType, Gift, User } from '@/types';
import { logError } from '@/lib/logger';
import { ORG } from '@/lib/constants';
import { renderGiftReceipt } from '@/lib/receipts/render';
import { formatDate } from '@/lib/utils';

export const runtime = 'nodejs';

type ReceiptGift = Pick<
  Gift,
  'id' | 'userId' | 'amount' | 'designation' | 'isRecurring' | 'receiptSent' | 'blackbaudGiftId'
> & {
  date: string;
};

type ReceiptDonor = Pick<
  User,
  'id' | 'email' | 'firstName' | 'lastName' | 'constituentType' | 'lifetimeGivingTotal'
> & {
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
};

const VALID_CONSTITUENT_TYPES: ConstituentType[] = [
  'individual',
  'major_donor',
  'church',
  'foundation',
  'daf',
  'ambassador',
  'volunteer',
];

function normalizeConstituentType(value: string | null): ConstituentType {
  return value !== null && VALID_CONSTITUENT_TYPES.includes(value as ConstituentType)
    ? (value as ConstituentType)
    : 'individual';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'html';

    const auth = await authedRoute();
    if ('error' in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    // Get gift and verify ownership
    const gift = await getOwnedGift(db, ctx, id);
    if (!gift) {
      return NextResponse.json({ error: 'Gift not found' }, { status: 404 });
    }

    // Get user details
    const user = await getUserById(db, ctx.userId);

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        gift: {
          id: gift.id,
          user_id: gift.userId,
          gift_date: gift.giftDate,
          amount: gift.amount,
          designation: gift.designation,
          blackbaud_gift_id: gift.blackbaudGiftId,
          is_recurring: gift.isRecurring,
          receipt_sent: gift.receiptSent,
          synced_at: gift.syncedAt,
          source: gift.source,
          note: gift.note,
          created_at: gift.createdAt,
        },
        donor: user
          ? {
              id: user.id,
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName,
              phone: user.phone,
              blackbaud_constituent_id: user.blackbaudConstituentId,
              constituent_type: user.constituentType,
              lifetime_giving_total: user.lifetimeGivingTotal,
              rdd_assignment: user.rddAssignment,
              avatar_url: user.avatarUrl,
              is_admin: user.isAdmin,
              onboarding_required: user.onboardingRequired,
              onboarding_completed_at: user.onboardingCompletedAt,
              created_at: user.createdAt,
              last_login: user.lastLogin,
            }
          : null,
      }, { status: 200 });
    }

    const html = renderGiftReceipt(
      {
        id: gift.blackbaudGiftId || gift.id,
        amount: gift.amount,
        date: gift.giftDate,
        designation: gift.designation,
        isRecurring: Boolean(gift.isRecurring),
      },
      {
        name: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "Valued partner",
        email: user?.email ?? null,
      }
    );

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="receipt-${id}.html"`,
      },
    });
  } catch (error) {
    logError({ event: 'giving.receipt.fetch_failed', route: '/api/giving/receipt/[id]', error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
