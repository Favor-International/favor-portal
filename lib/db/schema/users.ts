import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";

export const CONSTITUENT_TYPES = [
  "individual",
  "major_donor",
  "church",
  "foundation",
  "daf",
  "ambassador",
  "volunteer",
] as const;

export const USER_ROLE_KEYS = [
  "super_admin",
  "lms_manager",
  "content_manager",
  "support_manager",
  "analyst",
  "viewer",
] as const;

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  blackbaudConstituentId: text("blackbaud_constituent_id"),
  constituentType: text("constituent_type", { enum: CONSTITUENT_TYPES }),
  lifetimeGivingTotal: real("lifetime_giving_total").default(0),
  rddAssignment: text("rdd_assignment"),
  avatarUrl: text("avatar_url"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  onboardingRequired: integer("onboarding_required", { mode: "boolean" }).notNull().default(false),
  onboardingCompletedAt: text("onboarding_completed_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  lastLogin: text("last_login"),
});

export const userRoles = sqliteTable(
  "user_roles",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleKey: text("role_key", { enum: USER_ROLE_KEYS }).notNull(),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  },
  (t) => [unique().on(t.userId, t.roleKey)],
);

export const userProfileDetails = sqliteTable("user_profile_details", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  street: text("street"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const onboardingSurveys = sqliteTable("onboarding_surveys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  howHeard: text("how_heard"),
  rddContact: text("rdd_contact"),
  interests: text("interests", { mode: "json" }).$type<string[]>().$defaultFn(() => []),
  churchConnection: integer("church_connection", { mode: "boolean" }).default(false),
  completedAt: text("completed_at").$defaultFn(() => new Date().toISOString()),
});
