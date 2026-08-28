"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { useContent } from "@/hooks/use-content";
import { ContentItem } from "@/types";
import { canAccessContent } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/portal/empty-state";
import { SectionHeader } from "@/components/portal/section-header";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";
import {
  FileText,
  Search,
  Lock,
  ArrowRight,
  BookOpen,
  Clock,
  Star,
  LayoutGrid,
  List,
  Bookmark,
  Eye,
} from "lucide-react";

const FILTERS = ["All", "Reports", "Updates", "Resources", "Prayer", "Stories"] as const;
type FilterType = (typeof FILTERS)[number];

const SORT_OPTIONS = [
  { label: "Newest First", value: "date-desc" },
  { label: "Oldest First", value: "date-asc" },
  { label: "Title A-Z", value: "title-asc" },
  { label: "Title Z-A", value: "title-desc" },
] as const;
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

function normalizeType(item: ContentItem): FilterType {
  switch (item.type) {
    case "report":
      return "Reports";
    case "update":
      return "Updates";
    case "resource":
      return "Resources";
    case "prayer":
      return "Prayer";
    case "story":
      return "Stories";
    default:
      return "All";
  }
}

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

function getRecentlyViewed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("favor_content_recent") ?? "[]");
  } catch {
    return [];
  }
}

export default function ContentPage() {
  return (
    <Suspense fallback={<PortalPageSkeleton />}>
      <ContentPageContent />
    </Suspense>
  );
}

