import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { updateGivingGoal, deleteGivingGoal, type UpdateGivingGoal } from "@/lib/db/access/giving-goals";
import { AuthorizationError } from "@/lib/db/access/authz";
import { logError, logInfo } from "@/lib/logger";
import type { GivingGoal } from "@/types";

export const runtime = "nodejs";

const VALID_CATEGORIES: GivingGoal["category"][] = ["annual", "project", "monthly", "custom"];

function parseGoalUpdate(body: unknown): UpdateGivingGoal {
  const payload = body as Record<string, unknown>;
  const updates: UpdateGivingGoal = {};

  if (typeof payload?.name === "string") updates.name = payload.name.trim();
  if (payload?.targetAmount !== undefined) updates.targetAmount = Number(payload.targetAmount);
  if (payload?.currentAmount !== undefined) updates.currentAmount = Number(payload.currentAmount);
  if (typeof payload?.deadline === "string") updates.deadline = payload.deadline;
  if (payload?.category !== undefined) updates.category = payload.category as GivingGoal["category"];
  if (payload?.description !== undefined) {
    if (typeof payload.description === "string") {
      const trimmed = payload.description.trim();
      updates.description = trimmed.length > 0 ? trimmed : null;
    } else if (payload.description === null) {
      updates.description = null;
    }
  }

  return updates;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = parseGoalUpdate(await request.json());

    if (updates.name !== undefined && !updates.name) {
      return NextResponse.json({ error: "Goal name cannot be empty" }, { status: 400 });
    }
    if (updates.targetAmount !== undefined && (!Number.isFinite(updates.targetAmount) || updates.targetAmount <= 0)) {
      return NextResponse.json({ error: "Target amount must be greater than 0" }, { status: 400 });
    }
    if (updates.currentAmount !== undefined && (!Number.isFinite(updates.currentAmount) || updates.currentAmount < 0)) {
      return NextResponse.json({ error: "Current amount must be 0 or higher" }, { status: 400 });
    }
    if (updates.category !== undefined && !VALID_CATEGORIES.includes(updates.category)) {
      return NextResponse.json({ error: "Invalid goal category" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    let data;
    try {
      data = await updateGivingGoal(getDb(), ctx, id, updates);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    logInfo({
      event: "giving.goal.updated",
      route: "/api/giving/goals/[id]",
      userId: ctx.userId,
      details: { goalId: id },
    });

    return NextResponse.json({
      success: true,
      goal: {
        id: data.id,
        userId: data.userId,
        name: data.name,
        targetAmount: Number(data.targetAmount),
        currentAmount: Number(data.currentAmount),
        deadline: data.deadline,
        category: data.category as GivingGoal["category"],
        description: data.description ?? undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
  } catch (error) {
    logError({ event: "giving.goal.update_failed", route: "/api/giving/goals/[id]", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    try {
      await deleteGivingGoal(getDb(), ctx, id);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      throw error;
    }

    logInfo({
      event: "giving.goal.deleted",
      route: "/api/giving/goals/[id]",
      userId: ctx.userId,
      details: { goalId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({ event: "giving.goal.delete_failed", route: "/api/giving/goals/[id]", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
