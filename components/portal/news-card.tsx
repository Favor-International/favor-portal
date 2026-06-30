"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen, Heart, Calendar, Megaphone } from "lucide-react";
import type { NewsItem } from "@/lib/portal-mock-data";

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  'Impact Story': { bg: 'bg-[#2b4d24]/10', text: 'text-[#2b4d24]' },
  Update: { bg: 'bg-[#e1a730]/10', text: 'text-[#a36d4c]' },
  Event: { bg: 'bg-[#8b957b]/15', text: 'text-[#2b4d24]' },
  Resource: { bg: 'bg-white/60', text: 'text-[#6f7766]' },
  Prayer: { bg: 'bg-[#e1a730]/5', text: 'text-[#a36d4c]' },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Impact Story': Heart,
  Update: Megaphone,
  Event: Calendar,
  Resource: BookOpen,
  Prayer: Heart,
};

interface NewsCardProps {
  item: NewsItem;
  variant?: 'default' | 'compact';
  className?: string;
}

export function NewsCard({ item, variant = 'default', className }: NewsCardProps) {
  const style = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.Resource;
  const CatIcon = CATEGORY_ICONS[item.category] ?? BookOpen;

  if (variant === 'compact') {
    const article = (
      <article
        className={cn(
          "flex gap-4 rounded-xl glass-pane p-4 glass-transition glass-hover",
          className
        )}
      >
        {/* Placeholder thumbnail */}
        <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-[#2b4d24]/10 to-[#8b957b]/10">
          <CatIcon className="h-6 w-6 text-[#2b4d24]/40" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn("text-[10px] font-medium", style.bg, style.text)}>
              {item.category}
            </Badge>
            <span className="text-xs text-[#999999]">
              {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <h4 className="mt-1 text-sm font-medium text-[#1a1a1a] line-clamp-1">
            {item.title}
          </h4>
          <p className="mt-0.5 text-xs text-[#666666] line-clamp-1">{item.excerpt}</p>
        </div>
      </article>
    );

    if (!item.href) return article;
    return (
      <Link href={item.href} className="block">
        {article}
      </Link>
    );
  }

  const article = (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl glass-pane glass-transition glass-hover",
        className
      )}
    >
      {/* Placeholder image area */}
      <div className="relative aspect-[16/9] bg-linear-to-br from-[#FAF9F6] to-[#F5F3EF]">
        <div className="flex h-full items-center justify-center">
          <CatIcon className="h-10 w-10 text-[#c5ccc2]" />
        </div>
        <Badge
          className={cn("absolute left-3 top-3 text-[10px] font-medium", style.bg, style.text)}
        >
          {item.category}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-lg font-semibold leading-snug text-[#1a1a1a] line-clamp-2">
          {item.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-[#666666] line-clamp-3">
          {item.excerpt}
        </p>
        <div className="mt-4 flex items-center gap-3 text-xs text-[#999999]">
          <span>
            {new Date(item.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {item.readTime}
          </span>
        </div>
      </div>
    </article>
  );

  if (!item.href) return article;
  return (
    <Link href={item.href} className="block">
      {article}
    </Link>
  );
}
