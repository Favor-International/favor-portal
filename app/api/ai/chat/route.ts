import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { answerFavorQuestion } from "@/lib/openrouter/client";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;

    const answer = await answerFavorQuestion(question);
    return NextResponse.json({ success: true, answer });
  } catch (error) {
    logError({ event: "ai.chat.failed", route: "/api/ai/chat", error });
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("OPENROUTER_API_KEY")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
