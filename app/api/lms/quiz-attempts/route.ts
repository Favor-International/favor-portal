import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import {
  listQuizAttempts,
  createQuizAttempt,
  type QuizAttemptInput,
} from "@/lib/db/access/learning";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const moduleId = new URL(request.url).searchParams.get("moduleId");
    if (!moduleId) {
      return NextResponse.json({ error: "Missing moduleId" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const attempts = await listQuizAttempts(getDb(), ctx, moduleId);

    return NextResponse.json({ success: true, attempts }, { status: 200 });
  } catch (error) {
    console.error("LMS quiz-attempts GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<QuizAttemptInput>;
    if (!body.courseId || !body.moduleId || typeof body.scorePercent !== "number") {
      return NextResponse.json(
        { error: "Missing courseId, moduleId, or scorePercent" },
        { status: 400 }
      );
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const attempt = await createQuizAttempt(getDb(), ctx, {
      courseId: body.courseId,
      moduleId: body.moduleId,
      attemptNumber: body.attemptNumber,
      scorePercent: body.scorePercent,
      correctAnswers: body.correctAnswers,
      totalQuestions: body.totalQuestions,
      passed: body.passed,
      answers: body.answers,
      questionOrder: body.questionOrder,
      optionOrder: body.optionOrder,
      durationSeconds: body.durationSeconds,
      metadata: body.metadata,
    });

    return NextResponse.json({ success: true, attempt }, { status: 200 });
  } catch (error) {
    console.error("LMS quiz-attempts POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
