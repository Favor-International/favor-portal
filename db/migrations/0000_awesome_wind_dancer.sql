CREATE TABLE `onboarding_surveys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`how_heard` text,
	`rdd_contact` text,
	`interests` text,
	`church_connection` integer DEFAULT false,
	`completed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_surveys_user_id_unique` ON `onboarding_surveys` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_profile_details` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`street` text,
	`city` text,
	`state` text,
	`zip` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profile_details_user_id_unique` ON `user_profile_details` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_key` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_roles_user_id_role_key_unique` ON `user_roles` (`user_id`,`role_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`phone` text,
	`blackbaud_constituent_id` text,
	`constituent_type` text,
	`lifetime_giving_total` real DEFAULT 0,
	`rdd_assignment` text,
	`avatar_url` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`onboarding_required` integer DEFAULT false NOT NULL,
	`onboarding_completed_at` text,
	`created_at` text,
	`last_login` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `communication_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email_newsletter_weekly` integer DEFAULT true,
	`email_newsletter_monthly` integer DEFAULT true,
	`email_quarterly_report` integer DEFAULT true,
	`email_annual_report` integer DEFAULT true,
	`email_events` integer DEFAULT true,
	`email_prayer` integer DEFAULT true,
	`email_giving_confirmations` integer DEFAULT true,
	`sms_enabled` integer DEFAULT false,
	`sms_gift_confirmations` integer DEFAULT true,
	`sms_event_reminders` integer DEFAULT true,
	`sms_urgent_only` integer DEFAULT false,
	`mail_enabled` integer DEFAULT true,
	`mail_newsletter_quarterly` integer DEFAULT true,
	`mail_annual_report` integer DEFAULT true,
	`mail_holiday_card` integer DEFAULT true,
	`mail_appeals` integer DEFAULT false,
	`blackbaud_solicit_codes` text,
	`last_synced_at` text,
	`updated_at` text,
	`report_period` text DEFAULT 'quarterly' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `communication_preferences_user_id_unique` ON `communication_preferences` (`user_id`);--> statement-breakpoint
CREATE TABLE `foundation_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`grant_name` text NOT NULL,
	`amount` real NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`status` text,
	`next_report_due` text,
	`notes` text,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `giving_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`gift_date` text NOT NULL,
	`amount` real NOT NULL,
	`designation` text NOT NULL,
	`blackbaud_gift_id` text,
	`is_recurring` integer DEFAULT false,
	`receipt_sent` integer DEFAULT false,
	`synced_at` text,
	`source` text DEFAULT 'imported' NOT NULL,
	`note` text,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `giving_cache_blackbaud_gift_id_unique` ON `giving_cache` (`blackbaud_gift_id`);--> statement-breakpoint
CREATE TABLE `recurring_gifts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`frequency` text,
	`next_charge_date` text NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`status` text DEFAULT 'active',
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_gifts_stripe_subscription_id_unique` ON `recurring_gifts` (`stripe_subscription_id`);--> statement-breakpoint
CREATE TABLE `user_giving_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`target_amount` real NOT NULL,
	`current_amount` real DEFAULT 0 NOT NULL,
	`deadline` text NOT NULL,
	`category` text DEFAULT 'custom' NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `course_module_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`module_id` text NOT NULL,
	`event_type` text NOT NULL,
	`watch_time_seconds` integer DEFAULT 0 NOT NULL,
	`metadata` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `course_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cloudflare_video_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`duration_seconds` integer DEFAULT 0,
	`module_type` text DEFAULT 'video' NOT NULL,
	`resource_url` text,
	`notes` text,
	`quiz_payload` text,
	`pass_threshold` integer DEFAULT 70 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `course_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`snapshot` text NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_versions_course_id_version_number_unique` ON `course_versions` (`course_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`thumbnail_url` text,
	`access_level` text DEFAULT 'partner',
	`sort_order` integer DEFAULT 0,
	`created_at` text,
	`status` text DEFAULT 'published' NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`is_paid` integer DEFAULT false NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`tags` text NOT NULL,
	`cover_image` text,
	`enforce_sequential` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	`publish_at` text,
	`unpublish_at` text
);
--> statement-breakpoint
CREATE TABLE `user_course_certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`completion_rate` integer DEFAULT 100 NOT NULL,
	`issued_at` text,
	`certificate_url` text,
	`metadata` text NOT NULL,
	`verification_token` text,
	`certificate_number` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ucc_verification_token` ON `user_course_certificates` (`verification_token`) WHERE "user_course_certificates"."verification_token" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ucc_certificate_number` ON `user_course_certificates` (`certificate_number`) WHERE "user_course_certificates"."certificate_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `user_course_certificates_user_id_course_id_unique` ON `user_course_certificates` (`user_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `user_course_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`module_id` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_course_notes_user_id_module_id_unique` ON `user_course_notes` (`user_id`,`module_id`);--> statement-breakpoint
