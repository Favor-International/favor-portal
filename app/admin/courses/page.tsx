"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Course, CourseModule } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { hasAdminPermission } from "@/lib/admin/roles";
import { QuizBuilder } from "@/components/admin/quiz-builder";
import {
  createEmptyQuizPayload,
  isQuizPayloadReady,
  normalizeQuizPayload,
} from "@/lib/lms/quiz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, PlusCircle, Pencil, Film, FileText, Upload, ImagePlus } from "lucide-react";

const ACCESS_LEVELS: Course["accessLevel"][] = [
  "partner",
  "major_donor",
  "church",
  "foundation",
  "ambassador",
];
const STATUS: Array<NonNullable<Course["status"]>> = ["draft", "published"];
const MODULE_TYPES: NonNullable<CourseModule["type"]>[] = ["video", "reading", "quiz"];

// Aggregate analytics rows returned by GET /api/admin/courses (camelCase, sourced
// from learning.getLmsAnalyticsData).
type ProgressRow = {
  userId: string;
  moduleId: string;
  completed: boolean | null;
  watchTimeSeconds: number | null;
  completedAt: string | null;
  lastWatchedAt: string | null;
};
type QuizAttemptRow = { moduleId: string; scorePercent: number; passed: boolean };
type ModuleEventRow = {
  moduleId: string;
  eventType: string;
  userId: string;
  watchTimeSeconds: number;
  createdAt: string | null;
};
type CertificateRow = { courseId: string; userId: string; issuedAt: string | null };

type CoursesPayload = {
  courses: Course[];
  modules: CourseModule[];
  progress: ProgressRow[];
  quizAttempts: QuizAttemptRow[];
  events: ModuleEventRow[];
  certificates: CertificateRow[];
  notesCount: number;
};

