"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useCourses } from "@/hooks/use-courses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/portal/empty-state";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";
import { getStreamUrl } from "@/lib/cloudflare/client";
import { hasAdminPermission } from "@/lib/admin/roles";
import {
  QuizResult,
  createQuizSession,
  gradeQuizSession,
  normalizeQuizPayload,
} from "@/lib/lms/quiz";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Download,
  Lock,
  MessageSquare,
  Pin,
  PlayCircle,
} from "lucide-react";
import type {
  CourseCohort,
  CourseDiscussionReply,
  CourseDiscussionThread,
  UserQuizAttempt,
} from "@/types";

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function downloadFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8"
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDateTime(value: string | undefined | null) {
  if (!value) return "TBD";
  return new Date(value).toLocaleString();
}

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId;
  const { user } = useAuth();
  const { courses, modules, progress, isLoading, updateProgress } = useCourses(user?.id);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [, setNoteId] = useState<string | null>(null);
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizSessionSeed, setQuizSessionSeed] = useState("");
  const [quizAttemptStartedAt, setQuizAttemptStartedAt] = useState<string | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<UserQuizAttempt[]>([]);
  const [quizAttemptError, setQuizAttemptError] = useState<string | null>(null);
  const [, setCertificateIssuedAt] = useState<string | null>(null);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [certificateVerificationUrl, setCertificateVerificationUrl] = useState<string | null>(null);
  const [certificateNumber, setCertificateNumber] = useState<string | null>(null);
  const [courseCohorts, setCourseCohorts] = useState<CourseCohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [cohortError, setCohortError] = useState<string | null>(null);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [newCohortName, setNewCohortName] = useState("");
  const [newCohortDescription, setNewCohortDescription] = useState("");
  const [threadTitle, setThreadTitle] = useState("");
  const [threadBody, setThreadBody] = useState("");
  const [threadError, setThreadError] = useState<string | null>(null);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [discussionThreads, setDiscussionThreads] = useState<CourseDiscussionThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [repliesByThreadId, setRepliesByThreadId] = useState<Record<string, CourseDiscussionReply[]>>({});
  const [replyDraftByThreadId, setReplyDraftByThreadId] = useState<Record<string, string>>({});
  const [replyError, setReplyError] = useState<string | null>(null);
  const canManageLms = hasAdminPermission("lms:manage", user?.permissions);

  const course = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId]
  );

  const courseModules = useMemo(
    () =>
      modules
        .filter((m) => m.courseId === courseId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [modules, courseId]
  );

  const progressMap = useMemo(() => {
    return new Map(progress.map((p) => [p.moduleId, p]));
  }, [progress]);

  const moduleUnlockMap = useMemo(() => {
    if (course?.enforceSequential === false) {
      return courseModules.reduce<Map<string, boolean>>((acc, module) => {
        acc.set(module.id, true);
        return acc;
      }, new Map<string, boolean>());
    }

    return courseModules.reduce<Map<string, boolean>>((acc, module, index) => {
      if (index === 0) {
        acc.set(module.id, true);
        return acc;
      }
      const previousModule = courseModules[index - 1];
      const previousCompleted = Boolean(progressMap.get(previousModule.id)?.completed);
      acc.set(module.id, previousCompleted);
      return acc;
    }, new Map<string, boolean>());
  }, [course?.enforceSequential, courseModules, progressMap]);

  const firstUnlockedModuleId = useMemo(() => {
    return (
      courseModules.find((module) => moduleUnlockMap.get(module.id))?.id ??
      courseModules[0]?.id ??
      null
    );
  }, [courseModules, moduleUnlockMap]);

  const completedCount = courseModules.filter((m) => progressMap.get(m.id)?.completed).length;
  const totalCount = courseModules.length || 0;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isCourseComplete = totalCount > 0 && completedCount === totalCount;
  const streamSubdomain = process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_SUBDOMAIN;
  const selectedCohort = useMemo(
    () => courseCohorts.find((cohort) => cohort.id === selectedCohortId) ?? null,
    [courseCohorts, selectedCohortId]
  );

  useEffect(() => {
    if (courseModules.length === 0) return;
    const activeIsUnlocked = activeModuleId ? moduleUnlockMap.get(activeModuleId) : false;
    if (!activeModuleId || !activeIsUnlocked) {
      setActiveModuleId(firstUnlockedModuleId ?? courseModules[0].id);
    }
  }, [activeModuleId, courseModules, firstUnlockedModuleId, moduleUnlockMap]);

  useEffect(() => {
    if (!user || !activeModuleId) return;
    const currentModuleId = activeModuleId;

    async function loadNote() {
      setNoteError(null);

      const response = await fetch(
        `/api/lms/notes?moduleId=${encodeURIComponent(currentModuleId)}`,
        { credentials: "include" }
      );
      const json = (await response.json()) as {
        note?: { id: string; content: string; updatedAt: string | null } | null;
        error?: string;
      };

      if (!response.ok) {
        setNoteError("Unable to load saved notes right now.");
        return;
      }

      setNoteValue(json.note?.content ?? "");
      setNoteId(json.note?.id ?? null);
      setNoteUpdatedAt(json.note?.updatedAt ?? null);
      setNoteSaved(false);
    }

    void loadNote();
  }, [activeModuleId, user]);

  useEffect(() => {
    setQuizAnswers({});
    setQuizResult(null);
    setQuizError(null);
    setQuizAttemptError(null);
    setQuizSessionSeed(`${activeModuleId ?? "module"}:${user?.id ?? "anonymous"}:${Date.now()}`);
    setQuizAttemptStartedAt(new Date().toISOString());

    async function loadQuizAttempts() {
      if (!user?.id || !activeModuleId) {
        setQuizAttempts([]);
        return;
      }

      const response = await fetch(
        `/api/lms/quiz-attempts?moduleId=${encodeURIComponent(activeModuleId)}`,
        { credentials: "include" }
      );
      const json = (await response.json()) as {
        attempts?: UserQuizAttempt[];
        error?: string;
      };

      if (!response.ok) {
        setQuizAttemptError("Unable to load quiz attempt history.");
        setQuizAttempts([]);
        return;
      }

      const attempts = [...(json.attempts ?? [])].sort(
        (a, b) => b.attemptNumber - a.attemptNumber
      );
      setQuizAttempts(attempts);
    }

    void loadQuizAttempts();
  }, [activeModuleId, user?.id]);

  useEffect(() => {
    if (!user?.id || !courseId || !activeModuleId) return;

    const moduleEntry = modules.find((entry) => entry.id === activeModuleId);
    if (!moduleEntry) return;

    void fetch("/api/lms/events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId: moduleEntry.courseId,
        moduleId: activeModuleId,
        eventType: "module_viewed",
        watchTimeSeconds: 0,
        metadata: {
          source: "module_change",
        },
      }),
    });
  }, [activeModuleId, courseId, modules, user?.id]);

  useEffect(() => {
    if (!user || !course || !isCourseComplete) return;
    const currentCourseId = course.id;

    async function issueCertificate() {
      setCertificateError(null);
      const response = await fetch("/api/certificates/issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ courseId: currentCourseId }),
      });
      const json = (await response.json()) as {
        issuedAt?: string;
        certificateUrl?: string | null;
        verificationUrl?: string | null;
        certificateNumber?: string | null;
        error?: string;
      };

      if (!response.ok) {
        setCertificateError(json.error || "Unable to issue certificate right now.");
        return;
      }

      setCertificateIssuedAt(json.issuedAt ?? new Date().toISOString());
      setCertificateUrl(json.certificateUrl ?? null);
      setCertificateVerificationUrl(json.verificationUrl ?? null);
      setCertificateNumber(json.certificateNumber ?? null);
    }

    void issueCertificate();
  }, [course, isCourseComplete, user]);

  useEffect(() => {
    async function loadCohorts() {
      if (!courseId || !user?.id) {
        setCourseCohorts([]);
        setSelectedCohortId(null);
        return;
      }

      setCohortError(null);
      setCohortLoading(true);

      const response = await fetch(`/api/lms/cohorts?courseId=${encodeURIComponent(courseId)}`);
      const json = (await response.json()) as {
        cohorts?: CourseCohort[];
        error?: string;
      };
      if (!response.ok) {
        setCohortError(json.error || "Unable to load cohorts right now.");
        setCourseCohorts([]);
        setSelectedCohortId(null);
        setCohortLoading(false);
        return;
      }

      const loaded = json.cohorts ?? [];
      setCourseCohorts(loaded);
      setSelectedCohortId((current) => {
        if (current && loaded.some((cohort) => cohort.id === current)) return current;
        const joined = loaded.find((cohort) => cohort.isMember);
        return joined?.id ?? loaded[0]?.id ?? null;
      });
      setCohortLoading(false);
    }

    void loadCohorts();
  }, [courseId, user?.id]);

  useEffect(() => {
    async function loadThreads() {
      if (!courseId || !user?.id) {
        setDiscussionThreads([]);
        setThreadError(null);
        return;
      }

      setDiscussionLoading(true);
      setThreadError(null);

      const params = new URLSearchParams();
      params.set("courseId", courseId);
      if (selectedCohortId) {
        params.set("cohortId", selectedCohortId);
      }
      const response = await fetch(`/api/lms/discussions/threads?${params.toString()}`);
      const json = (await response.json()) as {
        threads?: CourseDiscussionThread[];
        error?: string;
      };
      if (!response.ok) {
        setThreadError(json.error || "Unable to load community threads.");
        setDiscussionThreads([]);
        setDiscussionLoading(false);
        return;
      }

      setDiscussionThreads(json.threads ?? []);
      setDiscussionLoading(false);
    }

    void loadThreads();
  }, [courseId, selectedCohortId, user?.id]);

  useEffect(() => {
    if (!activeThreadId) return;
    const stillVisible = discussionThreads.some((thread) => thread.id === activeThreadId);
    if (!stillVisible) {
      setActiveThreadId(null);
    }
  }, [activeThreadId, discussionThreads]);

  async function createCohort() {
    if (!courseId || !user?.id || !canManageLms) return;
    const name = newCohortName.trim();
    if (!name) return;

    setCohortError(null);

    const response = await fetch("/api/lms/cohorts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "create",
        courseId,
        name,
        description: newCohortDescription.trim() || undefined,
      }),
    });
    const json = (await response.json()) as {
      cohort?: CourseCohort;
      error?: string;
    };
    if (!response.ok) {
      setCohortError(json.error || "Unable to create cohort.");
      return;
    }

    setNewCohortName("");
    setNewCohortDescription("");
    if (json.cohort?.id) {
      setSelectedCohortId(json.cohort.id);
    }
    const refresh = await fetch(`/api/lms/cohorts?courseId=${encodeURIComponent(courseId)}`);
    const refreshJson = (await refresh.json()) as { cohorts?: CourseCohort[] };
    if (refresh.ok) {
      setCourseCohorts(refreshJson.cohorts ?? []);
    }
  }

  async function toggleCohortMembership(cohort: CourseCohort) {
    if (!user?.id) return;
    setCohortError(null);

    const response = await fetch("/api/lms/cohorts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: cohort.isMember ? "leave" : "join",
        cohortId: cohort.id,
      }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      setCohortError(json.error || "Unable to update cohort membership.");
      return;
    }

    const refresh = await fetch(`/api/lms/cohorts?courseId=${encodeURIComponent(courseId ?? "")}`);
    const refreshJson = (await refresh.json()) as { cohorts?: CourseCohort[] };
    if (refresh.ok) {
      const refreshed = refreshJson.cohorts ?? [];
      setCourseCohorts(refreshed);
      if (!cohort.isMember) {
        setSelectedCohortId(cohort.id);
      } else if (selectedCohortId === cohort.id) {
        const fallback = refreshed.find((entry) => entry.isMember) ?? refreshed[0];
        setSelectedCohortId(fallback?.id ?? null);
      }
    }
  }

  async function createDiscussionThread() {
    if (!courseId || !user?.id) return;
    const title = threadTitle.trim();
    const body = threadBody.trim();
    if (!title || !body) return;

    setThreadError(null);

    const response = await fetch("/api/lms/discussions/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courseId,
        cohortId: selectedCohortId,
        moduleId: activeModule?.id,
        title,
        body,
      }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      setThreadError(json.error || "Unable to publish thread.");
      return;
    }

    setThreadTitle("");
    setThreadBody("");

    const params = new URLSearchParams();
    params.set("courseId", courseId);
    if (selectedCohortId) params.set("cohortId", selectedCohortId);
    const refresh = await fetch(`/api/lms/discussions/threads?${params.toString()}`);
    const refreshJson = (await refresh.json()) as { threads?: CourseDiscussionThread[] };
    if (refresh.ok) {
      setDiscussionThreads(refreshJson.threads ?? []);
    }
  }

  async function toggleThreadModeration(threadId: string, updates: { pinned?: boolean; locked?: boolean }) {
    if (!canManageLms) return;

    const response = await fetch(`/api/lms/discussions/threads/${threadId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      setThreadError(json.error || "Unable to update thread settings.");
      return;
    }

    setDiscussionThreads((current) =>
      current.map((thread) => (thread.id === threadId ? { ...thread, ...updates } : thread))
    );
  }

  async function loadThreadReplies(threadId: string) {
    if (!user?.id) return;
    setReplyError(null);

    const response = await fetch(`/api/lms/discussions/threads/${threadId}/replies`);
    const json = (await response.json()) as { replies?: CourseDiscussionReply[]; error?: string };
    if (!response.ok) {
      setReplyError(json.error || "Unable to load replies.");
      return;
    }
    setRepliesByThreadId((current) => ({
      ...current,
      [threadId]: json.replies ?? [],
    }));
  }

  async function addDiscussionReply(thread: CourseDiscussionThread) {
    if (!user?.id) return;
    const content = (replyDraftByThreadId[thread.id] ?? "").trim();
    if (!content) return;
    setReplyError(null);

    const response = await fetch(`/api/lms/discussions/threads/${thread.id}/replies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: content }),
    });
    const json = (await response.json()) as {
      reply?: CourseDiscussionReply;
      error?: string;
    };
    if (!response.ok || !json.reply) {
      setReplyError(json.error || "Unable to post reply.");
      return;
    }

    setRepliesByThreadId((current) => ({
      ...current,
      [thread.id]: [...(current[thread.id] ?? []), json.reply!],
    }));
    setReplyDraftByThreadId((current) => ({ ...current, [thread.id]: "" }));
    setDiscussionThreads((current) =>
      current.map((entry) =>
        entry.id === thread.id
          ? {
              ...entry,
              replyCount: entry.replyCount + 1,
              lastActivityAt: json.reply!.createdAt,
            }
          : entry
      )
    );
  }

  if (isLoading) {
    return <PortalPageSkeleton />;
  }

  if (!course) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Course not found"
        description="We couldn't find this course in your catalog."
        actionLabel="Back to Courses"
        actionHref="/courses"
      />
    );
  }

  const activeModule = courseModules.find((m) => m.id === activeModuleId) ?? courseModules[0];
  const activeProgress = activeModule ? progressMap.get(activeModule.id) : undefined;
  const activeModuleType = activeModule?.type ?? "video";
  const canPersistNotes = Boolean(user?.id && activeModule?.id);
  const activeModuleUnlocked = activeModule ? Boolean(moduleUnlockMap.get(activeModule.id)) : false;
  const activeQuizPayload =
    activeModuleType === "quiz" ? normalizeQuizPayload(activeModule?.quizPayload) : null;
  const activeQuizSession =
    activeQuizPayload && activeModule
      ? createQuizSession(
          activeQuizPayload,
          quizSessionSeed || `${activeModule.id}:${user?.id ?? "anonymous"}`
        )
      : null;
  const activeModuleIndex = activeModule
    ? courseModules.findIndex((module) => module.id === activeModule.id)
    : -1;
  const nextModule =
    activeModuleIndex >= 0 && activeModuleIndex < courseModules.length - 1
      ? courseModules[activeModuleIndex + 1]
      : undefined;
  const cannotPostToSelectedCohort = Boolean(
    selectedCohort && !selectedCohort.isMember && !canManageLms
  );

  function saveNote() {
    if (!user || !activeModule) return;
    const currentModuleId = activeModule.id;

    async function persistNote() {
      setNoteError(null);

      const response = await fetch("/api/lms/notes", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: currentModuleId,
          content: noteValue.trim(),
        }),
      });
      const json = (await response.json()) as {
        note?: { id: string; content: string; updatedAt: string | null } | null;
        error?: string;
      };

      if (!response.ok || !json.note) {
        setNoteError("We could not save this note. Please try again.");
        return;
      }

      setNoteId(json.note.id);
      setNoteUpdatedAt(json.note.updatedAt);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }

    void persistNote();
  }

  function submitQuizAttempt() {
    if (!user || !course || !activeModule || !activeQuizSession) return;
    if (!activeModuleUnlocked) return;
    const currentUser = user;
    const currentCourse = course;
    const currentModule = activeModule;
    const currentQuizSession = activeQuizSession;

    const unanswered = currentQuizSession.questions.filter(
      (question) => quizAnswers[question.id] === undefined
    );
    if (unanswered.length > 0) {
      setQuizError("Please answer every question before submitting.");
      return;
    }

    const result = gradeQuizSession(
      currentQuizSession,
      quizAnswers,
      currentModule.passThreshold ?? 70
    );
    setQuizResult(result);
    setQuizError(null);
    setQuizAttemptError(null);

    const now = new Date().toISOString();
    const durationSeconds = quizAttemptStartedAt
      ? Math.max(1, Math.floor((new Date(now).getTime() - new Date(quizAttemptStartedAt).getTime()) / 1000))
      : 0;
    const nextAttemptNumber = (quizAttempts[0]?.attemptNumber ?? 0) + 1;
    const nextAttempt: UserQuizAttempt = {
      id: `attempt-${now.replace(/[^0-9]/g, "")}`,
      userId: currentUser.id,
      courseId: currentCourse.id,
      moduleId: currentModule.id,
      attemptNumber: nextAttemptNumber,
      scorePercent: result.scorePercent,
      correctAnswers: result.correctAnswers,
      totalQuestions: result.totalQuestions,
      passed: result.passed,
      answers: quizAnswers,
      questionOrder: currentQuizSession.questionOrder,
      optionOrder: currentQuizSession.optionOrderByQuestion,
      startedAt: quizAttemptStartedAt ?? now,
      submittedAt: now,
      durationSeconds,
      metadata: {
        seed: currentQuizSession.seed,
      },
    };

    async function persistAttempt() {
      const response = await fetch("/api/lms/quiz-attempts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: currentCourse.id,
          moduleId: currentModule.id,
          attemptNumber: nextAttemptNumber,
          scorePercent: result.scorePercent,
          correctAnswers: result.correctAnswers,
          totalQuestions: result.totalQuestions,
          passed: result.passed,
          answers: quizAnswers,
          questionOrder: currentQuizSession.questionOrder,
          optionOrder: currentQuizSession.optionOrderByQuestion,
          startedAt: quizAttemptStartedAt ?? now,
          durationSeconds,
          metadata: {
            seed: currentQuizSession.seed,
          },
        }),
      });
      const json = (await response.json()) as {
        attempt?: UserQuizAttempt;
        error?: string;
      };

      if (!response.ok || !json.attempt) {
        setQuizAttemptError("Attempt saved locally in this session, but history failed to persist.");
        setQuizAttempts((current) => [nextAttempt, ...current]);
      } else {
        setQuizAttempts((current) => [json.attempt!, ...current]);
      }

      void fetch("/api/lms/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: currentCourse.id,
          moduleId: currentModule.id,
          eventType: result.passed ? "quiz_passed" : "quiz_failed",
          watchTimeSeconds: currentModule.durationSeconds,
          metadata: {
            score: result.scorePercent,
            attemptNumber: nextAttemptNumber,
          },
        }),
      });

      if (result.passed) {
        await updateProgress(currentModule.id, {
          completed: true,
          watchTimeSeconds: currentModule.durationSeconds,
        });
      }
    }

    void persistAttempt();
  }

  function retakeQuiz() {
    setQuizAnswers({});
    setQuizResult(null);
    setQuizError(null);
    setQuizAttemptError(null);
    setQuizSessionSeed(`${activeModuleId ?? "module"}:${user?.id ?? "anonymous"}:${Date.now()}`);
    setQuizAttemptStartedAt(new Date().toISOString());
  }

  function downloadCertificate() {
    if (!isCourseComplete || !course) return;
    if (certificateUrl) {
      window.open(certificateUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setCertificateError("Certificate is still generating. Try again in a few seconds.");
  }

  function downloadActiveNote() {
    if (!course || !activeModule || !noteValue.trim()) return;
    const safeCourseTitle = sanitizeFilename(course.title);
    const safeModuleTitle = sanitizeFilename(activeModule.title);
    const body = [
      `Course: ${course.title}`,
      `Module: ${activeModule.title}`,
      `Downloaded: ${new Date().toLocaleString()}`,
      "",
      noteValue.trim(),
    ].join("\n");
    downloadFile(`${safeCourseTitle}-${safeModuleTitle}-notes.txt`, body);
  }

  function downloadCompletionSummary() {
    if (!isCourseComplete || !course) return;
    const learnerName = user ? `${user.firstName} ${user.lastName}` : "Unknown User";
    const moduleRows = courseModules.map((module, index) => {
      const moduleProgress = progressMap.get(module.id);
      const state = moduleProgress?.completed ? "Completed" : "Incomplete";
      return `<tr><td>${index + 1}</td><td>${module.title}</td><td>${state}</td></tr>`;
    });

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Course Completion Summary</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #1a1a1a; }
    h1 { margin: 0 0 16px; font-size: 28px; }
    .meta { margin-bottom: 20px; line-height: 1.8; }
    .label { color: #666; display: inline-block; min-width: 130px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #d9ddd6; padding: 8px; text-align: left; font-size: 14px; }
    th { background: #f5f7f3; }
  </style>
</head>
<body>
  <h1>Favor Course Completion Summary</h1>
  <div class="meta">
    <div><span class="label">Learner:</span> ${learnerName}</div>
    <div><span class="label">Email:</span> ${user?.email ?? "Unknown"}</div>
    <div><span class="label">Course:</span> ${course.title}</div>
    <div><span class="label">Completed On:</span> ${new Date().toLocaleDateString()}</div>
    <div><span class="label">Completion Rate:</span> ${completionRate}%</div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Module</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${moduleRows.join("")}
    </tbody>
  </table>
</body>
</html>`;
    downloadFile(
      `${sanitizeFilename(course.title)}-completion-summary.html`,
      html,
      "text/html;charset=utf-8"
    );
  }

  function getCompletionButtonText() {
    if (activeProgress?.completed) return "Mark Incomplete";
    if (activeModuleType === "reading") return "Mark Reading Complete";
    if (activeModuleType === "quiz") return "Mark Quiz Complete";
    return "Mark Video Complete";
  }

  function goToNextModule() {
    if (!nextModule) return;
    if (!activeProgress?.completed) return;
    if (!moduleUnlockMap.get(nextModule.id)) return;
    setActiveModuleId(nextModule.id);
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/courses" className="inline-flex items-center text-xs text-[#999999] hover:text-[#666666]">
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Back to Courses
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">{course.title}</h1>
          <Badge className="bg-[#2b4d24] text-[#FFFEF9] text-[10px] uppercase tracking-wide">
            {course.accessLevel.replace("_", " ")}
          </Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-[#666666]">{course.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#999999]">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" /> {totalCount} modules
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> ~{Math.round(totalCount * 15)} min
          </span>
        </div>
        <div className="mt-4 max-w-xl">
          <Progress value={completionRate} className="h-2" />
          <p className="mt-1 text-xs text-[#999999]">{completionRate}% complete</p>
        </div>
      </div>

      {isCourseComplete && (
        <Card className="border-[#2b4d24]/20 bg-[#2b4d24]/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm font-medium text-[#1a1a1a]">Course complete</p>
              <p className="text-xs text-[#666666]">
                You have finished all modules in this course.
              </p>
              {certificateNumber && (
                <p className="mt-1 text-[11px] text-[#2b4d24]">Certificate #{certificateNumber}</p>
              )}
              {certificateVerificationUrl && (
                <p className="text-[11px] text-[#666666]">
                  Verification:{" "}
                  <a
                    href={certificateVerificationUrl}
                    className="text-[#2b4d24] underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {certificateVerificationUrl}
                  </a>
                </p>
              )}
            </div>
            <Button variant="outline" onClick={downloadCompletionSummary}>
              <Download className="mr-2 h-4 w-4" />
              Download Completion Summary
            </Button>
            <Button variant="outline" onClick={downloadCertificate}>
              <Download className="mr-2 h-4 w-4" />
              Download Certificate
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="glass-pane">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-lg">Modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {courseModules.map((module, index) => {
              const isActive = module.id === activeModule?.id;
              const isComplete = progressMap.get(module.id)?.completed;
              const isUnlocked = moduleUnlockMap.get(module.id) ?? false;
              return (
                <button
                  key={module.id}
                  onClick={() => {
                    if (isUnlocked) setActiveModuleId(module.id);
                  }}
                  disabled={!isUnlocked}
                  className={`w-full rounded-xl p-3 text-left glass-transition ${
                    isActive ? "border border-[#2b4d24]/20 bg-[#2b4d24]/10" : "glass-inset"
                  } ${!isUnlocked ? "cursor-not-allowed opacity-70" : ""}`}
                  aria-label={
                    isUnlocked
                      ? `Open module ${index + 1}`
                      : `Module ${index + 1} is locked until previous module is complete`
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#999999]">Module {index + 1}</p>
                      <p className="text-sm font-medium text-[#1a1a1a]">{module.title}</p>
                    </div>
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-[#2b4d24]" />
                    ) : isUnlocked ? (
                      <PlayCircle className="h-4 w-4 text-[#c5ccc2]" />
                    ) : (
                      <Lock className="h-4 w-4 text-[#c5ccc2]" />
                    )}
                  </div>
                  {module.description && (
                    <p className="mt-1 text-xs text-[#999999] line-clamp-2">{module.description}</p>
                  )}
                  {!isUnlocked && (
                    <p className="mt-1 text-[10px] text-[#999999]">
                      Complete the previous module to unlock this lesson.
                    </p>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-pane overflow-hidden">
            <div className="relative aspect-video bg-gradient-to-br from-[#2b4d24]/15 to-[#8b957b]/10 flex items-center justify-center">
              <PlayCircle className="h-12 w-12 text-[#2b4d24]" />
            </div>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#999999]">Now Playing</p>
                  <h2 className="font-serif text-xl text-[#1a1a1a]">{activeModule?.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] text-[#8b957b]">
                    {(activeModule?.type ?? "video").toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-[#8b957b]">
                    {activeModule ? Math.round(activeModule.durationSeconds / 60) : 0} min
                  </Badge>
                </div>
              </div>
              {!activeModuleUnlocked && (
                <p className="text-xs text-[#a36d4c]">
                  This module is locked until previous content is completed.
                </p>
              )}
              {activeModuleType === "video" && activeModule?.cloudflareVideoId && streamSubdomain && !activeModule.cloudflareVideoId.startsWith("demo") && (
                <div className="overflow-hidden rounded-xl border border-[#c5ccc2]/40">
                  <iframe
                    src={getStreamUrl(activeModule.cloudflareVideoId)}
                    title={activeModule.title}
                    className="h-[360px] w-full"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen
                  />
                </div>
              )}
              {activeModuleType === "quiz" && activeQuizSession && (
                <div className="space-y-4 rounded-xl border border-[#c5ccc2]/50 bg-white/70 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#8b957b]">
                      Knowledge Check
                    </p>
                    <p className="text-sm text-[#666666]">
                      Pass score: {activeModule?.passThreshold ?? 70}%
                    </p>
                  </div>
                  {activeQuizSession.questions.map((question, idx) => (
                    <div key={question.id} className="space-y-2 rounded-lg border border-[#c5ccc2]/40 bg-white p-3">
                      <p className="text-sm font-medium text-[#1a1a1a]">
                        {idx + 1}. {question.prompt || "Untitled question"}
                      </p>
                      <div className="space-y-2">
                        {question.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              setQuizAnswers((current) => ({
                                ...current,
                                [question.id]: option.id,
                              }))
                            }
                            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                              quizAnswers[question.id] === option.id
                                ? "border-[#2b4d24] bg-[#2b4d24]/10 text-[#1a1a1a]"
                                : "border-[#d8d8d8] bg-white text-[#666666]"
                            }`}
                          >
                            {option.label || "Option"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" onClick={submitQuizAttempt} disabled={!activeModuleUnlocked}>
                      Submit Quiz
                    </Button>
                    <Button variant="ghost" onClick={retakeQuiz} disabled={!activeModuleUnlocked}>
                      Retake
                    </Button>
                    {quizResult && (
                      <span className={quizResult.passed ? "text-sm text-[#2b4d24]" : "text-sm text-[#a36d4c]"}>
                        Score: {quizResult.scorePercent}% ({quizResult.correctAnswers}/{quizResult.totalQuestions}){" "}
                        {quizResult.passed ? "- Passed" : "- Try again"}
                      </span>
                    )}
                  </div>
                  {quizError && <p className="text-xs text-[#a36d4c]">{quizError}</p>}
                  {quizAttemptError && <p className="text-xs text-[#a36d4c]">{quizAttemptError}</p>}
                  {quizAttempts.length > 0 && (
                    <div className="rounded-lg border border-[#c5ccc2]/40 bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-[#8b957b]">Attempt History</p>
                      <div className="mt-2 space-y-1">
                        {quizAttempts.slice(0, 5).map((attempt) => (
                          <p key={attempt.id} className="text-xs text-[#666666]">
                            Attempt {attempt.attemptNumber}: {attempt.scorePercent}%{" "}
                            {attempt.passed ? "(Passed)" : "(Not passed)"} on{" "}
                            {new Date(attempt.submittedAt).toLocaleString()}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm text-[#666666]">
                {activeModule?.description || "Follow along with this module to deepen your understanding."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-[#2b4d24] hover:bg-[#1a3a15]"
                  disabled={!activeModule || !activeModuleUnlocked}
                  onClick={() => {
                    if (!activeModule || !activeModuleUnlocked) return;
                    const nextCompleted = !activeProgress?.completed;
                    const watchTime = nextCompleted
                      ? Math.max(activeModule.durationSeconds, activeProgress?.watchTimeSeconds ?? 0)
                      : activeProgress?.watchTimeSeconds ?? 0;
                    void updateProgress(activeModule.id, {
                      completed: nextCompleted,
                      watchTimeSeconds: watchTime,
                    });
                  }}
                >
                  {getCompletionButtonText()}
                </Button>
                {activeModule?.resourceUrl && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(activeModule.resourceUrl, "_blank", "noopener,noreferrer")}
                  >
                    Open Resource
                  </Button>
                )}
                {nextModule && (
                  <Button
                    variant="outline"
                    onClick={goToNextModule}
                    disabled={!activeProgress?.completed}
                  >
                    Next Module
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" onClick={downloadActiveNote} disabled={!noteValue.trim()}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Notes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-subtle border-0">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-serif text-lg text-[#1a1a1a]">Learning Reflection</h3>
              <p className="text-sm text-[#666666]">
                Capture key takeaways or questions as you go. These notes remain private and can be revisited later.
              </p>
              <Textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Write down key takeaways, prayer requests, or follow-up ideas..."
                rows={5}
                className="bg-white/70"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#999999]">
                <span>
                  {canPersistNotes && noteUpdatedAt
                    ? `Last saved ${new Date(noteUpdatedAt).toLocaleString()}`
                    : canPersistNotes
                      ? "Not saved yet"
                      : "Sign in to save notes."}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveNote}
                  disabled={!canPersistNotes}
                  className={noteSaved ? "border-[#2b4d24] text-[#2b4d24]" : ""}
                >
                  {noteSaved ? "Saved" : "Save Note"}
                </Button>
              </div>
              {noteError && <p className="text-xs text-[#a36d4c]">{noteError}</p>}
              {certificateError && <p className="text-xs text-[#a36d4c]">{certificateError}</p>}
            </CardContent>
          </Card>

          <Card className="glass-subtle border-0">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg text-[#1a1a1a]">Cohort Community</h3>
                  <p className="text-sm text-[#666666]">
                    Discuss lessons with your cohort, ask questions, and share application ideas.
                  </p>
                </div>
                {cohortLoading && <span className="text-xs text-[#999999]">Loading cohorts...</span>}
              </div>

              <div className="space-y-2">
                {courseCohorts.length === 0 ? (
                  <p className="text-xs text-[#999999]">
                    No cohorts are available yet for this course.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {courseCohorts.map((cohort) => {
                      const isSelected = selectedCohortId === cohort.id;
                      return (
                        <div
                          key={cohort.id}
                          className={`rounded-xl border p-3 ${
                            isSelected ? "border-[#2b4d24]/40 bg-[#2b4d24]/5" : "border-[#c5ccc2]/40 bg-white/70"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <button
                              type="button"
                              className="text-left"
                              onClick={() => setSelectedCohortId(cohort.id)}
                            >
                              <p className="text-sm font-medium text-[#1a1a1a]">{cohort.name}</p>
                              <p className="text-xs text-[#999999]">
                                {cohort.membersCount ?? 0} members
                                {cohort.startsAt ? ` • Starts ${formatDateTime(cohort.startsAt)}` : ""}
                              </p>
                              {cohort.description && (
                                <p className="mt-1 text-xs text-[#666666]">{cohort.description}</p>
                              )}
                            </button>
                            <Button
                              size="sm"
                              variant={cohort.isMember ? "outline" : "default"}
                              className={cohort.isMember ? "" : "bg-[#2b4d24] hover:bg-[#1a3a15]"}
                              onClick={() => void toggleCohortMembership(cohort)}
                            >
                              {cohort.isMember ? "Leave" : "Join"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {canManageLms && (
                <div className="space-y-2 rounded-xl border border-[#2b4d24]/20 bg-[#2b4d24]/5 p-3">
                  <p className="text-xs uppercase tracking-wide text-[#2b4d24]">Create Cohort</p>
                  <Input
                    value={newCohortName}
                    onChange={(event) => setNewCohortName(event.target.value)}
                    placeholder="Cohort name"
                    className="bg-white/80"
                  />
                  <Textarea
                    value={newCohortDescription}
                    onChange={(event) => setNewCohortDescription(event.target.value)}
                    placeholder="Cohort description (optional)"
                    rows={2}
                    className="bg-white/80"
                  />
                  <Button
                    size="sm"
                    className="bg-[#2b4d24] hover:bg-[#1a3a15]"
                    onClick={() => void createCohort()}
                    disabled={!newCohortName.trim()}
                  >
                    Create Cohort
                  </Button>
                </div>
              )}
              {!canManageLms && (
                <p className="text-xs text-[#999999]">
                  Cohort creation is managed by LMS admins. You can still join available cohorts.
                </p>
              )}

              <div className="space-y-2 rounded-xl border border-[#c5ccc2]/40 bg-white/70 p-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#8b957b]">
                  <MessageSquare className="h-3.5 w-3.5" /> Start A Thread
                </p>
                <Input
                  value={threadTitle}
                  onChange={(event) => setThreadTitle(event.target.value)}
                  placeholder="Thread title"
                  className="bg-white/80"
                />
                <Textarea
                  value={threadBody}
                  onChange={(event) => setThreadBody(event.target.value)}
                  placeholder="What do you want to discuss?"
                  rows={3}
                  className="bg-white/80"
                />
                {selectedCohort && (
                  <p className="text-xs text-[#999999]">
                    Posting to cohort: <span className="font-medium text-[#666666]">{selectedCohort.name}</span>
                  </p>
                )}
                {cannotPostToSelectedCohort && (
                  <p className="text-xs text-[#a36d4c]">Join the selected cohort to post in this space.</p>
                )}
                <Button
                  size="sm"
                  className="bg-[#2b4d24] hover:bg-[#1a3a15]"
                  onClick={() => void createDiscussionThread()}
                  disabled={!threadTitle.trim() || !threadBody.trim() || cannotPostToSelectedCohort}
                >
                  Post Thread
                </Button>
              </div>

              {cohortError && <p className="text-xs text-[#a36d4c]">{cohortError}</p>}
              {threadError && <p className="text-xs text-[#a36d4c]">{threadError}</p>}
              {replyError && <p className="text-xs text-[#a36d4c]">{replyError}</p>}

              <div className="space-y-3">
                {discussionLoading ? (
                  <p className="text-xs text-[#999999]">Loading discussions...</p>
                ) : discussionThreads.length === 0 ? (
                  <p className="text-xs text-[#999999]">
                    No discussion threads yet. Start the first one for your cohort.
                  </p>
                ) : (
                  discussionThreads.map((thread) => (
                    <div
                      key={thread.id}
                      className="rounded-xl border border-[#c5ccc2]/40 bg-white/80 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {thread.pinned && <Pin className="h-3.5 w-3.5 text-[#2b4d24]" />}
                            <p className="text-sm font-medium text-[#1a1a1a]">{thread.title}</p>
                            {thread.locked && (
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-[#a36d4c]">
                                Locked
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-[#999999]">
                            {thread.authorName ?? "Favor Partner"} • {formatDateTime(thread.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {thread.replyCount} replies
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const nextActive = activeThreadId === thread.id ? null : thread.id;
                              setActiveThreadId(nextActive);
                              if (nextActive && !repliesByThreadId[thread.id]) {
                                void loadThreadReplies(thread.id);
                              }
                            }}
                          >
                            {activeThreadId === thread.id ? "Hide Replies" : "View Replies"}
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-[#666666] whitespace-pre-wrap">{thread.body}</p>

                      {canManageLms && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void toggleThreadModeration(thread.id, { pinned: !thread.pinned })
                            }
                          >
                            {thread.pinned ? "Unpin" : "Pin"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void toggleThreadModeration(thread.id, { locked: !thread.locked })
                            }
                          >
                            {thread.locked ? "Unlock" : "Lock"}
                          </Button>
                        </div>
                      )}

                      {activeThreadId === thread.id && (
                        <div className="mt-3 space-y-3 rounded-lg border border-[#c5ccc2]/35 bg-white/70 p-3">
                          <div className="space-y-2">
                            {(repliesByThreadId[thread.id] ?? []).length === 0 ? (
                              <p className="text-xs text-[#999999]">No replies yet.</p>
                            ) : (
                              (repliesByThreadId[thread.id] ?? []).map((reply) => (
                                <div key={reply.id} className="rounded-md border border-[#e9e9e9] bg-white p-2">
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#999999]">
                                    <span>{reply.authorName ?? "Favor Partner"}</span>
                                    {reply.isInstructorReply && (
                                      <Badge variant="outline" className="text-[10px] text-[#2b4d24]">
                                        Instructor
                                      </Badge>
                                    )}
                                    <span>{formatDateTime(reply.createdAt)}</span>
                                  </div>
                                  <p className="mt-1 text-xs text-[#666666] whitespace-pre-wrap">
                                    {reply.body}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                          <Textarea
                            value={replyDraftByThreadId[thread.id] ?? ""}
                            onChange={(event) =>
                              setReplyDraftByThreadId((current) => ({
                                ...current,
                                [thread.id]: event.target.value,
                              }))
                            }
                            placeholder={
                              thread.locked && !canManageLms
                                ? "Thread is locked by an instructor."
                                : "Write a reply..."
                            }
                            rows={3}
                            className="bg-white/85"
                            disabled={thread.locked && !canManageLms}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void addDiscussionReply(thread)}
                            disabled={
                              !replyDraftByThreadId[thread.id]?.trim() ||
                              (thread.locked && !canManageLms)
                            }
                          >
                            Reply
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
