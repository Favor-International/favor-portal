import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { listGivingGoals, createGivingGoal } from "@/lib/db/access/giving-goals";
import { logError, logInfo } from "@/lib/logger";
import type { GivingGoal } from "@/types";

export const runtime = "nodejs";

const VALID_CATEGORIES: GivingGoal["category"][] = ["annual", "project", "monthly", "custom"];

function mapGoalRow(row: {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}): GivingGoal {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    targetAmount: Number(row.targetAmount),
    currentAmount: Number(row.currentAmount),
    deadline: row.deadline,
    category: VALID_CATEGORIES.includes(row.category as GivingGoal["category"])
      ? (row.category as GivingGoal["category"])
      : "custom",
    description: row.description ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const goals = await listGivingGoals(getDb(), ctx);

    return NextResponse.json({
      success: true,
      goals: goals.map(mapGoalRow),
    });
  } catch (error) {
    logError({ event: "giving.goals.fetch_failed", route: "/api/giving/goals", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const targetAmount = Number(body?.targetAmount ?? 0);
    const currentAmount = Number(body?.currentAmount ?? 0);
    const deadline = typeof body?.deadline === "string" ? body.deadline : "";
    const category = body?.category as GivingGoal["category"];
    const description = typeof body?.description === "string" ? body.description.trim() : "";

    if (!name || !Number.isFinite(targetAmount) || targetAmount <= 0 || !deadline) {
      return NextResponse.json({ error: "Invalid goal payload" }, { status: 400 });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid goal category" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const row = await createGivingGoal(getDb(), ctx, {
      name,
      targetAmount,
      currentAmount: Number.isFinite(currentAmount) ? Math.max(currentAmount, 0) : 0,
      deadline,
      category,
      description: description || undefined,
    });

    logInfo({
      event: "giving.goal.created",
      route: "/api/giving/goals",
      userId: ctx.userId,
      details: { goalId: row.id },
    });

    return NextResponse.json({ success: true, goal: mapGoalRow(row) }, { status: 201 });
  } catch (error) {
    logError({ event: "giving.goal.create_failed", route: "/api/giving/goals", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
