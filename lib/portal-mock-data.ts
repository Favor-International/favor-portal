// Mock data for the portal feed, notifications, and support system

import type { ConstituentType } from "@/types";

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  category: 'Impact Story' | 'Update' | 'Event' | 'Resource' | 'Prayer';
  imageUrl?: string;
  date: string;
  readTime: string;
  href?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'gift' | 'course' | 'event' | 'system' | 'report';
  read: boolean;
  date: string;
  link?: string;
}

export interface ModuleTileData {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  audiences: ConstituentType[] | "all";
  accent?: "sage" | "gold" | "stone" | "clay";
}

export const NEWS_FEED: NewsItem[] = [
  {
    id: 'news-1',
    title: 'Clean Water Reaches Kigali Community',
    excerpt: 'Thanks to partner generosity, 340 families now have access to safe drinking water through a new well installation.',
    category: 'Impact Story',
    date: '2026-01-28',
    readTime: '4 min',
    href: '/content?type=story',
  },
  {
    id: 'news-2',
    title: 'Spring Leadership Summit Registration Open',
    excerpt: 'Join us March 15-17 in Nashville for our annual partner gathering. Early registration is now available.',
    category: 'Event',
    date: '2026-01-25',
    readTime: '2 min',
    href: '/content?tag=event',
  },
  {
    id: 'news-3',
    title: 'Q4 2025 Impact Report Available',
    excerpt: 'Our latest quarterly report is ready. See how your partnership made a difference across 4 countries.',
    category: 'Resource',
    date: '2026-01-20',
    readTime: '8 min',
    href: '/content?type=report',
  },
  {
    id: 'news-4',
    title: 'New Course: Understanding Microfinance',
    excerpt: 'Learn how microfinance initiatives are transforming communities and creating sustainable livelihoods.',
    category: 'Update',
    date: '2026-01-15',
    readTime: '3 min',
    href: '/courses',
  },
  {
    id: 'news-5',
    title: 'Prayer Focus: Eastern Uganda Schools',
    excerpt: 'Join us in praying for the 12 schools we support in Eastern Uganda as the new term begins.',
    category: 'Prayer',
    date: '2026-01-10',
    readTime: '2 min',
    href: '/content?type=prayer',
  },
  {
    id: 'news-6',
    title: 'Ambassador Program Expansion',
    excerpt: 'We are growing our ambassador network to 15 new cities this year. Learn how you can get involved.',
    category: 'Update',
    date: '2026-01-05',
    readTime: '5 min',
    href: '/content?tag=ambassador',
  },
];


export const MODULE_TILES: ModuleTileData[] = [
  {
    id: 'giving',
    title: 'Giving',
    description: 'Track gifts, manage recurring donations, and download receipts.',
    icon: 'Heart',
    href: '/giving',
    color: '#2b4d24',
    audiences: "all",
    accent: "sage",
  },
  {
    id: 'courses',
    title: 'Courses',
    description: 'Deepen your understanding through partner learning modules.',
    icon: 'GraduationCap',
    href: '/courses',
    color: '#2b4d24',
    audiences: "all",
    accent: "stone",
  },
  {
    id: 'content',
    title: 'Content Library',
    description: 'Reports, updates, and downloadable resources tailored to you.',
    icon: 'FileText',
    href: '/content',
    color: '#2b4d24',
    audiences: "all",
    accent: "stone",
  },
  {
    id: 'impact',
    title: 'Impact Reports',
    description: 'See how your partnership is changing lives across nations.',
    icon: 'TrendingUp',
    href: '/giving/impact',
    color: '#2b4d24',
    audiences: ["individual", "major_donor", "church", "foundation", "daf", "ambassador", "volunteer"],
    accent: "gold",
  },
  {
    id: 'support',
    title: 'Support',
    description: 'Get help from our partner support team.',
    icon: 'MessageCircle',
    href: '/support',
    color: '#8b957b',
    audiences: "all",
    accent: "stone",
  },
  {
    id: "profile",
    title: "Profile",
    description: "Review your contact details and partner profile.",
    icon: "User",
    href: "/profile",
    color: "#2b4d24",
    audiences: "all",
    accent: "sage",
  },
  {
    id: "foundation-portfolio",
    title: "Grant Portfolio",
    description: "Monitor reporting cadence and active grant milestones.",
    icon: "Building2",
    href: "/giving?view=grants",
    color: "#2b4d24",
    audiences: ["foundation"],
    accent: "gold",
  },
  {
    id: "church-toolkit",
    title: "Church Toolkit",
    description: "Mission Sunday resources and congregation materials.",
    icon: "Church",
    href: "/content?tag=church",
    color: "#2b4d24",
    audiences: ["church"],
    accent: "stone",
  },
  {
    id: "daf-checklist",
    title: "DAF Checklist",
    description: "Plan your next recommendation with guided steps.",
    icon: "Wallet",
    href: "/giving?view=daf",
    color: "#2b4d24",
    audiences: ["daf"],
    accent: "gold",
  },
  {
    id: "ambassador-kit",
    title: "Ambassador Kit",
    description: "Shareable assets, talking points, and outreach scripts.",
    icon: "Megaphone",
    href: "/content?tag=ambassador",
    color: "#2b4d24",
    audiences: ["ambassador"],
    accent: "clay",
  },
  {
    id: "volunteer-hub",
    title: "Volunteer Hub",
    description: "Training schedule, tasks, and orientation checklists.",
    icon: "HandHeart",
    href: "/dashboard#volunteer",
    color: "#2b4d24",
    audiences: ["volunteer"],
    accent: "stone",
  },
  {
    id: "stewardship-briefing",
    title: "Stewardship Briefing",
    description: "Priority initiatives and board-ready reporting.",
    icon: "Star",
    href: "/content?tag=stewardship",
    color: "#2b4d24",
    audiences: ["major_donor"],
    accent: "gold",
  },
] as const;

// Designations available for giving
export const GIVING_DESIGNATIONS = [
  'General Operations',
  'Education Fund',
  'Clean Water Initiative',
  'Community Health',
  'Microfinance Program',
  'Leadership Development',
  'Where Most Needed',
] as const;
