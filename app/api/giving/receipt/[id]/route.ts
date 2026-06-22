import { NextRequest, NextResponse } from 'next/server';
import { authedRoute } from '@/lib/api/route-auth';
import { getDb } from '@/lib/db/client';
import { getOwnedGift, getUserById } from '@/lib/db/access/sky';
import type { ConstituentType, Gift, User } from '@/types';
import { logError } from '@/lib/logger';

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

    const html = generateReceiptHTML(
      {
        id: gift.id,
        userId: gift.userId,
        amount: gift.amount,
        date: gift.giftDate,
        designation: gift.designation,
        isRecurring: Boolean(gift.isRecurring),
        receiptSent: Boolean(gift.receiptSent),
        blackbaudGiftId: gift.blackbaudGiftId || undefined,
      },
      user ? {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        constituentType: normalizeConstituentType(user.constituentType),
        lifetimeGivingTotal: user.lifetimeGivingTotal ?? 0,
      } : null
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

function generateReceiptHTML(gift: ReceiptGift, donor: ReceiptDonor | null): string {
  const formattedDate = new Date(gift.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const donorName = donor ? `${donor.firstName} ${donor.lastName}` : 'Valued Donor';
  const donorAddress = donor?.address ?
    `${donor.address.street}, ${donor.address.city}, ${donor.address.state} ${donor.address.zip}` :
    'Address on file';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Donation Receipt - Favor International</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #f5f5f0;
      padding: 40px;
    }
    .receipt {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 60px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      border-radius: 8px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2b4d24;
      padding-bottom: 30px;
      margin-bottom: 40px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #2b4d24;
      margin-bottom: 10px;
      letter-spacing: 2px;
    }
    .tagline {
      font-style: italic;
      color: #666;
      font-size: 14px;
    }
    .receipt-title {
      font-size: 28px;
      color: #2b4d24;
      margin: 30px 0 10px;
      text-align: center;
    }
    .receipt-number {
      text-align: center;
      color: #666;
      font-size: 14px;
      margin-bottom: 40px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #999;
      margin-bottom: 10px;
      font-weight: normal;
    }
    .donor-name {
      font-size: 20px;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    .donor-address {
      color: #666;
      font-size: 14px;
    }
    .amount-box {
      background: linear-gradient(135deg, #2b4d24 0%, #3d6633 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      margin: 30px 0;
    }
    .amount-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0.8;
      margin-bottom: 10px;
    }
    .amount-value {
      font-size: 48px;
      font-weight: bold;
    }
    .gift-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 30px 0;
    }
    .detail-item {
      padding: 15px;
      background: #f9f9f7;
      border-radius: 6px;
    }
    .detail-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #999;
      margin-bottom: 5px;
    }
    .detail-value {
      font-size: 16px;
      font-weight: 500;
      color: #1a1a1a;
    }
    .tax-info {
      background: #f9f9f7;
      padding: 25px;
      border-radius: 8px;
      margin-top: 40px;
      border-left: 4px solid #2b4d24;
    }
    .tax-title {
      font-weight: bold;
      color: #2b4d24;
      margin-bottom: 10px;
    }
    .tax-text {
      font-size: 13px;
      color: #666;
      line-height: 1.8;
    }
    .footer {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 1px solid #e5e5e0;
      text-align: center;
      font-size: 12px;
      color: #999;
    }
    .footer p {
      margin-bottom: 5px;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .receipt {
        box-shadow: none;
        padding: 40px;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="logo">FAVOR INTERNATIONAL</div>
      <div class="tagline">Transformed Hearts Transform Nations</div>
    </div>

    <h1 class="receipt-title">Official Donation Receipt</h1>
    <p class="receipt-number">Receipt #: ${gift.id}</p>

    <div class="section">
      <p class="section-title">Donor Information</p>
      <p class="donor-name">${donorName}</p>
      <p class="donor-address">${donorAddress}</p>
      <p class="donor-address">${donor?.email || ''}</p>
    </div>

    <div class="amount-box">
      <p class="amount-label">Donation Amount</p>
      <p class="amount-value">$${gift.amount.toLocaleString()}.00</p>
    </div>

    <div class="gift-details">
      <div class="detail-item">
        <p class="detail-label">Date of Donation</p>
        <p class="detail-value">${formattedDate}</p>
      </div>
      <div class="detail-item">
        <p class="detail-label">Designation</p>
        <p class="detail-value">${gift.designation}</p>
      </div>
      <div class="detail-item">
        <p class="detail-label">Gift Type</p>
        <p class="detail-value">${gift.isRecurring ? 'Recurring' : 'One-time'}</p>
      </div>
      <div class="detail-item">
        <p class="detail-label">Payment Method</p>
        <p class="detail-value">Credit Card</p>
      </div>
    </div>

    <div class="tax-info">
      <p class="tax-title">Tax-Deductible Contribution</p>
      <p class="tax-text">
        Favor International, Inc. is a 501(c)(3) nonprofit organization.
        No goods or services were provided in exchange for this contribution.
        Your donation is tax-deductible to the fullest extent allowed by law.
        Our EIN is XX-XXXXXXX.
      </p>
      <p class="tax-text" style="margin-top: 15px;">
        <strong>Please retain this receipt for your tax records.</strong>
        Annual tax receipts are mailed by January 31st for the previous calendar year.
      </p>
    </div>

    <div class="footer">
      <p><strong>Favor International, Inc.</strong></p>
      <p>3433 Lithia Pinecrest Rd #356, Valrico, FL 33596</p>
      <p>Email: giving@favorinternational.org | Phone: (555) 123-4567</p>
      <p>EIN: XX-XXXXXXX | www.favorinternational.org</p>
      <p style="margin-top: 15px; font-style: italic;">
        Thank you for your generous support of our mission!
      </p>
    </div>
  </div>
</body>
</html>`;
}
