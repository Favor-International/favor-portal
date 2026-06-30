"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGiving } from "@/hooks/use-giving";
import { useCourses } from "@/hooks/use-courses";
import { useContent } from "@/hooks/use-content";
import { useGrants } from "@/hooks/use-grants";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Heart,
  GraduationCap,
  ArrowRight,
  Calendar,
  BookOpen,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { SectionHeader } from "@/components/portal/section-header";
import { ModuleTile } from "@/components/portal/module-tile";
import { NewsCarousel } from "@/components/portal/news-carousel";
import { EmptyState } from "@/components/portal/empty-state";
import { GiveNowDialog } from "@/components/portal/give-now-dialog";
import { DashboardSkeleton } from "@/components/portal/dashboard/dashboard-skeleton";
import { NEWS_FEED, MODULE_TILES } from "@/lib/portal-mock-data";
import { canAccessCourse, canAccessContent, getGivingTier } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { buildRoleExperience } from "@/lib/dashboard/role-experience";
import {
  applyRoleExperienceOverride,
  sanitizeDashboardRoleOverrides,
  type DashboardRoleExperienceOverride,
} from "@/lib/dashboard/experience-overrides";
import type { ConstituentType } from "@/types";

export default function DashboardPage() {
  const { user, isLoading: isUserLoading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [experienceOverrides, setExperienceOverrides] = useState<DashboardRoleExperienceOverride[]>(
    []
  );
  const { totalGiven, ytdGiven, gifts, isLoading: isGivingLoading } = useGiving(user?.id, refreshKey);
  const { courses, modules, progress, isLoading: isCoursesLoading } = useCourses(user?.id);
  const { items: contentItems, isLoading: isContentLoading } = useContent();
  const { grants, isLoading: isGrantsLoading } = useGrants(user?.id);

  const isLoading = isUserLoading || isGivingLoading || isCoursesLoading || isContentLoading || isGrantsLoading;

  const userType = (user?.constituentType ?? "individual") as ConstituentType;

  useEffect(() => {
    let isMounted = true;

    async function loadExperienceOverrides() {
      try {
        const response = await fetch("/api/dashboard/experience", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (!isMounted) return;
        setExperienceOverrides(sanitizeDashboardRoleOverrides(payload.overrides));
      } catch {
        if (isMounted) setExperienceOverrides([]);
      }
    }

    void loadExperienceOverrides();
    return () => {
      isMounted = false;
    };
  }, []);

  const accessibleCourses = courses.filter((course) =>
    canAccessCourse(course.accessLevel, userType) &&
    course.status !== "draft" &&
    !course.isLocked
  );
  const accessibleCourseIds = new Set(accessibleCourses.map((course) => course.id));
  const accessibleModules = modules.filter((module) => accessibleCourseIds.has(module.courseId));

  const tier = getGivingTier((user?.lifetimeGivingTotal ?? 0) + totalGiven);

  const accessibleContent = contentItems.filter((item) =>
    canAccessContent(item.accessLevel, userType)
  );
  const baseRecommended = accessibleContent.slice(0, 3);

  const baseRoleExperience = buildRoleExperience({
    userType,
    gifts,
    grants,
    tierName: tier.name,
    recommendedCourseTitle: accessibleCourses[0]?.title,
    rddAssignment: user?.rddAssignment,
  });
  const activeRoleOverride = experienceOverrides.find((entry) => entry.roleKey === userType);
  const roleExperience = applyRoleExperienceOverride(baseRoleExperience, activeRoleOverride);

  const roleHighlights = roleExperience.highlights;
  const roleActions = roleExperience.actions;
  const roleRecommended = accessibleContent.filter((item) => {
    return roleExperience.recommendedTags.some((tag) => {
      return item.tags.includes(tag) || item.type === tag;
    });
  });
  const curatedContent = (roleRecommended.length > 0 ? roleRecommended : baseRecommended).slice(0, 3);
  const moduleTiles = MODULE_TILES.filter(
    (tile) => tile.audiences === "all" || tile.audiences.includes(userType)
  );

  const getCourseProgress = (courseId: string) => {
    const courseModules = accessibleModules.filter((m) => m.courseId === courseId);
    const courseProgress = progress.filter((p) =>
      courseModules.some((m) => m.id === p.moduleId)
    );
    return { courseModules, courseProgress };
  };

  const courseProgressSnapshot = accessibleCourses.map((course) => {
    const { courseModules, courseProgress } = getCourseProgress(course.id);
    const completedCount = courseProgress.filter((p) => p.completed).length;
    return {
      courseId: course.id,
      totalCount: courseModules.length,
      completedCount,
    };
  });

  const inProgressCourseCount = courseProgressSnapshot.filter(
    (entry) => entry.completedCount > 0 && entry.completedCount < Math.max(entry.totalCount, 1)
  ).length;
  const completedCourseCount = courseProgressSnapshot.filter(
    (entry) => entry.totalCount > 0 && entry.completedCount === entry.totalCount
  ).length;

  const inProgressCourses = accessibleCourses
    .map((course) => {
      const { courseModules, courseProgress } = getCourseProgress(course.id);
      const completedCount = courseProgress.filter((p) => p.completed).length;
      const totalDurationSeconds = courseModules.reduce(
        (sum, module) => sum + (module.durationSeconds || 0),
        0
      );
      return {
        course,
        completedCount,
        totalCount: courseModules.length,
        totalDurationSeconds,
      };
    })
    .filter((entry) => entry.completedCount > 0)
    .sort((a, b) => b.completedCount - a.completedCount)
    .slice(0, 3);
  const courseCards =
    inProgressCourses.length > 0
      ? inProgressCourses
      : accessibleCourses.slice(0, 3).map((course) => {
          const { courseModules, courseProgress } = getCourseProgress(course.id);
          const completedCount = courseProgress.filter((p) => p.completed).length;
          const totalDurationSeconds = courseModules.reduce(
            (sum, module) => sum + (module.durationSeconds || 0),
            0
          );
          return {
            course,
            completedCount,
            totalCount: courseModules.length,
            totalDurationSeconds,
          };
        });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* HERO WELCOME BAND */}
      <section className="glass-enter relative overflow-hidden rounded-3xl border border-white/10 px-6 py-10 sm:px-10 sm:py-12">
        {/* Brand field photography with green scrim */}
        <Image
          src="/brand/hero-congo-grads.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(120deg, rgba(31,58,26,0.94) 0%, rgba(31,58,26,0.80) 45%, rgba(31,58,26,0.55) 100%)',
          }}
        />
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#c5ccc2]">
              {tier.name}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-white sm:text-4xl">
              Welcome back, {user?.firstName}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">
              Thank you for your partnership with Favor International.
              Together we are transforming hearts and nations.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <GiveNowDialog
              onGiftComplete={() => setRefreshKey((k) => k + 1)}
              trigger={
                <Button className="bg-white text-[#2b4d24] hover:bg-white/90">
                  <Heart className="mr-2 h-4 w-4" />
                  Give Now
                </Button>
              }
            />
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              asChild
            >
              <Link href="/courses">
                <GraduationCap className="mr-2 h-4 w-4" />
                Courses
              </Link>
            </Button>
          </div>
        </div>

        {/* Stat pills */}
        <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Lifetime Giving",
              value: formatCurrency(totalGiven),
              icon: Heart,
            },
            {
              label: `${new Date().getFullYear()} Year to Date`,
              value: formatCurrency(ytdGiven),
              icon: Calendar,
            },
            {
              label: "Courses Completed",
              value: `${completedCourseCount}/${accessibleCourses.length}`,
              icon: GraduationCap,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl glass-hero px-4 py-3"
            >
              <stat.icon className="h-4 w-4 text-white/60" />
              <div>
                <p className="text-xs text-white/60">{stat.label}</p>
                <p className="text-lg font-semibold text-white">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* LATEST FROM FAVOR (Carousel) */}
      <section className="glass-enter glass-enter-delay-1">
        <SectionHeader title={roleHighlights.title} subtitle={roleHighlights.subtitle} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roleHighlights.items.map((item) => (
            <Card key={item.title} className="glass-pane">
              <CardContent className="p-5 space-y-2">
                <p className="text-xs text-[#999999]">{item.title}</p>
                <p className="text-xl font-semibold text-[#1a1a1a]">{item.value}</p>
                <p className="text-sm text-[#666666]">{item.description}</p>
                {item.actionLabel && item.actionHref && (
                  <Button variant="ghost" size="sm" className="text-[#2b4d24]" asChild>
                    <Link href={item.actionHref}>
                      {item.actionLabel} <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section
        id={roleExperience.anchorId}
        className="glass-enter glass-enter-delay-2 scroll-mt-24"
      >
        <SectionHeader
          title={roleExperience.actionsTitle}
          subtitle={roleExperience.actionsSubtitle}
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roleActions.map((item) => (
            <Card key={item.title} className="glass-pane">
              <CardContent className="p-5 space-y-3">
                <div>
                  <p className="text-xs text-[#999999]">{item.title}</p>
                  <p className="mt-2 text-sm text-[#666666]">{item.description}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-[#2b4d24]" asChild>
                  <Link href={item.actionHref}>
                    {item.actionLabel} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {curatedContent.length > 0 && (
        <section className="glass-enter glass-enter-delay-3">
          <SectionHeader
            title={roleExperience.contentTitle}
            subtitle={roleExperience.contentSubtitle}
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {curatedContent.map((item) => (
              <Link key={item.id} href={`/content/${item.id}`} className="block">
                <Card className="glass-pane glass-transition glass-hover">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] text-[#8b957b]">
                        {item.type}
                      </Badge>
                      <span className="text-xs text-[#999999]">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-serif text-lg text-[#1a1a1a]">{item.title}</h3>
                    <p className="text-sm text-[#666666] line-clamp-2">{item.excerpt}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="glass-enter glass-enter-delay-4">
        <SectionHeader title="Latest from Favor" subtitle="News, stories, and resources" />
        <div className="mt-5">
          <NewsCarousel items={NEWS_FEED} />
        </div>
      </section>

      {/* MODULES GRID */}
      <section className="glass-enter glass-enter-delay-5">
        <SectionHeader title="Your Portal" subtitle="Explore your partnership tools and resources" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moduleTiles.map((tile) => (
            <ModuleTile
              key={tile.id}
              title={tile.title}
              description={tile.description}
              icon={tile.icon}
              href={tile.href}
              accent={tile.accent}
              badge={
                tile.id === "courses" && inProgressCourseCount > 0
                  ? `${inProgressCourseCount} active`
                  : tile.id === "courses" && completedCourseCount > 0
                    ? `${completedCourseCount} done`
                    : tile.id === "giving" && gifts.length > 0
                      ? `${gifts.length} gifts`
                      : undefined
              }
            />
          ))}
        </div>
      </section>

      {/* CONTINUE WHERE YOU LEFT OFF */}
      <section className="glass-enter glass-enter-delay-6">
        <SectionHeader
          title="Continue Where You Left Off"
          subtitle="Pick up your learning progress"
          href="/courses"
        />
        <div className="mt-5">
          {courseCards.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courseCards.map(({ course, completedCount, totalCount, totalDurationSeconds }) => {
                const total = totalCount || 1;
                const pct = Math.round((completedCount / total) * 100);
                const durationMinutes = Math.max(
                  1,
                  Math.round(
                    (totalDurationSeconds > 0 ? totalDurationSeconds : total * 15 * 60) / 60
                  )
                );

                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="group block"
                  >
                    <Card className="overflow-hidden glass-pane glass-transition glass-hover border-0">
                      <div className="relative aspect-[16/9] bg-gradient-to-br from-[#2b4d24]/15 to-[#8b957b]/10">
                        {course.thumbnailUrl ? (
                          <Image
                            src={course.thumbnailUrl}
                            alt={course.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <BookOpen className="h-10 w-10 text-[#c5ccc2]" />
                          </div>
                        )}
                        <Badge className="absolute right-2 top-2 bg-[#2b4d24] text-[#FFFEF9] text-[10px]">
                          {pct}% complete
                        </Badge>
                      </div>
                      <CardContent className="p-4">
                        <h4 className="font-serif text-base font-semibold text-[#1a1a1a] line-clamp-1 group-hover:text-[#2b4d24] transition-colors">
                          {course.title}
                        </h4>
                        <div className="mt-2">
                          <Progress value={pct} className="h-1.5" />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-[#999999]">
                          <span>
                            {completedCount}/{total} modules
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />~{durationMinutes} min
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={GraduationCap}
              title="No courses started yet"
              description="Browse our partner learning library to get started with your first course."
              actionLabel="Browse Courses"
              actionHref="/courses"
            />
          )}
        </div>
      </section>

      {/* RECENT ACTIVITY */}
      <section className="glass-enter glass-enter-delay-7">
        <SectionHeader title="Recent Activity" subtitle="Your latest gifts and updates" />
        <div className="mt-5 space-y-3">
          {gifts.length > 0 ? (
            gifts.slice(0, 5).map((gift) => (
              <div
                key={gift.id}
                className="flex items-center justify-between rounded-xl glass-pane px-5 py-4 glass-transition glass-hover"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2b4d24]/5">
                    <Heart className="h-4 w-4 text-[#2b4d24]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1a1a1a]">
                      ${gift.amount.toLocaleString()} - {gift.designation}
                    </p>
                    <p className="text-xs text-[#999999]">
                      {new Date(gift.date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <Badge variant={gift.isRecurring ? "default" : "secondary"}>
                  {gift.isRecurring ? "Recurring" : "One-time"}
                </Badge>
              </div>
            ))
          ) : (
            <EmptyState
              icon={Heart}
              title="No gifts yet"
              description="When you make a gift, it will appear here."
              actionLabel="Make a Gift"
              onAction={() => {}}
            />
          )}
          {gifts.length > 5 && (
            <div className="text-center">
              <Button variant="ghost" className="text-[#2b4d24]" asChild>
                <Link href="/giving/history">
                  View all giving history
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
