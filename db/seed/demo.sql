-- Demo seed: a fully-populated partner + an admin for the shareable demo worker.
-- Used ONLY by the `demo` wrangler environment (favor-portal-demo D1). Safe to re-run:
-- demo rows use fixed `demo-*` ids and are deleted first so this acts as a reset.
-- NOTE: columns backed by Drizzle $defaultFn (created_at, updated_at, synced_at, tags,
-- metadata, etc.) have NO SQL default, so they are supplied explicitly here.

-- ---------------------------------------------------------------------------
-- Reset existing demo rows (child rows cascade from users, but be explicit for
-- the non-user-scoped tables).
-- ---------------------------------------------------------------------------
DELETE FROM users WHERE id IN ('demo-partner-user', 'demo-admin-user');
DELETE FROM portal_content WHERE id LIKE 'demo-%';
DELETE FROM portal_activity_events WHERE id LIKE 'demo-%';
DELETE FROM course_cohorts WHERE id LIKE 'demo-%';

-- ---------------------------------------------------------------------------
-- Users: one rich partner (major donor) + one admin (super_admin).
-- ---------------------------------------------------------------------------
INSERT INTO users (id, email, first_name, last_name, phone, constituent_type, lifetime_giving_total, rdd_assignment, is_admin, onboarding_required, created_at, last_login) VALUES
('demo-partner-user', 'demo.partner@favorintl.org', 'Grace', 'Thompson', '+1 555 0142', 'major_donor', 28500, 'Sarah Mitchell', 0, 0, '2024-02-11T15:00:00.000Z', '2026-06-29T18:30:00.000Z'),
('demo-admin-user', 'demo.admin@favorintl.org', 'David', 'Okello', '+1 555 0188', 'individual', 0, NULL, 1, 0, '2023-08-01T12:00:00.000Z', '2026-06-30T09:00:00.000Z');

INSERT INTO user_roles (id, user_id, role_key, created_at, updated_at) VALUES
('demo-role-admin', 'demo-admin-user', 'super_admin', '2023-08-01T12:00:00.000Z', '2023-08-01T12:00:00.000Z');

INSERT INTO user_profile_details (id, user_id, street, city, state, zip, created_at, updated_at) VALUES
('demo-profile-partner', 'demo-partner-user', '742 Cedar Hollow Ln', 'Franklin', 'TN', '37064', '2024-02-11T15:00:00.000Z', '2026-01-04T10:00:00.000Z');

INSERT INTO communication_preferences (id, user_id, report_period, updated_at) VALUES
('demo-commprefs-partner', 'demo-partner-user', 'quarterly', '2026-01-04T10:00:00.000Z');

-- ---------------------------------------------------------------------------
-- Giving history (giving_cache), a recurring gift, and a giving goal.
-- ---------------------------------------------------------------------------
INSERT INTO giving_cache (id, user_id, gift_date, amount, designation, is_recurring, source, note, synced_at, created_at) VALUES
('demo-gift-1', 'demo-partner-user', '2026-06-01', 250,  'General Fund',         1, 'imported', 'Monthly partnership', '2026-06-01T06:00:00.000Z', '2026-06-01T06:00:00.000Z'),
('demo-gift-2', 'demo-partner-user', '2026-05-01', 250,  'General Fund',         1, 'imported', 'Monthly partnership', '2026-05-01T06:00:00.000Z', '2026-05-01T06:00:00.000Z'),
('demo-gift-3', 'demo-partner-user', '2026-04-01', 250,  'General Fund',         1, 'imported', 'Monthly partnership', '2026-04-01T06:00:00.000Z', '2026-04-01T06:00:00.000Z'),
('demo-gift-4', 'demo-partner-user', '2026-03-15', 5000, 'Clean Water Project',  0, 'imported', 'Spring appeal',       '2026-03-15T16:20:00.000Z', '2026-03-15T16:20:00.000Z'),
('demo-gift-5', 'demo-partner-user', '2025-12-20', 10000,'Year-End Match',       0, 'imported', 'Matched 2x',          '2025-12-20T20:00:00.000Z', '2025-12-20T20:00:00.000Z'),
('demo-gift-6', 'demo-partner-user', '2025-09-10', 2500, 'Pastor Training',      0, 'imported', NULL,                  '2025-09-10T14:00:00.000Z', '2025-09-10T14:00:00.000Z');