export default function AdminCoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCourse, setNewCourse] = useState<Partial<Course>>({
    title: "",
    description: "",
    accessLevel: "partner",
    status: "draft",
    isLocked: false,
    isPaid: false,
    price: 0,
    tags: [],
    coverImage: "",
    enforceSequential: true,
    publishAt: undefined,
    unpublishAt: undefined,
  });
  const [moduleDraft, setModuleDraft] = useState<Record<string, Partial<CourseModule>>>({});
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [notesCount, setNotesCount] = useState(0);
  const [certificateRows, setCertificateRows] = useState<CertificateRow[]>([]);
  const [quizAttemptRows, setQuizAttemptRows] = useState<QuizAttemptRow[]>([]);
  const [moduleEventRows, setModuleEventRows] = useState<ModuleEventRow[]>([]);
  const [workspaceTab, setWorkspaceTab] = useState<"courses" | "community" | "analytics">(
    "courses"
  );

  const canManageLms = hasAdminPermission("lms:manage", user?.permissions);
  const canViewAnalytics = hasAdminPermission("analytics:view", user?.permissions);

  const loadData = useCallback(async () => {
    setErrorMessage(null);
    try {
      const response = await fetch("/api/admin/courses", { cache: "no-store" });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(json.error || "Failed to load courses");
        return;
      }
      const data = (await response.json()) as CoursesPayload;
      setCourses(data.courses ?? []);
      setModules(data.modules ?? []);
      setProgressRows(data.progress ?? []);
      setNotesCount(data.notesCount ?? 0);
      setCertificateRows(data.certificates ?? []);
      setQuizAttemptRows(data.quizAttempts ?? []);
      setModuleEventRows(data.events ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load courses");
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const modulesByCourse = useMemo(() => {
    return modules.reduce<Record<string, CourseModule[]>>((acc, module) => {
      acc[module.courseId] = acc[module.courseId] || [];
      acc[module.courseId].push(module);
      return acc;
    }, {});
  }, [modules]);

  const lmsAnalytics = useMemo(() => {
    const activeLearners = new Set(progressRows.map((row) => row.userId)).size;
    const completedRows = progressRows.filter((row) => row.completed);
    const totalWatchSeconds = progressRows.reduce((sum, row) => sum + (row.watchTimeSeconds ?? 0), 0);
    const avgWatchMinutes =
      progressRows.length > 0 ? Math.round(totalWatchSeconds / progressRows.length / 60) : 0;
    const certificatesIssued = certificateRows.length;

    const firstSeenByUser = new Map<string, string>();
    for (const row of progressRows) {
      const timestamp = row.completedAt ?? row.lastWatchedAt;
      if (!timestamp) continue;
      const existing = firstSeenByUser.get(row.userId);
      if (!existing || timestamp < existing) {
        firstSeenByUser.set(row.userId, timestamp);
      }
    }
    const cohortMap = new Map<string, { learners: Set<string>; completions: number }>();
    firstSeenByUser.forEach((timestamp, userId) => {
      const cohort = timestamp.slice(0, 7);
      const entry = cohortMap.get(cohort) ?? { learners: new Set<string>(), completions: 0 };
      entry.learners.add(userId);
      cohortMap.set(cohort, entry);
    });
    for (const row of progressRows) {
      if (!row.completed || !row.completedAt) continue;
      const cohort = row.completedAt.slice(0, 7);
      const entry = cohortMap.get(cohort) ?? { learners: new Set<string>(), completions: 0 };
      entry.completions += 1;
      cohortMap.set(cohort, entry);
    }
    const cohorts = Array.from(cohortMap.entries())
      .map(([cohort, entry]) => ({
        cohort,
        learners: entry.learners.size,
        completions: entry.completions,
      }))
      .sort((a, b) => (a.cohort > b.cohort ? -1 : 1))
      .slice(0, 6);

    const moduleEngagement = modules
      .map((module) => {
        const progressForModule = progressRows.filter((row) => row.moduleId === module.id);
        const eventUsers = moduleEventRows
          .filter((event) => event.moduleId === module.id)
          .map((event) => event.userId);
        const started = new Set([...progressForModule.map((row) => row.userId), ...eventUsers]).size;
        const completed = progressForModule.filter((row) => row.completed).length;
        const completionRate = started > 0 ? Math.round((completed / started) * 100) : 0;
        const avgWatchSeconds =
          progressForModule.length > 0
            ? Math.round(
                progressForModule.reduce((sum, row) => sum + (row.watchTimeSeconds ?? 0), 0) /
                  progressForModule.length
              )
            : 0;
        return {
          moduleId: module.id,
          title: module.title,
          courseId: module.courseId,
          courseTitle: courses.find((course) => course.id === module.courseId)?.title ?? "Course",
          moduleType: module.type ?? "video",
          started,
          completed,
          completionRate,
          avgWatchSeconds,
        };
      })
      .sort((a, b) => a.completionRate - b.completionRate);

    const dropoffModules = moduleEngagement
      .filter((row) => row.started > 0)
      .slice(0, 8);

    const quizPerformance = modules
      .filter((module) => module.type === "quiz")
      .map((module) => {
        const attempts = quizAttemptRows.filter((row) => row.moduleId === module.id);
        const passed = attempts.filter((attempt) => attempt.passed).length;
        const passRate = attempts.length > 0 ? Math.round((passed / attempts.length) * 100) : 0;
        const averageScore =
          attempts.length > 0
            ? Math.round(
                attempts.reduce((sum, attempt) => sum + attempt.scorePercent, 0) /
                  attempts.length
              )
            : 0;
        return {
          moduleId: module.id,
          title: module.title,
          attempts: attempts.length,
          passRate,
          averageScore,
        };
      })
      .sort((a, b) => b.attempts - a.attempts || b.passRate - a.passRate)
      .slice(0, 8);

    const watchBehavior = modules
      .map((module) => {
        const events = moduleEventRows.filter((event) => event.moduleId === module.id);
        const totalWatch = events.reduce((sum, event) => sum + event.watchTimeSeconds, 0);
        const avgWatch = events.length > 0 ? Math.round(totalWatch / events.length) : 0;
        return {
          moduleId: module.id,
          title: module.title,
          events: events.length,
          totalWatch,
          avgWatch,
        };
      })
      .sort((a, b) => b.totalWatch - a.totalWatch)
      .slice(0, 8);

    const topCourses = courses
      .map((course) => {
        const moduleIds = (modulesByCourse[course.id] ?? []).map((module) => module.id);
        const courseRows = progressRows.filter((row) => moduleIds.includes(row.moduleId));
        const uniqueLearners = new Set(courseRows.map((row) => row.userId)).size;
        const completedModules = courseRows.filter((row) => row.completed).length;
        const denominator = uniqueLearners * Math.max(moduleIds.length, 1);
        const completionRate = denominator > 0 ? Math.round((completedModules / denominator) * 100) : 0;
        const certs = certificateRows.filter((row) => row.courseId === course.id).length;
        return {
          id: course.id,
          title: course.title,
          learners: uniqueLearners,
          completionRate,
          certificates: certs,
        };
      })
      .sort((a, b) => b.certificates - a.certificates || b.completionRate - a.completionRate)
      .slice(0, 5);

    return {
      activeLearners,
      completedRows: completedRows.length,
      notesCount,
      avgWatchMinutes,
      certificatesIssued,
      topCourses,
      cohorts,
      dropoffModules,
      quizPerformance,
      watchBehavior,
    };
  }, [
    certificateRows,
    courses,
    moduleEventRows,
    modules,
    modulesByCourse,
    notesCount,
    progressRows,
    quizAttemptRows,
  ]);

  async function fileToDataUrl(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  async function uploadResourceAsset(file: File): Promise<{ url: string; warning?: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/admin/lms/upload/resource", {
      method: "POST",
      body: formData,
    });
    const json = (await response.json()) as { url?: string; warning?: string; error?: string };
    if (!response.ok || !json.url) {
      throw new Error(json.error || "Resource upload failed");
    }
    return { url: json.url, warning: json.warning };
  }

  async function uploadVideoToCloudflare(file: File): Promise<{ cloudflareVideoId: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/admin/lms/upload/cloudflare", {
      method: "POST",
      body: formData,
    });
    const json = (await response.json()) as { cloudflareVideoId?: string; error?: string };
    if (!response.ok || !json.cloudflareVideoId) {
      throw new Error(json.error || "Cloudflare upload failed");
    }
    return { cloudflareVideoId: json.cloudflareVideoId };
  }

  async function handleNewCourseImageUpload(file: File) {
    setUploadMessage(null);
    setIsUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setNewCourse((current) => ({ ...current, coverImage: dataUrl }));
      setUploadMessage("Course thumbnail attached.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleEditingCourseImageUpload(file: File) {
    if (!editingCourse) return;
    setUploadMessage(null);
    setIsUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setEditingCourse((current) => (current ? { ...current, coverImage: dataUrl } : current));
      setUploadMessage("Course thumbnail attached.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDraftResourceUpload(courseId: string, file: File) {
    setUploadMessage(null);
    setIsUploading(true);
    try {
      const { url, warning } = await uploadResourceAsset(file);
      setModuleDraft((current) => ({
        ...current,
        [courseId]: {
          ...current[courseId],
          resourceUrl: url,
        },
      }));
      setUploadMessage(warning ?? "Resource uploaded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload resource");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDraftVideoUpload(courseId: string, file: File) {
    setUploadMessage(null);
    setIsUploading(true);
    try {
      const { cloudflareVideoId } = await uploadVideoToCloudflare(file);
      setModuleDraft((current) => ({
        ...current,
        [courseId]: {
          ...current[courseId],
          cloudflareVideoId,
        },
      }));
      setUploadMessage("Video uploaded to Cloudflare Stream.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload video");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleEditingModuleResourceUpload(file: File) {
    if (!editingModule) return;
    setUploadMessage(null);
    setIsUploading(true);
    try {
      const { url, warning } = await uploadResourceAsset(file);
      setEditingModule((current) => (current ? { ...current, resourceUrl: url } : current));
      setUploadMessage(warning ?? "Resource uploaded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload resource");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleEditingModuleVideoUpload(file: File) {
    if (!editingModule) return;
    setUploadMessage(null);
    setIsUploading(true);
    try {
      const { cloudflareVideoId } = await uploadVideoToCloudflare(file);
      setEditingModule((current) => (current ? { ...current, cloudflareVideoId } : current));
      setUploadMessage("Video uploaded to Cloudflare Stream.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload video");
    } finally {
      setIsUploading(false);
    }
  }

  function toDateTimeLocal(value: string | undefined): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function fromDateTimeLocal(value: string): string | undefined {
    if (!value.trim()) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  }

  async function createCourseSnapshot(courseId: string, published: boolean, reason: string) {
    const response = await fetch("/api/admin/lms/version", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courseId,
        published,
        reason,
      }),
    });
    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      throw new Error(json.error || "Unable to create course snapshot");
    }
  }

  async function saveCourse() {
    if (!newCourse.title || !newCourse.description) return false;
    if (!canManageLms) {
      setErrorMessage("You do not have permission to manage LMS content.");
      return false;
    }

    setIsSaving(true);
    setErrorMessage(null);
    let savedCourseId: string | null = null;

    const response = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newCourse.title,
        description: newCourse.description,
        accessLevel: newCourse.accessLevel ?? "partner",
        sortOrder: courses.length + 1,
        status: newCourse.status ?? "draft",
        isLocked: newCourse.isLocked ?? false,
        isPaid: newCourse.isPaid ?? false,
        price: newCourse.isPaid ? newCourse.price ?? 0 : 0,
        tags: newCourse.tags ?? [],
        coverImage: newCourse.coverImage || null,
        enforceSequential: newCourse.enforceSequential ?? true,
        publishAt: newCourse.publishAt ?? null,
        unpublishAt: newCourse.unpublishAt ?? null,
      }),
    });

    const result = (await response.json().catch(() => ({}))) as {
      course?: Course;
      error?: string;
    };
    if (!response.ok || !result.course) {
      setErrorMessage(result.error || "Failed to create course");
      setIsSaving(false);
      return false;
    }
    savedCourseId = result.course.id;
    try {
      await createCourseSnapshot(
        result.course.id,
        (result.course.status ?? "draft") === "published",
        "course_created"
      );
    } catch (error) {
      setUploadMessage(
        error instanceof Error
          ? `Course saved, but snapshot failed: ${error.message}`
          : "Course saved, but snapshot failed."
      );
    }
    await loadData();

    setNewCourse({
      title: "",
      description: "",
      accessLevel: "partner",
      status: "draft",
      isLocked: false,
      isPaid: false,
      price: 0,
      tags: [],
      coverImage: "",
      enforceSequential: true,
      publishAt: undefined,
      unpublishAt: undefined,
    });
    if (savedCourseId) {
      setUploadMessage("Course saved.");
    }
    setIsSaving(false);
    return true;
  }

  async function updateCourse() {
    if (!editingCourse) return;
    if (!canManageLms) {
      setErrorMessage("You do not have permission to manage LMS content.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const response = await fetch(`/api/admin/courses/${editingCourse.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editingCourse.title,
        description: editingCourse.description,
        accessLevel: editingCourse.accessLevel,
        status: editingCourse.status ?? "draft",
        isLocked: editingCourse.isLocked ?? false,
        isPaid: editingCourse.isPaid ?? false,
        price: editingCourse.isPaid ? editingCourse.price ?? 0 : 0,
        tags: editingCourse.tags ?? [],
        coverImage: editingCourse.coverImage || null,
        enforceSequential: editingCourse.enforceSequential ?? true,
        publishAt: editingCourse.publishAt ?? null,
        unpublishAt: editingCourse.unpublishAt ?? null,
      }),
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setErrorMessage(json.error || "Failed to update course");
      setIsSaving(false);
      return;
    }

    try {
      await createCourseSnapshot(
        editingCourse.id,
        (editingCourse.status ?? "draft") === "published",
        "course_updated"
      );
    } catch (error) {
      setUploadMessage(
        error instanceof Error
          ? `Course updated, but snapshot failed: ${error.message}`
          : "Course updated, but snapshot failed."
      );
    }

    setEditingCourse(null);
    await loadData();
    setIsSaving(false);
  }

  async function addModule(courseId: string) {
    const draft = moduleDraft[courseId];
    if (!draft?.title) return;
    if (!canManageLms) {
      setErrorMessage("You do not have permission to manage LMS content.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const existing = modulesByCourse[courseId] || [];
    const moduleType = draft.type ?? "video";
    const normalizedQuiz =
      moduleType === "quiz"
        ? normalizeQuizPayload(draft.quizPayload ?? createEmptyQuizPayload())
        : undefined;
    if (moduleType === "quiz" && !isQuizPayloadReady(normalizedQuiz!)) {
      setErrorMessage("Quiz modules need at least one complete question with two options.");
      setIsSaving(false);
      return;
    }
    const cloudflareVideoId =
      draft.cloudflareVideoId ||
      (moduleType === "video" ? draft.resourceUrl || "demo" : "demo");

    const response = await fetch(`/api/admin/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        description: draft.description || null,
        cloudflareVideoId,
        sortOrder: existing.length + 1,
        durationSeconds: draft.durationSeconds || 600,
        type: moduleType,
        resourceUrl: draft.resourceUrl || null,
        notes: draft.notes || null,
        passThreshold: draft.passThreshold ?? 70,
        quizPayload: normalizedQuiz ?? null,
      }),
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setErrorMessage(json.error || "Failed to create module");
      setIsSaving(false);
      return;
    }
    const parentCourseStatus = courses.find((course) => course.id === courseId)?.status ?? "draft";
    try {
      await createCourseSnapshot(courseId, parentCourseStatus === "published", "module_created");
    } catch (error) {
      setUploadMessage(
        error instanceof Error
          ? `Module saved, but snapshot failed: ${error.message}`
          : "Module saved, but snapshot failed."
      );
    }
    await loadData();

    setModuleDraft({
      ...moduleDraft,
      [courseId]: {
        title: "",
        description: "",
        durationSeconds: 600,
        type: "video",
        resourceUrl: "",
        cloudflareVideoId: "",
        passThreshold: 70,
        quizPayload: createEmptyQuizPayload(),
      },
    });
    setIsSaving(false);
  }

  async function updateModule() {
    if (!editingModule) return;
    if (!canManageLms) {
      setErrorMessage("You do not have permission to manage LMS content.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const normalizedQuiz =
      editingModule.type === "quiz"
        ? normalizeQuizPayload(editingModule.quizPayload ?? createEmptyQuizPayload())
        : null;
    if (editingModule.type === "quiz" && normalizedQuiz && !isQuizPayloadReady(normalizedQuiz)) {
      setErrorMessage("Quiz modules need at least one complete question with two options.");
      setIsSaving(false);
      return;
    }

    const response = await fetch(
      `/api/admin/courses/${editingModule.courseId}/modules/${editingModule.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingModule.title,
          description: editingModule.description || null,
          cloudflareVideoId: editingModule.cloudflareVideoId || "demo",
          durationSeconds: editingModule.durationSeconds,
          type: editingModule.type ?? "video",
          resourceUrl: editingModule.resourceUrl || null,
          notes: editingModule.notes || null,
          passThreshold: editingModule.passThreshold ?? 70,
          quizPayload: normalizedQuiz,
        }),
      }
    );

    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setErrorMessage(json.error || "Failed to update module");
      setIsSaving(false);
      return;
    }

    const parentCourseStatus =
      courses.find((course) => course.id === editingModule.courseId)?.status ?? "draft";
    try {
      await createCourseSnapshot(
        editingModule.courseId,
        parentCourseStatus === "published",
        "module_updated"
      );
    } catch (error) {
      setUploadMessage(
        error instanceof Error
          ? `Module updated, but snapshot failed: ${error.message}`
          : "Module updated, but snapshot failed."
      );
    }

    setEditingModule(null);
    await loadData();
    setIsSaving(false);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-[#1a1a1a]">LMS Management</h1>
          <p className="text-sm text-[#666666]">
            Create courses, manage modules, and configure access rules.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-[#2b4d24] hover:bg-[#1a3a15]"
              disabled={!canManageLms}
              title={!canManageLms ? "LMS manager permission required" : undefined}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> New Course
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl glass-elevated border-0">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Create Course</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newCourse.title ?? ""}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newCourse.description ?? ""}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Access Level</Label>
                  <Select
                    value={newCourse.accessLevel}
                    onValueChange={(value) =>
                      setNewCourse({ ...newCourse, accessLevel: value as Course["accessLevel"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Access Level" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={newCourse.status}
                    onValueChange={(value) =>
                      setNewCourse({ ...newCourse, status: value as Course["status"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Publish At (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocal(newCourse.publishAt)}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, publishAt: fromDateTimeLocal(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unpublish At (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocal(newCourse.unpublishAt)}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, unpublishAt: fromDateTimeLocal(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cover Image URL</Label>
                  <Input
                    value={newCourse.coverImage ?? ""}
                    onChange={(e) => setNewCourse({ ...newCourse, coverImage: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="new-course-image"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs text-[#666666]"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      Upload Image
                    </Label>
                    <input
                      id="new-course-image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleNewCourseImageUpload(file);
                        e.currentTarget.value = "";
                      }}
                    />
                    {isUploading && <span className="text-[10px] text-[#999999]">Uploading...</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input
                    value={(newCourse.tags ?? []).join(", ")}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 rounded-xl glass-inset p-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newCourse.isLocked ?? false}
                    onCheckedChange={(checked) => setNewCourse({ ...newCourse, isLocked: checked })}
                  />
                  <span className="text-sm text-[#666666]">Locked course</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newCourse.isPaid ?? false}
                    onCheckedChange={(checked) => setNewCourse({ ...newCourse, isPaid: checked })}
                  />
                  <span className="text-sm text-[#666666]">Paid course</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newCourse.enforceSequential ?? true}
                    onCheckedChange={(checked) =>
                      setNewCourse({ ...newCourse, enforceSequential: checked })
                    }
                  />
                  <span className="text-sm text-[#666666]">Sequential unlock</span>
                </div>
                {newCourse.isPaid && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-[#999999]">Price</Label>
                    <Input
                      type="number"
                      className="w-28"
                      value={newCourse.price ?? 0}
                      onChange={(e) => setNewCourse({ ...newCourse, price: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>
              <Button
                className="w-full bg-[#2b4d24] hover:bg-[#1a3a15]"
                disabled={isSaving || !canManageLms}
                onClick={async () => {
                  const ok = await saveCourse();
                  if (ok) setCreateOpen(false);
                }}
              >
                {isSaving ? "Saving..." : "Save Course"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-[#a36d4c]/30 bg-[#a36d4c]/10 px-4 py-3 text-sm text-[#7a5038]">
          {errorMessage}
        </div>
      )}
      {uploadMessage && (
        <div className="rounded-xl border border-[#2b4d24]/20 bg-[#2b4d24]/5 px-4 py-3 text-sm text-[#2b4d24]">
          {uploadMessage}
        </div>
      )}
      {!canManageLms && (
        <div className="rounded-xl border border-[#a36d4c]/30 bg-[#a36d4c]/10 px-4 py-3 text-sm text-[#7a5038]">
          You have view access only. LMS manager permission is required for editing.
        </div>
      )}

      <Tabs
        value={workspaceTab}
        onValueChange={(value) => setWorkspaceTab(value as "courses" | "community" | "analytics")}
      >
        <TabsList>
          <TabsTrigger value="courses">Courses & Modules</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
          {canViewAnalytics && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
        </TabsList>
      </Tabs>

      {canViewAnalytics && workspaceTab === "analytics" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Active Learners", value: lmsAnalytics.activeLearners },
            { label: "Module Completions", value: lmsAnalytics.completedRows },
            { label: "Notes Saved", value: lmsAnalytics.notesCount },
            { label: "Avg Watch (min)", value: lmsAnalytics.avgWatchMinutes },
            { label: "Certificates", value: lmsAnalytics.certificatesIssued },
          ].map((metric) => (
            <Card key={metric.label} className="glass-subtle border-0">
              <CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wide text-[#8b957b]">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold text-[#1a1a1a]">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {canViewAnalytics && workspaceTab === "analytics" && (
        <p className="text-xs text-[#8b957b]">
          Analytics panels are read-only insights. Manage cohorts and discussions from each course in the learner view.
        </p>
      )}

      {canViewAnalytics && workspaceTab === "analytics" && lmsAnalytics.topCourses.length > 0 && (
        <Card className="glass-subtle border-0">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-lg">Course Performance Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lmsAnalytics.topCourses.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#c5ccc2]/50 px-3 py-2"
              >
                <span className="text-sm text-[#1a1a1a]">{row.title}</span>
                <span className="text-xs text-[#666666]">
                  {row.learners} learners | {row.completionRate}% completion | {row.certificates} certificates
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canViewAnalytics && workspaceTab === "analytics" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="glass-subtle border-0">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Cohort Engagement (Read-only)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lmsAnalytics.cohorts.length === 0 ? (
                <p className="text-xs text-[#999999]">No cohort data yet.</p>
              ) : (
                lmsAnalytics.cohorts.map((row) => (
                  <div key={row.cohort} className="rounded-lg border border-[#c5ccc2]/50 px-3 py-2 text-xs">
                    <p className="font-medium text-[#1a1a1a]">{row.cohort}</p>
                    <p className="text-[#666666]">
                      {row.learners} learners | {row.completions} module completions
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-subtle border-0">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Modules Needing Attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lmsAnalytics.dropoffModules.length === 0 ? (
                <p className="text-xs text-[#999999]">No drop-off data yet.</p>
              ) : (
                lmsAnalytics.dropoffModules.map((row) => (
                  <div key={row.moduleId} className="rounded-lg border border-[#c5ccc2]/50 px-3 py-2 text-xs">
                    <p className="font-medium text-[#1a1a1a]">{row.title}</p>
                    <p className="text-[#666666]">
                      {row.completionRate}% completion | {row.started} started | avg watch{" "}
                      {Math.round(row.avgWatchSeconds / 60)} min
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-subtle border-0">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Quiz Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lmsAnalytics.quizPerformance.length === 0 ? (
                <p className="text-xs text-[#999999]">No quiz attempts yet.</p>
              ) : (
                lmsAnalytics.quizPerformance.map((row) => (
                  <div key={row.moduleId} className="rounded-lg border border-[#c5ccc2]/50 px-3 py-2 text-xs">
                    <p className="font-medium text-[#1a1a1a]">{row.title}</p>
                    <p className="text-[#666666]">
                      {row.attempts} attempts | {row.passRate}% pass rate | avg score {row.averageScore}%
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {canViewAnalytics && workspaceTab === "analytics" && lmsAnalytics.watchBehavior.length > 0 && (
        <Card className="glass-subtle border-0">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-lg">Video Engagement Trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lmsAnalytics.watchBehavior.slice(0, 8).map((row) => (
              <div
                key={row.moduleId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#c5ccc2]/50 px-3 py-2"
              >
                <span className="text-sm text-[#1a1a1a]">{row.title}</span>
                <span className="text-xs text-[#666666]">
                  {row.events} events | total {Math.round(row.totalWatch / 60)} min | avg{" "}
                  {Math.round(row.avgWatch / 60)} min
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {workspaceTab === "community" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="glass-subtle border-0">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Cohort Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canViewAnalytics ? (
                lmsAnalytics.cohorts.length === 0 ? (
                  <p className="text-xs text-[#999999]">No cohort data yet.</p>
                ) : (
                  lmsAnalytics.cohorts.map((row) => (
                    <div key={row.cohort} className="rounded-lg border border-[#c5ccc2]/50 px-3 py-2 text-xs">
                      <p className="font-medium text-[#1a1a1a]">{row.cohort}</p>
                      <p className="text-[#666666]">
                        {row.learners} learners | {row.completions} module completions
                      </p>
                    </div>
                  ))
                )
              ) : (
                <p className="text-xs text-[#999999]">
                  Analytics permission required to view cohort engagement insights.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-subtle border-0">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Community Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#666666]">
              <p>
                Cohorts and discussion threads are managed per course in the learner-facing community panel.
              </p>
              <p>
                Recommended workflow: publish course {"->"} create cohorts {"->"} assign instructors {"->"} monitor
                threads.
              </p>
              <p className="text-xs text-[#8b957b]">
                Use the courses tab to manage module structure and publishing. Use analytics tab for drop-off, quiz, and
                watch-time trends.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {workspaceTab === "courses" && <div className="grid gap-6">
        {courses.map((course) => {
          const courseModules = modulesByCourse[course.id] || [];
          return (
            <Card key={course.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-serif text-xl">{course.title}</CardTitle>
                    <p className="text-sm text-[#666666]">{course.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px] text-[#8b957b]">
                      {course.accessLevel.replace("_", " ")}
                    </Badge>
                    {course.status && (
                      <Badge variant="secondary" className="text-[10px]">
                        {course.status}
                      </Badge>
                    )}
                    {course.isLocked && (
                      <Badge className="text-[10px] bg-[#2b4d24]/10 text-[#2b4d24]">Locked</Badge>
                    )}
                    {course.isPaid && (
                      <Badge className="text-[10px] bg-[#e1a730]/10 text-[#a36d4c]">
                        Paid - ${course.price ?? 0}
                      </Badge>
                    )}
                    {course.publishAt && (
                      <Badge variant="outline" className="text-[10px] text-[#8b957b]">
                        Publishes {new Date(course.publishAt).toLocaleString()}
                      </Badge>
                    )}
                    {course.unpublishAt && (
                      <Badge variant="outline" className="text-[10px] text-[#a36d4c]">
                        Unpublishes {new Date(course.unpublishAt).toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-[#999999]">
                  <GraduationCap className="h-4 w-4 text-[#2b4d24]" />
                  {courseModules.length} modules
                </div>
                <div className="space-y-3">
                  {courseModules.map((module) => (
                    <div key={module.id} className="rounded-xl glass-inset p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#1a1a1a]">{module.title}</p>
                          <p className="text-xs text-[#999999]">{module.description}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canManageLms}
                          onClick={() => setEditingModule(module)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#8b957b]">
                        <Badge variant="outline" className="text-[10px]">
                          {(module.type ?? "video").toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {Math.round(module.durationSeconds / 60)} min
                        </Badge>
                        {module.resourceUrl && (
                          <Badge variant="secondary" className="text-[10px]">
                            Resource linked
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {courseModules.length === 0 && (
                    <p className="text-xs text-[#999999]">No modules yet.</p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <div className="space-y-2">
                    <Label>Add Module Title</Label>
                    <Input
                      value={moduleDraft[course.id]?.title ?? ""}
                      onChange={(e) =>
                        setModuleDraft({
                          ...moduleDraft,
                          [course.id]: { ...moduleDraft[course.id], title: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (sec)</Label>
                    <Input
                      type="number"
                      value={moduleDraft[course.id]?.durationSeconds ?? 600}
                      onChange={(e) =>
                        setModuleDraft({
                          ...moduleDraft,
                          [course.id]: {
                            ...moduleDraft[course.id],
                            durationSeconds: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Module Type</Label>
                    <Select
                      value={moduleDraft[course.id]?.type ?? "video"}
                      onValueChange={(value) =>
                        setModuleDraft({
                          ...moduleDraft,
                          [course.id]: { ...moduleDraft[course.id], type: value as CourseModule["type"] },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {MODULE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Resource URL</Label>
                    <Input
                      value={moduleDraft[course.id]?.resourceUrl ?? ""}
                      onChange={(e) =>
                        setModuleDraft({
                          ...moduleDraft,
                          [course.id]: { ...moduleDraft[course.id], resourceUrl: e.target.value },
                        })
                      }
                    />
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`resource-upload-${course.id}`}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs text-[#666666]"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload Resource
                      </Label>
                      <input
                        id={`resource-upload-${course.id}`}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleDraftResourceUpload(course.id, file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cloudflare Stream ID</Label>
                    <Input
                      placeholder="For video modules"
                      value={moduleDraft[course.id]?.cloudflareVideoId ?? ""}
                      onChange={(e) =>
                        setModuleDraft({
                          ...moduleDraft,
                          [course.id]: {
                            ...moduleDraft[course.id],
                            cloudflareVideoId: e.target.value,
                          },
                        })
                      }
                    />
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`video-upload-${course.id}`}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs text-[#666666]"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload Video
                      </Label>
                      <input
                        id={`video-upload-${course.id}`}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleDraftVideoUpload(course.id, file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Quiz Pass %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={moduleDraft[course.id]?.passThreshold ?? 70}
                      onChange={(e) =>
                        setModuleDraft({
                          ...moduleDraft,
                          [course.id]: {
                            ...moduleDraft[course.id],
                            passThreshold: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
                {(moduleDraft[course.id]?.type ?? "video") === "quiz" && (
                  <QuizBuilder
                    payload={normalizeQuizPayload(
                      moduleDraft[course.id]?.quizPayload ?? createEmptyQuizPayload()
                    )}
                    onChange={(payload) =>
                      setModuleDraft((current) => ({
                        ...current,
                        [course.id]: {
                          ...current[course.id],
                          quizPayload: payload,
                        },
                      }))
                    }
                  />
                )}
                <div className="space-y-2">
                  <Label>Module Notes (optional)</Label>
                  <Textarea
                    value={moduleDraft[course.id]?.notes ?? ""}
                    onChange={(e) =>
                      setModuleDraft({
                        ...moduleDraft,
                        [course.id]: { ...moduleDraft[course.id], notes: e.target.value },
                      })
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={isSaving || !canManageLms}
                  onClick={() => void addModule(course.id)}
                >
                  {isSaving ? "Saving..." : "Add Module"}
                </Button>
                <Button
                  variant="ghost"
                  className="text-[#2b4d24]"
                  disabled={!canManageLms}
                  onClick={() => setEditingCourse(course)}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit course settings
                </Button>
                <Button
                  variant="ghost"
                  disabled={!canManageLms}
                  onClick={async () => {
                    try {
                      await createCourseSnapshot(
                        course.id,
                        (course.status ?? "draft") === "published",
                        "manual_snapshot"
                      );
                      setUploadMessage("Snapshot saved.");
                    } catch (error) {
                      setErrorMessage(error instanceof Error ? error.message : "Failed to create snapshot");
                    }
                  }}
                >
                  Save Snapshot
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>}

      <Dialog open={Boolean(editingCourse)} onOpenChange={(open) => !open && setEditingCourse(null)}>
        <DialogContent className="max-w-xl glass-elevated border-0">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Edit Course</DialogTitle>
          </DialogHeader>
          {editingCourse && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editingCourse.title}
                  onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingCourse.description}
                  onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingCourse.status ?? "draft"}
                    onValueChange={(value) => setEditingCourse({ ...editingCourse, status: value as Course["status"] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Access Level</Label>
                  <Select
                    value={editingCourse.accessLevel}
                    onValueChange={(value) =>
                      setEditingCourse({ ...editingCourse, accessLevel: value as Course["accessLevel"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Access Level" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Publish At (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocal(editingCourse.publishAt)}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        publishAt: fromDateTimeLocal(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unpublish At (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocal(editingCourse.unpublishAt)}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        unpublishAt: fromDateTimeLocal(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  <Input
                    value={editingCourse.coverImage ?? ""}
                    onChange={(e) => setEditingCourse({ ...editingCourse, coverImage: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="edit-course-image"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs text-[#666666]"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      Upload Image
                    </Label>
                    <input
                      id="edit-course-image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleEditingCourseImageUpload(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input
                    value={(editingCourse.tags ?? []).join(", ")}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 rounded-xl glass-inset p-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingCourse.isLocked ?? false}
                    onCheckedChange={(checked) => setEditingCourse({ ...editingCourse, isLocked: checked })}
                  />
                  <span className="text-sm text-[#666666]">Locked course</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingCourse.isPaid ?? false}
                    onCheckedChange={(checked) => setEditingCourse({ ...editingCourse, isPaid: checked })}
                  />
                  <span className="text-sm text-[#666666]">Paid course</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingCourse.enforceSequential ?? true}
                    onCheckedChange={(checked) =>
                      setEditingCourse({ ...editingCourse, enforceSequential: checked })
                    }
                  />
                  <span className="text-sm text-[#666666]">Sequential unlock</span>
                </div>
                {editingCourse.isPaid && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-[#999999]">Price</Label>
                    <Input
                      type="number"
                      className="w-28"
                      value={editingCourse.price ?? 0}
                      onChange={(e) => setEditingCourse({ ...editingCourse, price: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>
              <Button
                className="w-full bg-[#2b4d24] hover:bg-[#1a3a15]"
                disabled={isSaving || !canManageLms}
                onClick={() => void updateCourse()}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingModule)} onOpenChange={(open) => !open && setEditingModule(null)}>
        <DialogContent className="max-w-lg glass-elevated border-0">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Edit Module</DialogTitle>
          </DialogHeader>
          {editingModule && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editingModule.title}
                  onChange={(e) => setEditingModule({ ...editingModule, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingModule.description ?? ""}
                  onChange={(e) => setEditingModule({ ...editingModule, description: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={editingModule.type ?? "video"}
                    onValueChange={(value) =>
                      setEditingModule({ ...editingModule, type: value as CourseModule["type"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODULE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration (sec)</Label>
                  <Input
                    type="number"
                    value={editingModule.durationSeconds}
                    onChange={(e) =>
                      setEditingModule({ ...editingModule, durationSeconds: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Resource URL</Label>
                <Input
                  value={editingModule.resourceUrl ?? ""}
                  onChange={(e) =>
                    setEditingModule({ ...editingModule, resourceUrl: e.target.value })
                  }
                />
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="edit-module-resource-upload"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs text-[#666666]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload Resource
                  </Label>
                  <input
                    id="edit-module-resource-upload"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleEditingModuleResourceUpload(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cloudflare Stream ID</Label>
                  <Input
                    value={editingModule.cloudflareVideoId ?? ""}
                    onChange={(e) =>
                      setEditingModule({ ...editingModule, cloudflareVideoId: e.target.value })
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="edit-module-video-upload"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs text-[#666666]"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Video
                    </Label>
                    <input
                      id="edit-module-video-upload"
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleEditingModuleVideoUpload(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quiz Pass %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editingModule.passThreshold ?? 70}
                    onChange={(e) =>
                      setEditingModule({ ...editingModule, passThreshold: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              {(editingModule.type ?? "video") === "quiz" && (
                <QuizBuilder
                  payload={normalizeQuizPayload(editingModule.quizPayload ?? createEmptyQuizPayload())}
                  onChange={(payload) =>
                    setEditingModule((current) =>
                      current
                        ? {
                            ...current,
                            quizPayload: payload,
                          }
                        : current
                    )
                  }
                />
              )}
              <div className="space-y-2">
                <Label>Module Notes</Label>
                <Textarea
                  value={editingModule.notes ?? ""}
                  onChange={(e) =>
                    setEditingModule({ ...editingModule, notes: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#999999]">
                <Film className="h-3.5 w-3.5" /> Video modules can point to Cloudflare Stream IDs.
              </div>
              <div className="flex items-center gap-2 text-xs text-[#999999]">
                <FileText className="h-3.5 w-3.5" /> Reading modules can link PDFs or docs.
              </div>
              <Button
                className="w-full bg-[#2b4d24] hover:bg-[#1a3a15]"
                disabled={isSaving || !canManageLms}
                onClick={() => void updateModule()}
              >
                {isSaving ? "Saving..." : "Save Module"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
