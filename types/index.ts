export type ConstituentType = 
  | 'individual' 
  | 'major_donor' 
  | 'church' 
  | 'foundation' 
  | 'daf' 
  | 'ambassador' 
  | 'volunteer';

export type AdminRoleKey =
  | 'super_admin'
  | 'lms_manager'
  | 'content_manager'
  | 'support_manager'
  | 'analyst'
  | 'viewer';

export type AdminPermission =
  | 'admin:access'
  | 'users:manage'
  | 'lms:manage'
  | 'content:manage'
  | 'support:manage'
  | 'analytics:view'
  | 'audit:view';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  blackbaudConstituentId?: string;
  constituentType: ConstituentType;
  lifetimeGivingTotal: number;
  rddAssignment?: string;
  createdAt: string;
  lastLogin?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  roles?: AdminRoleKey[];
  permissions?: AdminPermission[];
}

export interface Gift {
  id: string;
  userId: string;
  amount: number;
  date: string;
  designation: string;
  blackbaudGiftId?: string;
  isRecurring: boolean;
  receiptSent: boolean;
  source?: 'imported' | 'portal';
  // Read-only receipt enrichment from Blackbaud (optional; present when the
  // gift has an issued receipt).
  receipted?: boolean;
  receiptNumber?: number | null;
  receiptDate?: string | null;
}

export interface GivingSummary {
  totalGiven: number;
  loadedTotal?: number;
  ytdGiven: number;
  giftCount: number;
  yearsActive: number;
  lifetimeTotal?: number | null;
  consecutiveYearsGiven?: number | null;
  totalYearsGiven?: number | null;
  firstGiftDate?: string | null;
  firstGiftAmount?: number | null;
}

export interface RecurringGift {
  id: string;
  userId: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annual';
  nextChargeDate: string;
  stripeSubscriptionId: string;
  status: 'active' | 'paused' | 'cancelled';
  createdAt: string;
}

export interface CommunicationPreferences {
  id: string;
  userId: string;
  
  // Email preferences
  emailNewsletterWeekly: boolean;
  emailNewsletterMonthly: boolean;
  emailQuarterlyReport: boolean;
  emailAnnualReport: boolean;
  emailEvents: boolean;
  emailPrayer: boolean;
  emailGivingConfirmations: boolean;
  
  // SMS preferences
  smsEnabled: boolean;
  smsGiftConfirmations: boolean;
  smsEventReminders: boolean;
  smsUrgentOnly: boolean;
  
  // Direct mail preferences
  mailEnabled: boolean;
  mailNewsletterQuarterly: boolean;
  mailAnnualReport: boolean;
  mailHolidayCard: boolean;
  mailAppeals: boolean;
  
  reportPeriod: 'quarterly' | 'annual';
  blackbaudSolicitCodes: string[];
  lastSyncedAt?: string;
  updatedAt: string;
}

export interface UserProfileDetails {
  userId: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface GivingGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: 'annual' | 'project' | 'monthly' | 'custom';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  accessLevel: 'partner' | 'major_donor' | 'church' | 'foundation' | 'ambassador';
  sortOrder: number;
  createdAt: string;
  moduleCount?: number;
  status?: 'draft' | 'published';
  isLocked?: boolean;
  isPaid?: boolean;
  price?: number;
  tags?: string[];
  coverImage?: string;
  enforceSequential?: boolean;
  publishAt?: string;
  unpublishAt?: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  cloudflareVideoId: string;
  sortOrder: number;
  durationSeconds: number;
  type?: 'video' | 'reading' | 'quiz';
  resourceUrl?: string;
  notes?: string;
  quizPayload?: unknown;
  passThreshold?: number;
}

export interface UserCourseProgress {
  id: string;
  userId: string;
  moduleId: string;
  completed: boolean;
  completedAt?: string;
  watchTimeSeconds: number;
  lastWatchedAt?: string;
}