INSERT INTO recurring_gifts (id, user_id, amount, frequency, next_charge_date, stripe_subscription_id, status, created_at) VALUES
('demo-recurring-1', 'demo-partner-user', 250, 'monthly', '2026-07-01', 'demo-sub-001', 'active', '2025-01-01T06:00:00.000Z');

INSERT INTO user_giving_goals (id, user_id, name, target_amount, current_amount, deadline, category, description, created_at, updated_at) VALUES
('demo-goal-1', 'demo-partner-user', '2026 Annual Partnership', 5000, 3000, '2026-12-31', 'annual', 'Sustain a rural pastor for a full year.', '2026-01-02T10:00:00.000Z', '2026-06-01T06:00:00.000Z');

-- ---------------------------------------------------------------------------
-- Course progress: Africa Programs Overview fully complete (-> certificate),
-- Vision and Great Commission partially complete (2 of 5).
-- ---------------------------------------------------------------------------
INSERT INTO user_course_progress (id, user_id, module_id, completed, completed_at, watch_time_seconds, last_watched_at) VALUES
('demo-prog-1', 'demo-partner-user', 'mod-africa-1', 1, '2026-02-10T19:00:00.000Z', 1800, '2026-02-10T19:00:00.000Z'),
('demo-prog-2', 'demo-partner-user', 'mod-africa-2', 1, '2026-02-12T19:30:00.000Z', 2400, '2026-02-12T19:30:00.000Z'),
('demo-prog-3', 'demo-partner-user', 'mod-africa-3', 1, '2026-02-15T20:00:00.000Z', 2100, '2026-02-15T20:00:00.000Z'),
('demo-prog-4', 'demo-partner-user', 'mod-africa-4', 1, '2026-02-18T20:15:00.000Z', 1950, '2026-02-18T20:15:00.000Z'),
('demo-prog-5', 'demo-partner-user', 'mod-vision-1', 1, '2026-05-20T18:00:00.000Z', 2700, '2026-05-20T18:00:00.000Z'),
('demo-prog-6', 'demo-partner-user', 'mod-vision-2', 1, '2026-05-22T18:40:00.000Z', 2250, '2026-05-22T18:40:00.000Z');

INSERT INTO user_course_certificates (id, user_id, course_id, completion_rate, issued_at, metadata, verification_token, certificate_number) VALUES
('demo-cert-1', 'demo-partner-user', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 100, '2026-02-18T20:20:00.000Z', '{"courseTitle":"Africa Programs Overview","recipient":"Grace Thompson"}', 'demo-verify-africa-0001', 'FAVOR-2026-0001');

