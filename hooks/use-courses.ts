'use client';

import { useState, useEffect } from 'react';
import { Course, CourseModule, UserCourseProgress } from '@/types';

interface UseCoursesReturn {
  courses: Course[];
  modules: CourseModule[];
  progress: UserCourseProgress[];
  isLoading: boolean;
  error: Error | null;
  updateProgress: (moduleId: string, updates: Partial<UserCourseProgress>) => Promise<void>;
}

type CoursesApiResponse = {
  courses?: Course[];
  modules?: CourseModule[];
  progress?: Array<{
    id?: string;
    userId?: string;
    moduleId: string;
    completed: boolean;
    completedAt?: string | null;
    watchTimeSeconds: number;
    lastWatchedAt?: string | null;
  }>;
};

export function useCourses(userId: string | undefined): UseCoursesReturn {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [progress, setProgress] = useState<UserCourseProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCourses() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/courses', { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to load courses (${response.status})`);
        }
        const data = (await response.json()) as CoursesApiResponse;
        if (cancelled) return;

        const loadedCourses = (data.courses ?? [])
          .map((course) => ({
            ...course,
            enforceSequential: course.enforceSequential ?? true,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const loadedModules = (data.modules ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const loadedProgress: UserCourseProgress[] = userId
          ? (data.progress ?? []).map((p) => ({
              id: p.id ?? `${userId}-${p.moduleId}`,
              userId,
              moduleId: p.moduleId,
              completed: p.completed,
              completedAt: p.completedAt ?? undefined,
              watchTimeSeconds: p.watchTimeSeconds,
              lastWatchedAt: p.lastWatchedAt ?? undefined,
            }))
          : [];

        setCourses(loadedCourses);
        setModules(loadedModules);
        setProgress(loadedProgress);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchCourses();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateProgress = async (moduleId: string, updates: Partial<UserCourseProgress>) => {
    if (!userId) return;
    const existing = progress.find((entry) => entry.moduleId === moduleId);
    const now = new Date().toISOString();
    const nextCompleted = updates.completed ?? existing?.completed ?? false;
    const nextWatchTime = updates.watchTimeSeconds ?? existing?.watchTimeSeconds ?? 0;
    const nextCompletedAt = nextCompleted
      ? updates.completedAt ?? existing?.completedAt ?? now
      : undefined;
    const nextLastWatchedAt = updates.lastWatchedAt ?? now;

    const entry: UserCourseProgress = {
      id: existing?.id ?? updates.id ?? `${userId}-${moduleId}`,
      userId,
      moduleId,
      completed: nextCompleted,
      completedAt: nextCompletedAt,
      watchTimeSeconds: nextWatchTime,
      lastWatchedAt: nextLastWatchedAt,
    };

    setProgress((prev) => {
      const filtered = prev.filter((p) => p.moduleId !== moduleId);
      return [...filtered, entry];
    });
  };

  return { courses, modules, progress, isLoading, error, updateProgress };
}
