"use client";

import { Course } from "@/types";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Clock, BookOpen } from "lucide-react";
import Link from "next/link";

interface CourseCardProps {
  course: Course;
  progress: number;
  totalModules: number;
  totalDurationSeconds?: number;
}

export function CourseCard({
  course,
  progress,
  totalModules,
  totalDurationSeconds,
}: CourseCardProps) {
  const progressPercentage = totalModules > 0 ? (progress / totalModules) * 100 : 0;
  const isCompleted = progressPercentage === 100;
  const isStarted = progress > 0;
  const durationMinutes = Math.max(
    1,
    Math.round((totalDurationSeconds && totalDurationSeconds > 0
      ? totalDurationSeconds
      : totalModules * 15 * 60) / 60)
  );

  return (
    <Card className="flex flex-col overflow-hidden">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-linear-to-br from-[#2b4d24]/20 to-[#2b4d24]/10">
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
            <BookOpen className="h-12 w-12 text-[#2b4d24]/30" />
          </div>
        )}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          <Badge className="bg-[#2b4d24] text-[#FFFEF9]">
            {course.accessLevel.replace("_", " ")}
          </Badge>
          {course.isPaid && (
            <Badge variant="secondary" className="text-[10px] bg-[#e1a730]/10 text-[#a36d4c]">
              Paid - ${course.price ?? 0}
            </Badge>
          )}
        </div>
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="font-sans tracking-tight text-xl line-clamp-1">
          {course.title}
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {course.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#666666]">
              {isCompleted ? "Completed" : isStarted ? "In Progress" : "Not Started"}
            </span>
            <span className="text-[#1a1a1a]">
              {progress}/{totalModules} modules
            </span>
          </div>
          <Progress value={progressPercentage} />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-[#666666]">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {totalModules} modules
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~{durationMinutes} mins
          </span>
        </div>

        {/* Action Button */}
        <Button className="w-full bg-[#2b4d24] hover:bg-[#1a3a15]" asChild>
          <Link href={`/courses/${course.id}`}>
            <Play className="mr-2 h-4 w-4" />
            {isCompleted ? "Review" : isStarted ? "Continue" : "Start Learning"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
