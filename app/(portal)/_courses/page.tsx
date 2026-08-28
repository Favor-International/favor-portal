"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCourses } from "@/hooks/use-courses";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseCard } from "@/components/courses/course-card";
import { GraduationCap, Search, BookOpen, Trophy, PlayCircle, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/portal/section-header";
import { EmptyState } from "@/components/portal/empty-state";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";
import { canAccessCourse } from "@/lib/constants";

export default function CoursesPage() {
  const { user } = useAuth();
  const { courses, modules, progress, isLoading } = useCourses(user?.id);
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return <PortalPageSkeleton />;
  }

  const publishedCourses = courses.filter((course) => course.status !== "draft");
  const accessibleCourses = publishedCourses.filter(
    (course) =>
      canAccessCourse(course.accessLevel, user?.constituentType ?? "individual") &&
      !course.isLocked
  );
  const lockedCourses = publishedCourses.filter(
    (course) =>
      !canAccessCourse(course.accessLevel, user?.constituentType ?? "individual") ||
      course.isLocked
  );

  const filteredCourses = accessibleCourses.filter(
    (course) =>
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const progressMap = new Map(progress.map((entry) => [entry.moduleId, entry]));

  const courseProgressSummary = (courseId: string) => {
    const courseModules = modules
      .filter((module) => module.courseId === courseId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const totalCount = courseModules.length;
    const totalDurationSeconds = courseModules.reduce(
      (sum, module) => sum + (module.durationSeconds || 0),
      0
    );
    const completedCount = courseModules.filter(
      (module) => progressMap.get(module.id)?.completed
    ).length;
    return { courseModules, totalCount, completedCount, totalDurationSeconds };
  };

  const completedCourses = accessibleCourses.filter((course) => {
    const { totalCount, completedCount } = courseProgressSummary(course.id);
    return totalCount > 0 && completedCount === totalCount;
  }).length;

  const inProgressCourses = accessibleCourses.filter((course) => {
    const { totalCount, completedCount } = courseProgressSummary(course.id);
    return totalCount > 0 && completedCount > 0 && completedCount < totalCount;
  }).length;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-2 flex items-center gap-1 text-xs text-[#999999]">
            <Link href="/dashboard" className="hover:text-[#666666]">Home</Link>
            <span>/</span>
            <span className="font-medium text-[#1a1a1a]">Courses</span>
          </nav>
          <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">Course Catalog</h1>
          <p className="mt-1 text-sm text-[#666666]">
            Deepen your understanding of Favor&apos;s mission and impact through our partner courses.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
          <Input
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Courses", value: accessibleCourses.length, icon: BookOpen, sub: "Available to you" },
          { label: "Completed", value: completedCourses, icon: Trophy, sub: "Courses finished" },
          { label: "In Progress", value: inProgressCourses, icon: PlayCircle, sub: "Active courses" },
          {
            label: "Completion",
            value: accessibleCourses.length > 0 ? `${Math.round((completedCourses / accessibleCourses.length) * 100)}%` : "0%",
            icon: BarChart3,
            sub: "Overall rate",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2b4d24]/5">
                <stat.icon className="h-5 w-5 text-[#2b4d24]" />
              </div>
              <div>
                <p className="text-xs text-[#999999]">{stat.label}</p>
                <p className="text-xl font-semibold text-[#1a1a1a]">{stat.value}</p>
                <p className="text-[10px] text-[#999999]">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Course grid */}
      <section>
        <SectionHeader
          title="All Courses"
          subtitle={`${filteredCourses.length} available`}
        />
        <div className="mt-5">
          {filteredCourses.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((course) => {
                const { completedCount, totalCount, totalDurationSeconds } = courseProgressSummary(course.id);
                return (
                  <CourseCard
                    key={course.id}
                    course={course}
                    progress={completedCount}
                    totalModules={totalCount}
                    totalDurationSeconds={totalDurationSeconds}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={GraduationCap}
              title={searchQuery ? "No courses match your search" : "No courses available yet"}
              description={
                searchQuery
                  ? "Try a different search term to find what you're looking for."
                  : "Check back soon for new partner learning content."
              }
            />
          )}
        </div>
      </section>

      {lockedCourses.length > 0 && (
        <section>
          <SectionHeader title="Locked Courses" subtitle="Available with additional access" />
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lockedCourses.map((course) => (
              <Card key={course.id} className="glass-subtle border-0">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] text-[#8b957b]">
                      {course.accessLevel.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-[#999999]">
                      {course.isPaid ? `Paid - $${course.price ?? 0}` : "Locked"}
                    </span>
                  </div>
                  <h3 className="font-serif text-lg text-[#1a1a1a]">{course.title}</h3>
                  <p className="text-sm text-[#999999] line-clamp-2">{course.description}</p>
                  <Button variant="outline" size="sm" className="w-full">
                    Request Access
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