export interface CourseNote {
  id: string;
  userId: string;
  moduleId: string;
  content: string;
  updatedAt: string;
}

export interface UserQuizAttempt {
  id: string;
  userId: string;
  courseId: string;
  moduleId: string;
  attemptNumber: number;
  scorePercent: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  answers: Record<string, string | number>;
  questionOrder: string[];
  optionOrder: Record<string, number[]>;
  startedAt: string;
  submittedAt: string;
  durationSeconds: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface CourseModuleEvent {
  id: string;
  userId: string;
  courseId: string;
  moduleId: string;
  eventType:
    | 'module_viewed'
    | 'module_started'
    | 'module_completed'
    | 'module_reopened'
    | 'quiz_passed'
    | 'quiz_failed';
  watchTimeSeconds: number;
  createdAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export type CourseCohortRole = 'learner' | 'mentor' | 'instructor';

export interface CourseCohort {
  id: string;
  courseId: string;
  name: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  membersCount?: number;
  isMember?: boolean;
  membershipRole?: CourseCohortRole;
}

export interface CourseCohortMember {
  id: string;
  cohortId: string;
  userId: string;
  membershipRole: CourseCohortRole;
  joinedAt: string;
}

export interface CourseDiscussionThread {
  id: string;
  courseId: string;
  cohortId?: string;
  moduleId?: string;
  authorUserId: string;
  authorName?: string;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDiscussionReply {
  id: string;
  threadId: string;
  authorUserId: string;
  authorName?: string;
  body: string;
  isInstructorReply: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleKey: AdminRoleKey;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface CourseVersionSnapshot {
  id: string;
  courseId: string;
  versionNumber: number;
  snapshot: Record<string, unknown>;
  published: boolean;
  createdBy?: string;
  createdAt: string;
}

export interface FoundationGrant {
  id: string;
  userId: string;
  grantName: string;
  amount: number;
  startDate: string;
  endDate?: string;
  status: 'pending' | 'approved' | 'active' | 'completed' | 'rejected';
  nextReportDue?: string;
  notes?: string;
  createdAt: string;
}

export interface OnboardingSurvey {
  id: string;
  userId: string;
  howHeard?: string;
  rddContact?: string;
  interests: string[];
  churchConnection: boolean;
  completedAt: string;
}

export interface SupportMessage {
  id: string;
  sender: 'partner' | 'staff';
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  requesterUserId?: string;
  category: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  requesterName?: string;
  requesterEmail?: string;
  messages?: SupportMessage[];
}

export interface ActivityEvent {
  id: string;
  type:
    | 'gift_created'
    | 'course_completed'
    | 'course_progress'
    | 'content_viewed'
    | 'support_ticket'
    | 'profile_updated'
    | 'login';
  userId: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface BlackbaudConstituent {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  phone?: string;
  constituentCode: ConstituentType;
  lifetimeGiving: number;
  solicitCodes: string[];
  rddAssignment?: string;
}

export interface BlackbaudGift {
  id: string;
  constituentId: string;
  amount: number;
  date: string;
  designation: string;
  type: 'one_time' | 'recurring';
  campaign?: string;
  appeal?: string;
}

export type ContentType = 'report' | 'update' | 'resource' | 'prayer' | 'story';

export interface ContentItem {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  type: ContentType;
  accessLevel: 'all' | 'partner' | 'major_donor' | 'church' | 'foundation' | 'daf' | 'ambassador' | 'volunteer';
  date: string;
  author: string;
  tags: string[];
  status?: 'published' | 'draft';
  coverImage?: string;
  fileUrl?: string;
}

export interface PortalEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  audience: 'partner' | 'church' | 'foundation' | 'daf' | 'ambassador' | 'volunteer';
}

export interface CommunicationTemplate {
  id: string;
  channel: 'email' | 'sms' | 'direct_mail';
  name: string;
  subject?: string;
  content: string;
  status: 'active' | 'draft';
  updatedAt: string;
}
