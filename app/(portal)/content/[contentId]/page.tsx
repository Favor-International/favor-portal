"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  Clock,
  Bookmark,
  Share2,
  Printer,
  Calendar,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useContent } from "@/hooks/use-content";
import { canAccessContent } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/portal/empty-state";
import { SectionHeader } from "@/components/portal/section-header";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";
import { ContentItem } from "@/types";
import { useState } from "react";

function estimateReadTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function typeColor(type: ContentItem["type"]): string {
  switch (type) {
    case "report":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "update":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "resource":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "prayer":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "story":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function normalizeType(type: ContentItem["type"]): string {
  switch (type) {
    case "report":
      return "Report";
    case "update":
      return "Update";
    case "resource":
      return "Resource";
    case "prayer":
      return "Prayer";
    case "story":
      return "Story";
    default:
      return type;
  }
}

function getBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("favor_content_bookmarks") ?? "[]");
  } catch {
    return [];
  }
}

function setBookmarks(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("favor_content_bookmarks", JSON.stringify(ids));
}

function addToRecentlyViewed(contentId: string) {
  if (typeof window === "undefined") return;
  try {
    const recent: string[] = JSON.parse(
      localStorage.getItem("favor_content_recent") ?? "[]"
    );
    const next = [contentId, ...recent.filter((id) => id !== contentId)].slice(
      0,
      20
    );
    localStorage.setItem("favor_content_recent", JSON.stringify(next));
  } catch {
    // ignore
  }
}