function ContentPageContent() {
  const { user } = useAuth();
  const { items, isLoading } = useContent();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("All");
  const [sort, setSort] = useState<SortOption>("date-desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarksState] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const tagFilter = (searchParams.get("tag") ?? "").toLowerCase();
  const typeParam = (searchParams.get("type") ?? "").toLowerCase();

  useEffect(() => {
    setBookmarksState(getBookmarks());
    setRecentIds(getRecentlyViewed());
  }, []);

  useEffect(() => {
    if (!typeParam) return;
    const mapped =
      typeParam === "report"
        ? "Reports"
        : typeParam === "update"
          ? "Updates"
          : typeParam === "resource"
            ? "Resources"
            : typeParam === "prayer"
              ? "Prayer"
              : typeParam === "story"
                ? "Stories"
                : "All";
    setFilter(mapped);
  }, [typeParam]);

  const toggleBookmark = (id: string) => {
    const next = bookmarks.includes(id)
      ? bookmarks.filter((b) => b !== id)
      : [...bookmarks, id];
    setBookmarksState(next);
    setBookmarks(next);
  };

  const constituentType = user?.constituentType ?? "individual";

  const allAccessible = useMemo(
    () => items.filter((item) => canAccessContent(item.accessLevel, constituentType)),
    [items, constituentType]
  );

  const allLocked = useMemo(
    () => items.filter((item) => !canAccessContent(item.accessLevel, constituentType)),
    [items, constituentType]
  );

  const filtered = useMemo(() => {
    const list = showBookmarks
      ? allAccessible.filter((item) => bookmarks.includes(item.id))
      : allAccessible;

    return list.filter((item) => {
      const matchFilter = filter === "All" || normalizeType(item) === filter;
      const query = search.toLowerCase();
      const matchSearch =
        item.title.toLowerCase().includes(query) ||
        item.excerpt.toLowerCase().includes(query) ||
        item.tags.join(" ").toLowerCase().includes(query);
      const matchTag =
        !tagFilter || item.tags.some((tag) => tag.toLowerCase() === tagFilter);
      return matchFilter && matchSearch && matchTag;
    });
  }, [allAccessible, filter, search, tagFilter, showBookmarks, bookmarks]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "date-desc":
        return list.sort((a, b) => b.date.localeCompare(a.date));
      case "date-asc":
        return list.sort((a, b) => a.date.localeCompare(b.date));
      case "title-asc":
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case "title-desc":
        return list.sort((a, b) => b.title.localeCompare(a.title));
      default:
        return list;
    }
  }, [filtered, sort]);

  const recentlyViewed = useMemo(() => {
    if (recentIds.length === 0) return [];
    return recentIds
      .map((id) => allAccessible.find((item) => item.id === id))
      .filter(Boolean)
      .slice(0, 4) as ContentItem[];
  }, [recentIds, allAccessible]);

  const featured = useMemo(() => {
    return allAccessible.filter((item) => item.coverImage).slice(0, 3);
  }, [allAccessible]);

  // Stats
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allAccessible.forEach((item) => {
      const t = normalizeType(item);
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [allAccessible]);

  if (isLoading) {
    return <PortalPageSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-2 flex items-center gap-1 text-xs text-[#999999]">
            <Link href="/dashboard" className="hover:text-[#666666]">
              Home
            </Link>
            <span>/</span>
            <span className="font-medium text-[#1a1a1a]">Content</span>
          </nav>
          <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">
            Content Library
          </h1>
          <p className="mt-1 text-sm text-[#666666]">
            Reports, resources, and updates tailored to your partnership.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
          <Input
            placeholder="Search content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          {
            label: "Total Items",
            value: allAccessible.length,
            icon: BookOpen,
            sub: "Available to you",
          },
          {
            label: "Reports",
            value: typeCounts["Reports"] || 0,
            icon: FileText,
            sub: "Impact & financial",
          },
          {
            label: "Resources",
            value: typeCounts["Resources"] || 0,
            icon: Star,
            sub: "Toolkits & guides",
          },
          {
            label: "Bookmarked",
            value: bookmarks.filter((id) =>
              allAccessible.some((item) => item.id === id)
            ).length,
            icon: Bookmark,
            sub: "Saved for later",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2b4d24]/5">
                <stat.icon className="h-5 w-5 text-[#2b4d24]" />
              </div>
              <div>
                <p className="text-xs text-[#999999]">{stat.label}</p>
                <p className="text-xl font-semibold text-[#1a1a1a]">
                  {stat.value}
                </p>
                <p className="text-[10px] text-[#999999]">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Featured Content */}
      {featured.length > 0 && !search && filter === "All" && !showBookmarks && (
        <section>
          <SectionHeader title="Featured" subtitle="Highlights from your library" />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {featured.map((item) => (
              <Link key={item.id} href={`/content/${item.id}`} className="group">
                <Card className="glass-hover overflow-hidden">
                  <div className="relative aspect-[16/9] bg-linear-to-br from-[#FAF9F6] to-[#F5F3EF]">
                    {item.coverImage && (
                      <Image
                        src={item.coverImage}
                        alt={item.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <Badge
                        className={`text-[10px] border ${typeColor(item.type)}`}
                      >
                        {normalizeType(item)}
                      </Badge>
                      <h3 className="mt-1.5 font-serif text-lg font-semibold text-white line-clamp-2">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recently Viewed */}
      {recentlyViewed.length > 0 &&
        !search &&
        filter === "All" &&
        !showBookmarks && (
          <section>
            <SectionHeader title="Recently Viewed" subtitle="Pick up where you left off" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentlyViewed.map((item) => (
                <Link key={item.id} href={`/content/${item.id}`}>
                  <Card className="glass-hover">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Eye className="h-3 w-3 text-[#999999]" />
                        <Badge
                          className={`text-[10px] border ${typeColor(item.type)}`}
                        >
                          {normalizeType(item)}
                        </Badge>
                      </div>
                      <h4 className="font-serif text-sm font-medium text-[#1a1a1a] line-clamp-2">
                        {item.title}
                      </h4>
                      <p className="text-xs text-[#999999]">
                        {new Date(item.date).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

      {/* Filter bar + controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((label) => (
            <Button
              key={label}
              variant={filter === label && !showBookmarks ? "default" : "outline"}
              size="sm"
              className={
                filter === label && !showBookmarks
                  ? "bg-[#2b4d24] hover:bg-[#1a3a15]"
                  : ""
              }
              onClick={() => {
                setFilter(label);
                setShowBookmarks(false);
              }}
            >
              {label}
            </Button>
          ))}
          <Button
            variant={showBookmarks ? "default" : "outline"}
            size="sm"
            className={showBookmarks ? "bg-[#2b4d24] hover:bg-[#1a3a15]" : ""}
            onClick={() => setShowBookmarks(!showBookmarks)}
          >
            <Bookmark className="mr-1 h-3.5 w-3.5" />
            Saved
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs text-[#666666] outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex rounded-md border border-input">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex h-9 w-9 items-center justify-center rounded-l-md transition-colors ${
                viewMode === "grid"
                  ? "bg-[#2b4d24] text-white"
                  : "text-[#999999] hover:text-[#666666]"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex h-9 w-9 items-center justify-center rounded-r-md transition-colors ${
                viewMode === "list"
                  ? "bg-[#2b4d24] text-white"
                  : "text-[#999999] hover:text-[#666666]"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {tagFilter && (
        <p className="text-xs text-[#999999]">
          Filtered by tag:{" "}
          <span className="text-[#666666]">{tagFilter}</span>
        </p>
      )}

      {/* Main content grid */}
      <section>
        <SectionHeader
          title={showBookmarks ? "Saved Content" : "Available to You"}
          subtitle={`${sorted.length} items`}
        />
        <div className="mt-5">
          {sorted.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sorted.map((item) => (
                  <ContentGridCard
                    key={item.id}
                    item={item}
                    isBookmarked={bookmarks.includes(item.id)}
                    onToggleBookmark={toggleBookmark}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {sorted.map((item) => (
                  <ContentListCard
                    key={item.id}
                    item={item}
                    isBookmarked={bookmarks.includes(item.id)}
                    onToggleBookmark={toggleBookmark}
                  />
                ))}
              </div>
            )
          ) : (
            <EmptyState
              icon={showBookmarks ? Bookmark : FileText}
              title={
                showBookmarks
                  ? "No saved content"
                  : search
                    ? "No content matches your search"
                    : "No content found"
              }
              description={
                showBookmarks
                  ? "Bookmark content items to save them for quick access."
                  : "Try adjusting your filters or search terms."
              }
            />
          )}
        </div>
      </section>

      {/* Locked content */}
      {allLocked.length > 0 && !showBookmarks && (
        <section>
          <SectionHeader
            title="Locked Content"
            subtitle="Available with additional access"
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allLocked.map((item) => (
              <Card key={item.id} className="glass-subtle border-0 opacity-80">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge
                      className={`text-[10px] border ${typeColor(item.type)}`}
                    >
                      {normalizeType(item)}
                    </Badge>
                    <Lock className="h-3.5 w-3.5 text-[#c5ccc2]" />
                  </div>
                  <h3 className="font-serif text-lg text-[#1a1a1a]">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#999999] line-clamp-2">
                    {item.excerpt}
                  </p>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link
                      href={`/support?topic=content-access&contentTitle=${encodeURIComponent(
                        item.title
                      )}`}
                    >
                      Request Access
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Grid Card ─────────────────────────────────────────────── */

function ContentGridCard({
  item,
  isBookmarked,
  onToggleBookmark,
}: {
  item: ContentItem;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
}) {
  const readMin = estimateReadTime(item.body);

  return (
    <Card className="glass-hover overflow-hidden group">
      {item.coverImage && (
        <div className="relative aspect-[2/1] bg-linear-to-br from-[#FAF9F6] to-[#F5F3EF]">
          <Image
            src={item.coverImage}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Badge className={`text-[10px] border ${typeColor(item.type)}`}>
            {normalizeType(item)}
          </Badge>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-[#999999]">
              <Clock className="h-3 w-3" />
              {readMin} min
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                onToggleBookmark(item.id);
              }}
              className="text-[#999999] hover:text-[#2b4d24] transition-colors"
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${isBookmarked ? "fill-[#2b4d24] text-[#2b4d24]" : ""}`}
              />
            </button>
          </div>
        </div>
        <h3 className="font-serif text-lg text-[#1a1a1a] line-clamp-2">
          {item.title}
        </h3>
        <p className="text-sm text-[#666666] line-clamp-2">{item.excerpt}</p>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs text-[#999999]">
            <span>{item.author}</span>
            <span>&middot;</span>
            <span>{new Date(item.date).toLocaleDateString()}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#2b4d24]"
            asChild
          >
            <Link href={`/content/${item.id}`}>
              View <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.tags.slice(0, 3).map((tag) => (
              <Link
                key={tag}
                href={`/content?tag=${encodeURIComponent(tag)}`}
                className="inline-block"
              >
                <Badge
                  variant="secondary"
                  className="text-[10px] hover:bg-[#2b4d24]/10 transition-colors cursor-pointer"
                >
                  {tag}
                </Badge>
              </Link>
            ))}
            {item.tags.length > 3 && (
              <Badge variant="secondary" className="text-[10px]">
                +{item.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── List Card ─────────────────────────────────────────────── */

function ContentListCard({
  item,
  isBookmarked,
  onToggleBookmark,
}: {
  item: ContentItem;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
}) {
  const readMin = estimateReadTime(item.body);

  return (
    <Card className="glass-hover">
      <CardContent className="p-4 flex gap-4">
        {item.coverImage ? (
          <div className="hidden sm:block w-28 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-linear-to-br from-[#FAF9F6] to-[#F5F3EF]">
            <Image
              src={item.coverImage}
              alt={item.title}
              width={112}
              height={80}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="hidden sm:flex w-28 h-20 rounded-lg flex-shrink-0 bg-linear-to-br from-[#FAF9F6] to-[#F5F3EF] items-center justify-center">
            <FileText className="h-6 w-6 text-[#c5ccc2]" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className={`text-[10px] border ${typeColor(item.type)}`}>
              {normalizeType(item)}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-[#999999]">
              <Clock className="h-3 w-3" />
              {readMin} min
            </span>
            <span className="text-xs text-[#999999]">
              {new Date(item.date).toLocaleDateString()}
            </span>
          </div>
          <h3 className="font-serif text-base font-medium text-[#1a1a1a] line-clamp-1">
            <Link
              href={`/content/${item.id}`}
              className="hover:text-[#2b4d24] transition-colors"
            >
              {item.title}
            </Link>
          </h3>
          <p className="text-sm text-[#666666] line-clamp-1">{item.excerpt}</p>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 4).map((tag) => (
              <Link
                key={tag}
                href={`/content?tag=${encodeURIComponent(tag)}`}
              >
                <Badge
                  variant="secondary"
                  className="text-[10px] hover:bg-[#2b4d24]/10 transition-colors cursor-pointer"
                >
                  {tag}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end justify-between flex-shrink-0">
          <button
            onClick={() => onToggleBookmark(item.id)}
            className="text-[#999999] hover:text-[#2b4d24] transition-colors"
          >
            <Bookmark
              className={`h-4 w-4 ${isBookmarked ? "fill-[#2b4d24] text-[#2b4d24]" : ""}`}
            />
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#2b4d24]"
            asChild
          >
            <Link href={`/content/${item.id}`}>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