-- ---------------------------------------------------------------------------
-- A cohort for the Vision course with the demo partner enrolled + a thread.
-- ---------------------------------------------------------------------------
INSERT INTO course_cohorts (id, course_id, name, description, starts_at, ends_at, is_active, created_by, created_at, updated_at) VALUES
('demo-cohort-1', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Spring 2026 Cohort', 'Six-week guided study of Favor''s founding vision.', '2026-05-01', '2026-06-15', 1, 'demo-admin-user', '2026-04-15T12:00:00.000Z', '2026-04-15T12:00:00.000Z');

INSERT INTO course_cohort_members (id, cohort_id, user_id, membership_role, joined_at) VALUES
('demo-cohortmem-1', 'demo-cohort-1', 'demo-partner-user', 'learner', '2026-05-01T12:00:00.000Z');

INSERT INTO course_discussion_threads (id, course_id, cohort_id, module_id, author_user_id, title, body, pinned, reply_count, last_activity_at, created_at, updated_at) VALUES
('demo-thread-1', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'demo-cohort-1', 'mod-vision-1', 'demo-partner-user', 'Struck by the indigenous leadership model', 'The idea that local leaders carry the work changed how I think about partnership. Curious how others are applying this.', 1, 1, '2026-05-21T15:00:00.000Z', '2026-05-20T19:00:00.000Z', '2026-05-21T15:00:00.000Z');

INSERT INTO course_discussion_replies (id, thread_id, author_user_id, body, is_instructor_reply, created_at, updated_at) VALUES
('demo-reply-1', 'demo-thread-1', 'demo-admin-user', 'Great reflection, Grace. This is exactly the multiplication principle Carol teaches in module 3.', 1, '2026-05-21T15:00:00.000Z', '2026-05-21T15:00:00.000Z');

-- ---------------------------------------------------------------------------
-- Portal content feed (published).
-- ---------------------------------------------------------------------------
INSERT INTO portal_content (id, title, excerpt, body, type, access_level, status, author, tags, cover_image, published_at, created_at, updated_at) VALUES
('demo-content-1', 'Q1 2026 Field Report', 'Twelve new churches planted and 340 leaders trained across East Africa.', 'In the first quarter of 2026, your partnership made possible twelve new church plants across Uganda and the DRC, with 340 indigenous leaders completing foundational training. Clean water reached four new communities.', 'report', 'all', 'published', 'Favor International', '["impact","report"]', '/brand/hero-congo-grads.jpg', '2026-04-05T12:00:00.000Z', '2026-04-05T12:00:00.000Z', '2026-04-05T12:00:00.000Z'),
('demo-content-2', 'New Church Planted in Karamoja', 'Where others will not go, the gospel is taking root.', 'A new fellowship has been established in a remote area of Karamoja, led entirely by a locally trained pastor. Forty believers gathered for the first service.', 'update', 'all', 'published', 'Favor International', '["field","church-planting"]', '/brand/hero-church-planting.jpg', '2026-05-18T12:00:00.000Z', '2026-05-18T12:00:00.000Z', '2026-05-18T12:00:00.000Z'),
('demo-content-3', 'Pray for the Bishoftu Training of Trainers', 'Sixty leaders gather next week for an intensive equipping.', 'Please pray for the Training of Trainers gathering in Bishoftu. Sixty leaders will be equipped to disciple others in their home regions. Pray for safe travel, open hearts, and multiplication.', 'prayer', 'all', 'published', 'Favor International', '["prayer"]', '/brand/highlight-prayer.jpg', '2026-06-22T12:00:00.000Z', '2026-06-22T12:00:00.000Z', '2026-06-22T12:00:00.000Z'),
('demo-content-4', 'A New Believer''s Story', 'Transformed hearts transform nations.', 'After attending a House of Prayer gathering, a young mother gave her life to Christ and now leads worship in her village fellowship.', 'story', 'all', 'published', 'Favor International', '["testimony"]', '/brand/highlight-saved.jpg', '2026-06-10T12:00:00.000Z', '2026-06-10T12:00:00.000Z', '2026-06-10T12:00:00.000Z');

-- ---------------------------------------------------------------------------
-- A support ticket (open) from the partner.
-- ---------------------------------------------------------------------------
INSERT INTO support_tickets (id, requester_user_id, requester_name, requester_email, category, subject, message, status, priority, created_at, updated_at) VALUES
('demo-ticket-1', 'demo-partner-user', 'Grace Thompson', 'demo.partner@favorintl.org', 'giving', 'Year-end tax receipt', 'Could you resend my 2025 year-end giving statement for tax filing? Thank you!', 'open', 'normal', '2026-06-28T14:00:00.000Z', '2026-06-28T14:00:00.000Z');

INSERT INTO support_messages (id, ticket_id, sender, sender_user_id, message, created_at) VALUES
('demo-ticketmsg-1', 'demo-ticket-1', 'partner', 'demo-partner-user', 'Could you resend my 2025 year-end giving statement for tax filing? Thank you!', '2026-06-28T14:00:00.000Z');

-- ---------------------------------------------------------------------------
-- Activity events (feed the admin overview).
-- ---------------------------------------------------------------------------
INSERT INTO portal_activity_events (id, type, user_id, metadata, created_at) VALUES
('demo-event-1', 'gift_created',      'demo-partner-user', '{"amount":250,"designation":"General Fund"}', '2026-06-01T06:00:00.000Z'),
('demo-event-2', 'course_completed',  'demo-partner-user', '{"course":"Africa Programs Overview"}',       '2026-02-18T20:20:00.000Z'),
('demo-event-3', 'support_ticket',    'demo-partner-user', '{"subject":"Year-end tax receipt"}',          '2026-06-28T14:00:00.000Z'),
('demo-event-4', 'login',             'demo-partner-user', '{}',                                          '2026-06-29T18:30:00.000Z');
