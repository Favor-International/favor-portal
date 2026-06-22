import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { users } from "./users";

const iso = () => new Date().toISOString();

// giving_cache (migrations 001 + 005)
export const givingCache = sqliteTable("giving_cache", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  giftDate: text("gift_date").notNull(),
  amount: real("amount").notNull(),
  designation: text("designation").notNull(),
  blackbaudGiftId: text("blackbaud_gift_id").unique(),
  isRecurring: integer("is_recurring", { mode: "boolean" }).default(false),
  receiptSent: integer("receipt_sent", { mode: "boolean" }).default(false),
  syncedAt: text("synced_at").$defaultFn(iso),
  source: text("source", { enum: ["portal", "imported", "admin"] }).notNull().default("imported"),
  note: text("note"),
  createdAt: text("created_at").$defaultFn(iso),
});

// recurring_gifts (migration 001)
export const recurringGifts = sqliteTable("recurring_gifts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  frequency: text("frequency", { enum: ["monthly", "quarterly", "annual"] }),
  nextChargeDate: text("next_charge_date").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  status: text("status", { enum: ["active", "paused", "cancelled"] }).default("active"),
  createdAt: text("created_at").$defaultFn(iso),
});

// user_giving_goals (migration 006)
export const userGivingGoals = sqliteTable("user_giving_goals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetAmount: real("target_amount").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  deadline: text("deadline").notNull(),
  category: text("category", { enum: ["annual", "project", "monthly", "custom"] }).notNull().default("custom"),
  description: text("description"),
  createdAt: text("created_at").notNull().$defaultFn(iso),
  updatedAt: text("updated_at").notNull().$defaultFn(iso),
});

// foundation_grants (migration 001)
export const foundationGrants = sqliteTable("foundation_grants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantName: text("grant_name").notNull(),
  amount: real("amount").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  status: text("status", { enum: ["pending", "approved", "active", "completed", "rejected"] }),
  nextReportDue: text("next_report_due"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(iso),
});

// communication_preferences (migrations 001 + 006)
export const communicationPreferences = sqliteTable("communication_preferences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  emailNewsletterWeekly: integer("email_newsletter_weekly", { mode: "boolean" }).default(true),
  emailNewsletterMonthly: integer("email_newsletter_monthly", { mode: "boolean" }).default(true),
  emailQuarterlyReport: integer("email_quarterly_report", { mode: "boolean" }).default(true),
  emailAnnualReport: integer("email_annual_report", { mode: "boolean" }).default(true),
  emailEvents: integer("email_events", { mode: "boolean" }).default(true),
  emailPrayer: integer("email_prayer", { mode: "boolean" }).default(true),
  emailGivingConfirmations: integer("email_giving_confirmations", { mode: "boolean" }).default(true),
  smsEnabled: integer("sms_enabled", { mode: "boolean" }).default(false),
  smsGiftConfirmations: integer("sms_gift_confirmations", { mode: "boolean" }).default(true),
  smsEventReminders: integer("sms_event_reminders", { mode: "boolean" }).default(true),
  smsUrgentOnly: integer("sms_urgent_only", { mode: "boolean" }).default(false),
  mailEnabled: integer("mail_enabled", { mode: "boolean" }).default(true),
  mailNewsletterQuarterly: integer("mail_newsletter_quarterly", { mode: "boolean" }).default(true),
  mailAnnualReport: integer("mail_annual_report", { mode: "boolean" }).default(true),
  mailHolidayCard: integer("mail_holiday_card", { mode: "boolean" }).default(true),
  mailAppeals: integer("mail_appeals", { mode: "boolean" }).default(false),
  blackbaudSolicitCodes: text("blackbaud_solicit_codes", { mode: "json" }).$type<string[]>().$defaultFn(() => []),
  lastSyncedAt: text("last_synced_at"),
  updatedAt: text("updated_at").$defaultFn(iso),
  reportPeriod: text("report_period", { enum: ["quarterly", "annual"] }).notNull().default("quarterly"),
});
