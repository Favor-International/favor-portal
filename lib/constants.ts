export const GIVING_TIERS = {
  BASIC: {
    min: 0,
    max: 999,
    name: 'Partner',
    benefits: ['Portal access', 'Basic courses', 'Giving history']
  },
  SILVER: {
    min: 1000,
    max: 4999,
    name: 'Silver Partner',
    benefits: ['Quarterly impact reports', 'Extended video library', 'Priority support']
  },
  GOLD: {
    min: 5000,
    max: 9999,
    name: 'Gold Partner',
    benefits: ['Direct RDD contact', 'Exclusive events', 'Early access to content']
  },
  PLATINUM: {
    min: 10000,
    max: Infinity,
    name: 'Platinum Partner',
    benefits: ['990 form access', 'Financial reports', 'Board meeting summaries', 'Annual dinner invitation']
  }
} as const;

export function getGivingTier(lifetimeGiving: number) {
  if (lifetimeGiving >= GIVING_TIERS.PLATINUM.min) return GIVING_TIERS.PLATINUM;
  if (lifetimeGiving >= GIVING_TIERS.GOLD.min) return GIVING_TIERS.GOLD;
  if (lifetimeGiving >= GIVING_TIERS.SILVER.min) return GIVING_TIERS.SILVER;
  return GIVING_TIERS.BASIC;
}

export const APP_CONFIG = {
  name: 'Favor International',
  tagline: 'Transformed Hearts Transform Nations',
  domain: 'portal.favorintl.org',
  logo: '/brand/favor-logo-color.png',
  colors: {
    // Canvas - 80%
    white: '#FFFFFF',
    cream: '#FFFEF9',
    warmWhite: '#FAF9F6',
    softBeige: '#F5F3EF',
    // Primary - 15%
    deepGreen: '#2b4d24',
    sage: '#8b957b',
    lightSage: '#c5ccc2',
    // Highlight - 5%
    gold: '#e1a730',
    lightGold: '#e0c081',
    terracotta: '#a36d4c',
    dustyTan: '#ba9a86',
    // Text
    charcoal: '#1a1a1a',
    darkGray: '#333333',
    mediumGray: '#666666',
    lightGray: '#999999'
  },
  fonts: {
    headline: 'Montserrat',
    body: 'Montserrat'
  }
} as const;

export const ROUTES = {
  auth: {
    login: '/login',
    adminLogin: '/admin/login',
    verify: '/verify'
  },
  portal: {
    dashboard: '/dashboard',
    giving: '/giving',
    givingHistory: '/giving/history',
    courses: '/courses',
    content: '/content',
    assistant: '/assistant',
    majorDonor: '/major-donor',
    profile: '/profile',
    settings: '/settings',
    foundation: '/foundation',
    foundationGrants: '/foundation/grants',
    foundationReports: '/foundation/reports',
    church: '/church',
    churchResources: '/church/resources',
    churchMaterials: '/church/materials',
    daf: '/daf',
    dafDocumentation: '/daf/documentation',
    ambassador: '/ambassador',
    ambassadorResources: '/ambassador/resources',
    ambassadorEvents: '/ambassador/events'
  },
  admin: {
    root: '/admin',
    users: '/admin/users',
    courses: '/admin/courses',
    content: '/admin/content',
    communications: '/admin/communications',
    support: '/admin/support'
  }
} as const;

export const COURSE_ACCESS_LEVELS: Record<string, string[]> = {
  partner: ['individual', 'major_donor', 'church', 'foundation', 'daf', 'ambassador', 'volunteer'],
  major_donor: ['major_donor', 'foundation'],
  church: ['church'],
  foundation: ['foundation'],
  ambassador: ['ambassador']
};

export function canAccessCourse(accessLevel: string, userType: string): boolean {
  const allowedTypes = COURSE_ACCESS_LEVELS[accessLevel];
  return allowedTypes?.includes(userType) ?? false;
}

export const CONTENT_ACCESS_LEVELS: Record<string, string[]> = {
  all: ['individual', 'major_donor', 'church', 'foundation', 'daf', 'ambassador', 'volunteer'],
  partner: ['individual', 'major_donor', 'church', 'foundation', 'daf', 'ambassador', 'volunteer'],
  major_donor: ['major_donor', 'foundation'],
  church: ['church'],
  foundation: ['foundation'],
  daf: ['daf'],
  ambassador: ['ambassador'],
  volunteer: ['volunteer']
};

export function canAccessContent(accessLevel: string, userType: string): boolean {
  const allowedTypes = CONTENT_ACCESS_LEVELS[accessLevel];
  return allowedTypes?.includes(userType) ?? false;
}