export default function ContentDetailPage() {
  const params = useParams<{ contentId: string }>();
  const contentId = params?.contentId;
  const { user } = useAuth();
  const { items, isLoading } = useContent();
  const [isBookmarked, setIsBookmarked] = useState(false);

  const item = useMemo(
    () => items.find((entry) => entry.id === contentId),
    [items, contentId]
  );

  // Track recently viewed + activity
  useEffect(() => {
    if (!item || !user?.id) return;
    addToRecentlyViewed(item.id);
    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "content_viewed",
        metadata: { contentId: item.id, type: item.type },
      }),
    }).catch(() => undefined);
  }, [item, user?.id]);

  // Bookmark state
  useEffect(() => {
    if (!contentId) return;
    setIsBookmarked(getBookmarks().includes(contentId));
  }, [contentId]);

  const toggleBookmark = () => {
    if (!contentId) return;
    const current = getBookmarks();
    const next = current.includes(contentId)
      ? current.filter((id) => id !== contentId)
      : [...current, contentId];
    setBookmarks(next);
    setIsBookmarked(next.includes(contentId));
  };

  // Navigation: prev/next items of accessible content
  const constituentType = user?.constituentType ?? "individual";
  const accessibleItems = useMemo(
    () =>
      items
        .filter((i) => canAccessContent(i.accessLevel, constituentType))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [items, constituentType]
  );

  const currentIndex = accessibleItems.findIndex((i) => i.id === contentId);
  const prevItem = currentIndex > 0 ? accessibleItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < accessibleItems.length - 1
      ? accessibleItems[currentIndex + 1]
      : null;

  // Related content (same type or overlapping tags, excluding current)
  const relatedItems = useMemo(() => {
    if (!item) return [];
    return accessibleItems
      .filter((i) => {
        if (i.id === item.id) return false;
        const sameType = i.type === item.type;
        const sharedTags = i.tags.some((t) => item.tags.includes(t));
        return sameType || sharedTags;
      })
      .slice(0, 3);
  }, [item, accessibleItems]);

  if (isLoading) {
    return <PortalPageSkeleton />;
  }

  if (!item) {
    return (
      <EmptyState
        icon={FileText}
        title="Content not found"
        description="We couldn't locate that update in your library."
        actionLabel="Back to Content"
        actionHref="/content"
      />
    );
  }

  const readMin = estimateReadTime(item.body);

  return (
    <div className="space-y-8">
      {/* Back + Breadcrumb */}
      <div>
        <nav className="mb-3 flex items-center gap-1 text-xs text-[#999999]">
          <Link href="/dashboard" className="hover:text-[#666666]">
            Home
          </Link>
          <span>/</span>
          <Link href="/content" className="hover:text-[#666666]">
            Content
          </Link>
          <span>/</span>
          <span className="font-medium text-[#1a1a1a] line-clamp-1">
            {item.title}
          </span>
        </nav>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`text-[10px] border ${typeColor(item.type)}`}>
            {normalizeType(item.type)}
          </Badge>
          {item.tags.map((tag) => (
            <Link key={tag} href={`/content?tag=${encodeURIComponent(tag)}`}>
              <Badge
                variant="secondary"
                className="text-[10px] hover:bg-[#2b4d24]/10 transition-colors cursor-pointer"
              >
                {tag}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Title */}
        <h1 className="mt-3 font-serif text-3xl font-semibold text-[#1a1a1a]">
          {item.title}
        </h1>

        {/* Author + date + read time + actions */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 text-sm text-[#666666]">
            <span className="flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-[#999999]" />
              {item.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#999999]" />
              {new Date(item.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#999999]" />
              {readMin} min read
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleBookmark}
              className={
                isBookmarked
                  ? "text-[#2b4d24] border-[#2b4d24]/30"
                  : ""
              }
            >
              <Bookmark
                className={`mr-1.5 h-3.5 w-3.5 ${isBookmarked ? "fill-[#2b4d24]" : ""}`}
              />
              {isBookmarked ? "Saved" : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Main content card */}
      <Card className="glass-pane overflow-hidden">
        {/* Cover image */}
        {item.coverImage && (
          <div className="relative aspect-[16/7] bg-linear-to-br from-[#FAF9F6] to-[#F5F3EF]">
            <Image
              src={item.coverImage}
              alt={item.title}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          </div>
        )}

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Excerpt / lead */}
          <p className="text-base text-[#333333] font-medium leading-relaxed border-l-4 border-[#2b4d24]/20 pl-4">
            {item.excerpt}
          </p>

          {/* Body */}
          <div className="space-y-4 text-sm text-[#4b4b4b] leading-relaxed">
            {item.body.split("\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          {/* Download attachment */}
          {item.fileUrl && (
            <div className="mt-6 rounded-lg border border-[#e5e5e0] bg-[#FAF9F6] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2b4d24]/5">
                  <Download className="h-5 w-5 text-[#2b4d24]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1a1a1a]">
                    Attached File
                  </p>
                  <p className="text-xs text-[#999999]">
                    {item.fileUrl.split("/").pop()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(item.fileUrl, "_blank")}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prev / Next navigation */}
      {(prevItem || nextItem) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {prevItem ? (
            <Link href={`/content/${prevItem.id}`}>
              <Card className="glass-hover h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <ArrowLeft className="h-4 w-4 text-[#999999] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#999999] uppercase tracking-wider">
                      Previous
                    </p>
                    <p className="text-sm font-medium text-[#1a1a1a] line-clamp-1">
                      {prevItem.title}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <div />
          )}
          {nextItem ? (
            <Link href={`/content/${nextItem.id}`}>
              <Card className="glass-hover h-full">
                <CardContent className="p-4 flex items-center justify-end gap-3">
                  <div className="min-w-0 text-right">
                    <p className="text-[10px] text-[#999999] uppercase tracking-wider">
                      Next
                    </p>
                    <p className="text-sm font-medium text-[#1a1a1a] line-clamp-1">
                      {nextItem.title}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#999999] flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}

      {/* Related Content */}
      {relatedItems.length > 0 && (
        <section>
          <SectionHeader
            title="Related Content"
            subtitle="More from your library"
            href="/content"
            linkText="View All"
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {relatedItems.map((related) => (
              <Link key={related.id} href={`/content/${related.id}`}>
                <Card className="glass-hover h-full">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`text-[10px] border ${typeColor(related.type)}`}
                      >
                        {normalizeType(related.type)}
                      </Badge>
                      <span className="text-xs text-[#999999]">
                        {new Date(related.date).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-serif text-base font-medium text-[#1a1a1a] line-clamp-2">
                      {related.title}
                    </h3>
                    <p className="text-sm text-[#666666] line-clamp-2">
                      {related.excerpt}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
