"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useGiving } from "@/hooks/use-giving";
import { useCourses } from "@/hooks/use-courses";
import { useContent } from "@/hooks/use-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Heart, GraduationCap, ArrowRight, Sparkles, BookOpen, Clock,
  Phone, Mail, Award, ChevronRight,
} from "lucide-react";
import { GiveNowDialog } from "@/components/portal/give-now-dialog";
import { DashboardSkeleton } from "@/components/portal/dashboard/dashboard-skeleton";
import { canAccessCourse, canAccessContent, getGivingTier } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { ConstituentType } from "@/types";

export default function DashboardPage() {
  const { user, isLoading: isUserLoading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { totalGiven, ytdGiven, gifts, isLoading: isGivingLoading } = useGiving(user?.id, refreshKey);
  const { courses, modules, progress, isLoading: isCoursesLoading } = useCourses(user?.id);
  const { items: contentItems, isLoading: isContentLoading } = useContent();

  const isLoading = isUserLoading || isGivingLoading || isCoursesLoading || isContentLoading;

  const userType = (user?.constituentType ?? "individual") as ConstituentType;
  const lifetime = Math.max(user?.lifetimeGivingTotal ?? 0, totalGiven);
  const tier = getGivingTier(lifetime);

  // ── Monthly giving (last 6 months) for the impact chart ──
  const now = new Date();
  const monthBuckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: d.toLocaleString("en-US", { month: "short" }), year: d.getFullYear(), month: d.getMonth(), total: 0 };
  });
  for (const g of gifts) {
    const gd = new Date(g.date);
    const b = monthBuckets.find((m) => m.month === gd.getMonth() && m.year === gd.getFullYear());
    if (b) b.total += g.amount;
  }
  const maxMonth = Math.max(...monthBuckets.map((m) => m.total), 1);

  // ── Continue learning ──
  const accessibleCourses = courses.filter(
    (c) => canAccessCourse(c.accessLevel, userType) && c.status !== "draft" && !c.isLocked
  );
  const accessibleCourseIds = new Set(accessibleCourses.map((c) => c.id));
  const accessibleModules = modules.filter((m) => accessibleCourseIds.has(m.courseId));
  const courseStats = accessibleCourses.map((course) => {
    const cm = accessibleModules.filter((m) => m.courseId === course.id);
    const done = progress.filter((p) => p.completed && cm.some((m) => m.id === p.moduleId)).length;
    return { course, done, total: cm.length, pct: cm.length ? Math.round((done / cm.length) * 100) : 0 };
  });
  const completedCount = courseStats.filter((c) => c.total > 0 && c.done === c.total).length;
  const continueCourse =
    courseStats.filter((c) => c.done > 0 && c.done < c.total).sort((a, b) => b.pct - a.pct)[0] ??
    courseStats.find((c) => c.done === 0) ?? courseStats[0];

  // ── Latest story ──
  const story = contentItems.filter((i) => canAccessContent(i.accessLevel, userType))[0];

  if (isLoading) return <DashboardSkeleton />;

  const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a36d4c]";

  return (
    <div className="space-y-6">
      {/* Welcome row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-block rounded-full bg-[#e1a730] px-3 py-1 text-[11px] font-bold tracking-wide text-[#1a1a1a]">
            {tier.name}
          </span>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a1a1a]">
            Welcome back, {user?.firstName}
          </h1>
          <p className="mt-1 text-sm text-[#6f7766]">Here&apos;s the difference your partnership is making.</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" asChild>
            <Link href="/giving/impact"><Sparkles className="mr-2 h-4 w-4" />Your impact</Link>
          </Button>
          <GiveNowDialog
            onGiftComplete={() => setRefreshKey((k) => k + 1)}
            trigger={<Button><Heart className="mr-2 h-4 w-4" />Give now</Button>}
          />
        </div>
      </div>

      {/* Bento */}
      <div className="grid auto-rows-[minmax(0,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Impact hero */}
        <Card className="border-0 sm:col-span-2 lg:col-span-2 lg:row-span-2">
          <CardContent
            className="flex h-full flex-col justify-between rounded-xl p-6 text-white"
            style={{ background: "linear-gradient(150deg,#2b4d24 0%,#1f3a1a 100%)" }}
          >
            <div>
              <div className="flex items-center gap-2 text-[#e1a730]">
                <Sparkles className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Your lifetime impact</span>
              </div>
              <p className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{formatCurrency(lifetime)}</p>
              <p className="mt-2 max-w-sm text-sm text-white/75">
                Sustaining indigenous leaders and bringing the gospel where others will not go.
              </p>
              <div className="mt-6 flex items-end gap-2.5" style={{ height: 110 }}>
                {monthBuckets.map((m, i) => {
                  const h = Math.max(6, Math.round((m.total / maxMonth) * 100));
                  const isLast = i === monthBuckets.length - 1;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5" style={{ height: "100%" }}>
                      <div
                        className="w-full rounded-t-md"
                        style={{ height: `${h}%`, background: isLast ? "#e1a730" : "rgba(255,255,255,0.22)" }}
                        title={formatCurrency(m.total)}
                      />
                      <span className="text-[10px] text-white/55">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {[
                { v: formatCurrency(ytdGiven), l: "This year" },
                { v: String(gifts.length), l: "Gifts" },
                { v: tier.name.replace(" Partner", ""), l: "Tier" },
              ].map((c) => (
                <div key={c.l} className="rounded-xl bg-white/10 px-3 py-2.5">
                  <p className="text-lg font-bold">{c.v}</p>
                  <p className="text-[11px] text-white/65">{c.l}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Continue learning */}
        <Card className="overflow-hidden p-0 sm:col-span-2 lg:col-span-2">
          {continueCourse ? (
            <Link href={`/courses/${continueCourse.course.id}`} className="group flex h-full flex-col sm:flex-row">
              <div className="relative h-32 w-full shrink-0 sm:h-auto sm:w-44">
                {continueCourse.course.thumbnailUrl ? (
                  <Image src={continueCourse.course.thumbnailUrl} alt="" fill sizes="200px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[#2b4d24]/10"><BookOpen className="h-8 w-8 text-[#c5ccc2]" /></div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-center p-5">
                <span className={eyebrow}>Continue learning</span>
                <p className="mt-1.5 text-lg font-bold tracking-tight text-[#1a1a1a] group-hover:text-[#2b4d24]">
                  {continueCourse.course.title}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#faf7f1]">
                  <div className="h-full rounded-full bg-[#2b4d24]" style={{ width: `${continueCourse.pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-[#8b957b]">{continueCourse.done} of {continueCourse.total} modules · {continueCourse.pct}% complete</p>
              </div>
            </Link>
          ) : (
            <CardContent className="flex h-full flex-col justify-center p-6">
              <span className={eyebrow}>Learning</span>
              <p className="mt-1.5 text-lg font-bold tracking-tight text-[#1a1a1a]">Start your first course</p>
              <Button variant="outline" size="sm" className="mt-3 w-fit" asChild><Link href="/courses">Browse courses</Link></Button>
            </CardContent>
          )}
        </Card>

        {/* RDD contact */}
        <Card>
          <CardContent className="flex h-full flex-col p-5">
            <span className={eyebrow}>Your contact</span>
            {user?.rddAssignment ? (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2b4d24] font-semibold text-[#FFFEF9]">
                    {user.rddAssignment.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-[#1a1a1a]">{user.rddAssignment}</p>
                    <p className="text-xs text-[#8b957b]">Regional Director</p>
                  </div>
                </div>
                <div className="mt-auto flex gap-2 pt-4">
                  <Button variant="outline" size="sm" className="flex-1" asChild><a href="mailto:partners@favorintl.org"><Mail className="mr-1 h-3.5 w-3.5" />Email</a></Button>
                  <Button variant="outline" size="sm" className="flex-1" asChild><a href="tel:+18005550100"><Phone className="mr-1 h-3.5 w-3.5" />Call</a></Button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-[#6f7766]">A partner contact will be assigned to you soon.</p>
            )}
          </CardContent>
        </Card>

        {/* Learning stat */}
        <Card>
          <CardContent className="flex h-full flex-col p-5">
            <span className={eyebrow}>Learning</span>
            <div className="mt-auto">
              <p className="text-3xl font-extrabold tracking-tight text-[#2b4d24]">{completedCount}/{accessibleCourses.length}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#8b957b]">
                <Award className="h-3.5 w-3.5 text-[#e1a730]" />
                {completedCount} {completedCount === 1 ? "certificate" : "certificates"} earned
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Latest story */}
        {story && (
          <Link href={`/content/${story.id}`} className="group sm:col-span-2 lg:col-span-2">
            <Card className="relative h-full min-h-[200px] overflow-hidden border-0 p-0">
              {story.coverImage ? (
                <Image src={story.coverImage} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 bg-[#2b4d24]" />
              )}
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(31,58,26,0) 30%,rgba(31,58,26,0.92) 100%)" }} />
              <div className="relative flex h-full flex-col justify-end p-5 text-white">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e1a730]">Latest from the field</span>
                <h3 className="mt-1 text-xl font-bold tracking-tight">{story.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-white/85">{story.excerpt}</p>
              </div>
            </Card>
          </Link>
        )}

        {/* Recent giving */}
        <Card className="sm:col-span-2 lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className={eyebrow}>Recent giving</span>
              <Link href="/giving/history" className="flex items-center text-xs font-medium text-[#2b4d24] hover:underline">
                All history <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {gifts.length > 0 ? (
              <div className="mt-2 divide-y divide-[#e5e0d6]">
                {gifts.slice(0, 3).map((gift) => (
                  <div key={gift.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2b4d24]/8"><Heart className="h-4 w-4 text-[#2b4d24]" /></div>
                      <div>
                        <p className="text-sm font-medium text-[#1a1a1a]">{formatCurrency(gift.amount)} · {gift.designation}</p>
                        <p className="text-xs text-[#8b957b]">{new Date(gift.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${gift.isRecurring ? "text-[#2b4d24]" : "text-[#a36d4c]"}`}>
                      {gift.isRecurring ? "Recurring" : "One-time"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#6f7766]">Your gifts will appear here. <Link href="#" className="text-[#2b4d24] underline">Make your first gift</Link>.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { href: "/courses", icon: GraduationCap, title: "Courses", desc: "Grow in the vision" },
          { href: "/content", icon: BookOpen, title: "Stories & reports", desc: "From the field" },
          { href: "/giving", icon: Clock, title: "Manage giving", desc: "Gifts & recurring" },
        ].map((q) => (
          <Link key={q.href} href={q.href} className="group">
            <Card className="glass-transition glass-hover">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2b4d24]/8 text-[#2b4d24]"><q.icon className="h-5 w-5" /></span>
                <div className="flex-1">
                  <p className="font-semibold text-[#1a1a1a]">{q.title}</p>
                  <p className="text-xs text-[#8b957b]">{q.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#2b4d24] transition group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
