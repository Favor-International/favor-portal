import { sqliteTable, text, integer, real, unique, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

const iso = () => new Date().toISOString();

// courses (migrations 001 + 002 + 003)
export const courses = sqliteTable("courses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  accessLevel: text("access_level", {
    enum: ["partner", "major_donor", "church", "foundation", "ambassador"],
  }).default("partner"),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").$defaultFn(iso),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("published"),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  isPaid: integer("is_paid", { mode: "boolean" }).notNull().default(false),
  price: real("price").notNull().default(0),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  coverImage: text("cover_image"),
  enforceSequential: integer("enforce_sequential", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().$defaultFn(iso),
  publishAt: text("publish_at"),
  unpublishAt: text("unpublish_at"),
});

// course_modules (migrations 001 + 002)
export const courseModules = sqliteTable("course_modules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  cloudflareVideoId: text("cloudflare_video_id").notNull(),
  sortOrder: integer("sort_order").default(0),
  durationSeconds: integer("duration_seconds").default(0),
  moduleType: text("module_type", { enum: ["video", "reading", "quiz"] }).notNull().default("video"),
  resourceUrl: text("resource_url"),
  notes: text("notes"),
  quizPayload: text("quiz_payload", { mode: "json" }).$type<Record<string, unknown>>(),
  passThreshold: integer("pass_threshold").notNull().default(70),
  updatedAt: text("updated_at").notNull().$defaultFn(iso),
});

// user_course_progress (migration 001)
export const userCourseProgress = sqliteTable(
  "user_course_progress",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull().references(() => courseModules.id, { onDelete: "cascade" }),
    completed: integer("completed", { mode: "boolean" }).default(false),
    completedAt: text("completed_at"),
    watchTimeSeconds: integer("watch_time_seconds").default(0),
    lastWatchedAt: text("last_watched_at"),
  },
  (t) => [unique().on(t.userId, t.moduleId)],
);

// user_course_notes (migration 002)
export const userCourseNotes = sqliteTable(
  "user_course_notes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull().references(() => courseModules.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    createdAt: text("created_at").$defaultFn(iso),
    updatedAt: text("updated_at").$defaultFn(iso),
  },
  (t) => [unique().on(t.userId, t.moduleId)],
);

// user_course_certificates (migrations 002 + 003)
export const userCourseCertificates = sqliteTable(
  "user_course_certificates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    completionRate: integer("completion_rate").notNull().default(100),
    issuedAt: text("issued_at").$defaultFn(iso),
    certificateUrl: text("certificate_url"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
    verificationToken: text("verification_token"),
    certificateNumber: text("certificate_number"),
  },
  (t) => [
    unique().on(t.userId, t.courseId),
    uniqueIndex("idx_ucc_verification_token").on(t.verificationToken).where(sql`${t.verificationToken} is not null`),
    uniqueIndex("idx_ucc_certificate_number").on(t.certificateNumber).where(sql`${t.certificateNumber} is not null`),
  ],
);

// course_versions (migration 003)
export const courseVersions = sqliteTable(
  "course_versions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: text("snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: text("created_at").$defaultFn(iso),
  },
  (t) => [unique().on(t.courseId, t.versionNumber)],
);

// user_quiz_attempts (migration 003)
export const userQuizAttempts = sqliteTable(
  "user_quiz_attempts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull().references(() => courseModules.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    scorePercent: integer("score_percent").notNull(),
    correctAnswers: integer("correct_answers").notNull().default(0),
    totalQuestions: integer("total_questions").notNull().default(0),
    passed: integer("passed", { mode: "boolean" }).notNull().default(false),
    answers: text("answers", { mode: "json" }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
    questionOrder: text("question_order", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    optionOrder: text("option_order", { mode: "json" }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
    startedAt: text("started_at").$defaultFn(iso),
    submittedAt: text("submitted_at").$defaultFn(iso),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  },
  (t) => [unique().on(t.userId, t.moduleId, t.attemptNumber)],
);

// course_module_events (migration 003)
export const courseModuleEvents = sqliteTable("course_module_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  moduleId: text("module_id").notNull().references(() => courseModules.id, { onDelete: "cascade" }),
  eventType: text("event_type", {
    enum: ["module_viewed", "module_started", "module_completed", "module_reopened", "quiz_passed", "quiz_failed"],
  }).notNull(),
  watchTimeSeconds: integer("watch_time_seconds").notNull().default(0),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  createdAt: text("created_at").$defaultFn(iso),
});