CREATE TABLE `user_course_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`module_id` text NOT NULL,
	`completed` integer DEFAULT false,
	`completed_at` text,
	`watch_time_seconds` integer DEFAULT 0,
	`last_watched_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_course_progress_user_id_module_id_unique` ON `user_course_progress` (`user_id`,`module_id`);--> statement-breakpoint
CREATE TABLE `user_quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`module_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`score_percent` integer NOT NULL,
	`correct_answers` integer DEFAULT 0 NOT NULL,
	`total_questions` integer DEFAULT 0 NOT NULL,
	`passed` integer DEFAULT false NOT NULL,
	`answers` text NOT NULL,
	`question_order` text NOT NULL,
	`option_order` text NOT NULL,
	`started_at` text,
	`submitted_at` text,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`metadata` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_quiz_attempts_user_id_module_id_attempt_number_unique` ON `user_quiz_attempts` (`user_id`,`module_id`,`attempt_number`);--> statement-breakpoint
CREATE TABLE `course_cohort_members` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`user_id` text NOT NULL,
	`membership_role` text DEFAULT 'learner' NOT NULL,
	`joined_at` text,
	FOREIGN KEY (`cohort_id`) REFERENCES `course_cohorts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_cohort_members_cohort_id_user_id_unique` ON `course_cohort_members` (`cohort_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `course_cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`starts_at` text,
	`ends_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_cohorts_course_id_name_unique` ON `course_cohorts` (`course_id`,`name`);--> statement-breakpoint
CREATE TABLE `course_discussion_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`body` text NOT NULL,
	`is_instructor_reply` integer DEFAULT false NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`thread_id`) REFERENCES `course_discussion_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `course_discussion_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`cohort_id` text,
	`module_id` text,
	`author_user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`reply_count` integer DEFAULT 0 NOT NULL,
	`last_activity_at` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cohort_id`) REFERENCES `course_cohorts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`details` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `communication_send_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text,
	`template_name` text NOT NULL,
	`channel` text NOT NULL,
	`recipient` text,
	`sent_by` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`metadata` text NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `communication_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sent_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `communication_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`name` text NOT NULL,
	`subject` text,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `portal_activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`user_id` text,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `portal_content` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`excerpt` text NOT NULL,
	`body` text NOT NULL,
	`type` text NOT NULL,
	`access_level` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`author` text DEFAULT 'Favor International' NOT NULL,
	`tags` text NOT NULL,
	`cover_image` text,
	`file_url` text,
	`published_at` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `portal_dashboard_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`role_key` text NOT NULL,
	`highlights` text NOT NULL,
	`actions` text NOT NULL,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_dashboard_overrides_role_key_unique` ON `portal_dashboard_overrides` (`role_key`);--> statement-breakpoint
CREATE TABLE `support_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`sender` text NOT NULL,
	`sender_user_id` text,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_user_id` text,
	`requester_name` text,
	`requester_email` text,
	`category` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`requester_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
