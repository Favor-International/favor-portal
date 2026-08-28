import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import {
  getCommPreferences,
  updateCommPreferences,
  type CommPreferencesInput,
} from "@/lib/db/access/profile";
import { logError, logInfo } from "@/lib/logger";
import { pushContactPreferences } from "@/lib/blackbaud/gateway";
import { getUserById } from "@/lib/db/access/sky";

export const runtime = "nodejs";

const BOOLEAN_KEYS: (keyof CommPreferencesInput)[] = [
  "emailNewsletterWeekly",
  "emailNewsletterMonthly",
  "emailQuarterlyReport",
  "emailAnnualReport",
  "emailEvents",
  "emailPrayer",
  "emailGivingConfirmations",
  "smsEnabled",
  "smsGiftConfirmations",
  "smsEventReminders",
  "smsUrgentOnly",
  "mailEnabled",
  "mailNewsletterQuarterly",
  "mailAnnualReport",
  "mailHolidayCard",
  "mailAppeals",
];

function buildInput(body: Record<string, unknown>): CommPreferencesInput {
  const input: CommPreferencesInput = {};
  const out = input as Record<string, unknown>;
  for (const key of BOOLEAN_KEYS) {
    if (typeof body[key] === "boolean") {
      out[key] = body[key];
    }
  }
  if (body.reportPeriod === "quarterly" || body.reportPeriod === "annual") {
    input.reportPeriod = body.reportPeriod;
  }
  return input;
}

export async function GET() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const preferences = await getCommPreferences(getDb(), ctx);

    return NextResponse.json({ success: true, preferences: preferences ?? null });
  } catch (error) {
    logError({ event: "preferences.fetch_failed", route: "/api/preferences", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function handleUpdate(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const input = buildInput(body);

  const auth = await authedRoute();
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const db = getDb();
  const preferences = await updateCommPreferences(db, ctx, input);

  // The portal is not the system of record for consent: RE NXT is. Push the
  // channel-level choices there so the mail house and email team see them.
  // Failure-isolated on purpose, the partner's save already succeeded.
  let blackbaud: Record<string, string> | null = null;
  try {
    const userRow = await getUserById(db, ctx.userId);
    if (userRow?.email && preferences) {
      blackbaud = await pushContactPreferences(userRow.email.toLowerCase(), {
        // No email category left on means the partner wants no email at all.
        email_opt_out: !(
          preferences.emailNewsletterMonthly ||
          preferences.emailEvents ||
          preferences.emailGivingConfirmations
        ),
        mail_opt_out: !preferences.mailEnabled,
        phone_opt_out: !preferences.smsEnabled,
      });
    }
  } catch (error) {
    logError({ event: "preferences.blackbaud_push_failed", route: "/api/preferences", error });
  }

  logInfo({
    event: "preferences.updated",
    route: "/api/preferences",
    userId: ctx.userId,
  });

  return NextResponse.json({ success: true, preferences: preferences ?? null, blackbaud });
}

export async function PUT(request: NextRequest) {
  try {
    return await handleUpdate(request);
  } catch (error) {
    logError({ event: "preferences.update_failed", route: "/api/preferences", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    return await handleUpdate(request);
  } catch (error) {
    logError({ event: "preferences.update_failed", route: "/api/preferences", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
