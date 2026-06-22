import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { courses, courseModules } from "./lms";

const iso = () => new Date().toISOString();

// course_cohorts (migration 004)
export const courseCohorts = sqliteTable(
  "course_cohorts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: text("created_at").$defaultFn(iso),
    updatedAt: text("updated_at").$defaultFn(iso),
  },
  (t) => [unique().on(t.courseId, t.name)],
);

// course_cohort_members (migration 004)
export const courseCohortMembers = sqliteTable(
  "course_cohort_members",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    cohortId: text("cohort_id").notNull().references(() => courseCohorts.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    membershipRole: text("membership_role", { enum: ["learner", "mentor", "instructor"] }).notNull().default("learner"),
    joinedAt: text("joined_at").$defaultFn(iso),
  },
  (t) => [unique().on(t.cohortId, t.userId)],
);

// course_discussion_threads (migration 004)
export const courseDiscussionThreads = sqliteTable("course_discussion_threads", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  cohortId: text("cohort_id").references(() => courseCohorts.id, { onDelete: "set null" }),
  moduleId: text("module_id").references(() => courseModules.id, { onDelete: "set null" }),
  authorUserId: text("author_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  locked: integer("locked", { mode: "boolean" }).notNull().default(false),
  replyCount: integer("reply_count").notNull().default(0),
  lastActivityAt: text("last_activity_at").$defaultFn(iso),
  createdAt: text("created_at").$defaultFn(iso),
  updatedAt: text("updated_at").$defaultFn(iso),
});

// course_discussion_replies (migration 004)
export const courseDiscussionReplies = sqliteTable("course_discussion_replies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  threadId: text("thread_id").notNull().references(() => courseDiscussionThreads.id, { onDelete: "cascade" }),
  authorUserId: text("author_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  isInstructorReply: integer("is_instructor_reply", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").$defaultFn(iso),
  updatedAt: text("updated_at").$defaultFn(iso),
});
