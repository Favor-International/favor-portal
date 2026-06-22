import { eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import { users, userProfileDetails, onboardingSurveys, communicationPreferences } from "../schema";

export type ProfileInput = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type OnboardingSurveyInput = {
  howHeard?: string | null;
  rddContact?: string | null;
  interests?: string[];
  churchConnection?: boolean;
};

export type CommPreferencesInput = {
  emailNewsletterWeekly?: boolean;
  emailNewsletterMonthly?: boolean;
  emailQuarterlyReport?: boolean;
  emailAnnualReport?: boolean;
  emailEvents?: boolean;
  emailPrayer?: boolean;
  emailGivingConfirmations?: boolean;
  smsEnabled?: boolean;
  smsGiftConfirmations?: boolean;
  smsEventReminders?: boolean;
  smsUrgentOnly?: boolean;
  mailEnabled?: boolean;
  mailNewsletterQuarterly?: boolean;
  mailAnnualReport?: boolean;
  mailHolidayCard?: boolean;
  mailAppeals?: boolean;
  reportPeriod?: "quarterly" | "annual";
};

export async function getProfile(db: Db, ctx: AuthContext) {
  const user = await db.select().from(users).where(eq(users.id, ctx.userId)).get();
  if (!user) return null;
  const profileDetails = await db
    .select()
    .from(userProfileDetails)
    .where(eq(userProfileDetails.userId, ctx.userId))
    .get();
  const preferences = await db
    .select()
    .from(communicationPreferences)
    .where(eq(communicationPreferences.userId, ctx.userId))
    .get();
  return { ...user, profileDetails: profileDetails ?? null, preferences: preferences ?? null };
}

export async function updateProfile(db: Db, ctx: AuthContext, input: ProfileInput) {
  const userFields: Record<string, unknown> = {};
  if (input.firstName !== undefined) userFields.firstName = input.firstName;
  if (input.lastName !== undefined) userFields.lastName = input.lastName;
  if (input.phone !== undefined) userFields.phone = input.phone;
  if (Object.keys(userFields).length > 0) {
    await db.update(users).set(userFields).where(eq(users.id, ctx.userId));
  }

  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(userProfileDetails)
    .where(eq(userProfileDetails.userId, ctx.userId))
    .get();
  if (existing) {
    await db
      .update(userProfileDetails)
      .set({
        street: input.street ?? existing.street,
        city: input.city ?? existing.city,
        state: input.state ?? existing.state,
        zip: input.zip ?? existing.zip,
        updatedAt: now,
      })
      .where(eq(userProfileDetails.userId, ctx.userId));
  } else {
    await db.insert(userProfileDetails).values({
      id: crypto.randomUUID(),
      userId: ctx.userId,
      street: input.street ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip: input.zip ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return getProfile(db, ctx);
}

export async function getOnboardingSurvey(db: Db, ctx: AuthContext) {
  const survey = await db
    .select()
    .from(onboardingSurveys)
    .where(eq(onboardingSurveys.userId, ctx.userId))
    .get();
  return survey ?? null;
}

export async function upsertOnboardingSurvey(db: Db, ctx: AuthContext, input: OnboardingSurveyInput) {
  const existing = await db
    .select()
    .from(onboardingSurveys)
    .where(eq(onboardingSurveys.userId, ctx.userId))
    .get();
  if (existing) {
    await db
      .update(onboardingSurveys)
      .set({
        howHeard: input.howHeard ?? existing.howHeard,
        rddContact: input.rddContact ?? existing.rddContact,
        interests: input.interests ?? existing.interests,
        churchConnection: input.churchConnection ?? existing.churchConnection,
      })
      .where(eq(onboardingSurveys.userId, ctx.userId));
  } else {
    await db.insert(onboardingSurveys).values({
      id: crypto.randomUUID(),
      userId: ctx.userId,
      howHeard: input.howHeard ?? null,
      rddContact: input.rddContact ?? null,
      interests: input.interests ?? [],
      churchConnection: input.churchConnection ?? false,
    });
  }
  return getOnboardingSurvey(db, ctx);
}

export async function getCommPreferences(db: Db, ctx: AuthContext) {
  const prefs = await db
    .select()
    .from(communicationPreferences)
    .where(eq(communicationPreferences.userId, ctx.userId))
    .get();
  return prefs ?? null;
}

export async function updateCommPreferences(db: Db, ctx: AuthContext, input: CommPreferencesInput) {
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(communicationPreferences)
    .where(eq(communicationPreferences.userId, ctx.userId))
    .get();
  if (existing) {
    await db
      .update(communicationPreferences)
      .set({ ...input, updatedAt: now })
      .where(eq(communicationPreferences.userId, ctx.userId));
  } else {
    await db.insert(communicationPreferences).values({
      id: crypto.randomUUID(),
      userId: ctx.userId,
      ...input,
      updatedAt: now,
    });
  }
  return getCommPreferences(db, ctx);
}
